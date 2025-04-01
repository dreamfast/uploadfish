package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"uploadfish/config"
	"uploadfish/models"
	"uploadfish/storage"
	"uploadfish/utils"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/prologic/bitcask"
)

// Handler contains all the dependencies for the handlers
type Handler struct {
	Config         *config.Config
	Templates      *template.Template
	Storage        *storage.Storage
	csrfProtection *utils.CSRFProtection
	// State for tracking chunked uploads
	chunkStates   map[string]*chunkState
	chunkStatesMu sync.Mutex
}

// chunkState holds the validation state for an ongoing chunked upload
type chunkState struct {
	NextIndex    int       // The index of the next expected chunk
	UploadSecret string    // Secret key used for HMAC token generation for this upload
	LastUpdated  time.Time // Timestamp for cleaning up stale entries
}

// New creates a new Handler with the given configuration
func New(cfg *config.Config, store *storage.Storage, csrfProtection *utils.CSRFProtection) *Handler {
	// Parse templates with dict helper function
	tmpl := template.Must(template.New("").Funcs(template.FuncMap{
		"dict": func(values ...interface{}) (map[string]interface{}, error) {
			if len(values)%2 != 0 {
				return nil, fmt.Errorf("invalid dict call")
			}
			dict := make(map[string]interface{}, len(values)/2)
			for i := 0; i < len(values); i += 2 {
				key, ok := values[i].(string)
				if !ok {
					return nil, fmt.Errorf("dict keys must be strings")
				}
				dict[key] = values[i+1]
			}
			return dict, nil
		},
		// WARNING: This function bypasses HTML escaping and should only be used for trusted content
		// that has been thoroughly validated. Improper use can lead to XSS vulnerabilities.
		"safe": func(s string) template.HTML {
			return template.HTML(s)
		},
	}).ParseGlob("templates/*.html"))

	h := &Handler{
		Config:         cfg,
		Templates:      tmpl,
		Storage:        store,
		csrfProtection: csrfProtection,
		// Initialize the chunk state map
		chunkStates: make(map[string]*chunkState),
	}

	// Start cleanup routine for chunk states
	go h.cleanupStaleChunkStates(3 * time.Hour) // Clean up entries older than 3 hours

	return h
}

// cleanupStaleChunkStates periodically removes old chunk state entries
func (h *Handler) cleanupStaleChunkStates(maxAge time.Duration) {
	ticker := time.NewTicker(30 * time.Minute) // Check every 30 minutes
	defer ticker.Stop()

	for range ticker.C {
		h.chunkStatesMu.Lock()
		now := time.Now()
		cleanedCount := 0
		for fileID, state := range h.chunkStates {
			if now.Sub(state.LastUpdated) > maxAge {
				delete(h.chunkStates, fileID)
				cleanedCount++
			}
		}
		if cleanedCount > 0 {
			LogInfo("Cleaned up stale chunk states", map[string]interface{}{
				"count": cleanedCount,
			})
		}
		h.chunkStatesMu.Unlock()
	}
}

// Index renders the main upload page
func (h *Handler) Index(w http.ResponseWriter, r *http.Request) {
	// Generate CSRF token pair
	tokens := h.csrfProtection.GenerateTokenPair()
	h.csrfProtection.SetTokenCookie(w, tokens.CookieToken)

	// Prepare template data
	data := struct {
		MaxSizeMB     int64
		AllowedTypes  string
		ExpiryOptions []models.ExpiryOption
		CSRFToken     string
	}{
		MaxSizeMB:     h.Config.MaxUploadSize / (1 << 20),
		AllowedTypes:  getAllowedTypesDisplay(h.Config.AllowedTypes),
		ExpiryOptions: models.GetExpiryOptions(),
		CSRFToken:     tokens.FormToken,
	}

	h.renderTemplate(w, r, "index.html", data, 0)
}

// Upload handles file uploads
func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	// For GET requests, redirect to the index page
	if r.Method == "GET" {
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}

	// Set max upload size
	r.Body = http.MaxBytesReader(w, r.Body, h.Config.MaxUploadSize)

	// Parse the multipart form
	if err := r.ParseMultipartForm(h.Config.MaxUploadSize); err != nil {
		LogError(err, "Error parsing multipart form", map[string]interface{}{
			"max_size": h.Config.MaxUploadSize,
		})
		h.renderError(w, r, fmt.Sprintf("The uploaded file is too big. Please choose a file that's less than %d MB.", h.Config.MaxUploadSize/(1<<20)), http.StatusBadRequest)
		return
	}

	// Validate CSRF token
	if !h.validateCSRF(w, r) {
		return
	}

	// Get file from request
	file, handler, err := r.FormFile("file")
	if err != nil {
		LogError(err, "Error retrieving file", map[string]interface{}{
			"form_key": "file",
		})
		h.renderError(w, r, fmt.Sprintf("Error retrieving the file: %v", err), http.StatusBadRequest)
		return
	}
	defer func(file multipart.File) {
		err := file.Close()
		if err != nil {
			LogError(err, "Error closing file", nil)
		}
	}(file)

	// Process and validate file
	fileMetadata, err := h.processUploadedFile(file, handler, r)
	if err != nil {
		h.renderError(w, r, err.Error(), http.StatusBadRequest)
		return
	}

	// Save to storage
	if err := h.Storage.SaveFile(fileMetadata, file); err != nil {
		LogError(err, "Error saving file", map[string]interface{}{
			"file_id":   fileMetadata.ID,
			"file_size": fileMetadata.Size,
		})
		h.renderError(w, r, fmt.Sprintf("Error saving file: %v", err), http.StatusInternalServerError)
		return
	}

	LogInfo("File uploaded successfully", map[string]interface{}{
		"filename":  fileMetadata.Filename,
		"size":      fileMetadata.Size,
		"mime_type": fileMetadata.MimeType,
		"file_id":   fileMetadata.ID,
	})

	// Redirect to the preview page
	previewURL := fmt.Sprintf("%s/file/%s", h.getBaseURL(r), fileMetadata.ID)
	http.Redirect(w, r, previewURL, http.StatusSeeOther)
}

// validateCSRF validates the CSRF token and returns true if valid
func (h *Handler) validateCSRF(w http.ResponseWriter, r *http.Request) bool {
	csrfToken := r.FormValue("csrf_token")
	cookie, err := r.Cookie("csrf_token")
	if err != nil {
		LogInfo("Invalid or missing CSRF token", map[string]interface{}{
			"ip": r.RemoteAddr,
		})
		h.renderError(w, r, "Invalid or missing CSRF token, try refreshing the page.", http.StatusForbidden)
		return false
	}

	if csrfToken == "" || !h.csrfProtection.ValidateToken(csrfToken, cookie.Value) {
		LogInfo("Invalid or missing CSRF token", map[string]interface{}{
			"ip": r.RemoteAddr,
		})
		h.renderError(w, r, "Invalid or missing CSRF token, try refreshing the page.", http.StatusForbidden)
		return false
	}
	return true
}

// processUploadedFile processes and validates an uploaded file
func (h *Handler) processUploadedFile(file io.ReadSeeker, handler *multipart.FileHeader, r *http.Request) (*models.File, error) {
	// Get expiry option
	expiryValue := r.FormValue("expiry")
	if expiryValue == "" {
		LogInfo("No expiry value provided, using default", map[string]interface{}{
			"default_expiry": "1h",
		})
		expiryValue = "1h" // Default to 1 hour if not specified
	}

	// Validate expiry value against allowed options
	validExpiryValues := map[string]bool{"1h": true, "6h": true, "24h": true, "72h": true, "when_downloaded": true}
	if !validExpiryValues[expiryValue] {
		LogInfo("Invalid expiry value provided, using default", map[string]interface{}{
			"provided_expiry": expiryValue,
			"default_expiry":  "1h",
		})
		expiryValue = "1h" // Default to 1 hour if invalid
	}

	var expiryTime time.Time
	if expiryValue != "when_downloaded" {
		expiryDuration := models.ParseExpiryDuration(expiryValue)
		expiryTime = time.Now().Add(expiryDuration)
	} // else leave expiryTime as zero for "when_downloaded"

	// Check if the file is encrypted client-side
	isEncrypted := false
	encryptedValue := r.FormValue("encrypted")
	if encryptedValue == "true" {
		isEncrypted = true
		LogInfo("File is encrypted client-side", nil)
	}

	// Get encrypted sample if available
	var encryptedSample []byte
	if isEncrypted {
		sampleBase64 := r.FormValue("encrypted_sample")
		if sampleBase64 != "" {
			// Decode base64 to bytes
			var err error
			encryptedSample, err = utils.Base64Decode(sampleBase64)
			if err != nil {
				LogError(err, "Error decoding encrypted sample", nil)
				// Continue without sample, not critical
			} else {
				LogInfo("Received encrypted sample for validation", map[string]interface{}{
					"sample_size": len(encryptedSample),
				})
			}
		}
	}

	// Create a buffer to store the header of the file
	buffer := make([]byte, 512)
	if _, err := file.Read(buffer); err != nil {
		LogError(err, "Error reading file header", nil)
		return nil, fmt.Errorf("error reading file: %v", err)
	}

	// Reset the file pointer
	if _, err := file.Seek(0, 0); err != nil {
		LogError(err, "Error resetting file pointer", nil)
		return nil, fmt.Errorf("error processing file: %v", err)
	}

	// Get content type
	contentType := http.DetectContentType(buffer)
	LogInfo("File content type detected", map[string]interface{}{
		"content_type": contentType,
	})

	// Validate content type
	if err := validateContentType(contentType, h.Config.AllowedTypes); err != nil {
		return nil, err
	}

	// Generate a UUID for the file
	fileID := uuid.New().String()
	LogInfo("Generated file ID", map[string]interface{}{
		"file_id": fileID,
	})

	// Get file size by seeking
	size, err := file.Seek(0, io.SeekEnd) // Seek to end to get size
	if err != nil {
		LogError(err, "Error seeking to end of file to get size", nil)
		return nil, fmt.Errorf("error processing file: %v", err)
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil { // Seek back to start
		LogError(err, "Error seeking back to start of file", nil)
		return nil, fmt.Errorf("error processing file: %v", err)
	}

	return &models.File{
		ID:              fileID,
		Filename:        sanitizeFilename(handler.Filename),
		MimeType:        contentType,
		Size:            size, // Use size obtained from seeking
		UploadTime:      time.Now(),
		ExpiryValue:     expiryValue, // Store raw value
		ExpiryTime:      expiryTime,  // Store calculated time (or zero)
		IsEncrypted:     isEncrypted,
		EncryptedSample: encryptedSample,
	}, nil
}

// validateContentType validates if the content type is allowed
func validateContentType(contentType string, allowedTypes []string) error {
	// Reject potentially dangerous file types
	dangerousTypes := []string{
		"application/x-msdownload",
		"application/x-executable",
		"application/x-dosexec",
		"application/x-msdos-program",
		"application/x-msi",
		"application/x-coredump",
	}

	for _, dt := range dangerousTypes {
		if strings.HasPrefix(contentType, dt) {
			LogInfo("Rejecting upload of potentially dangerous file type", map[string]interface{}{
				"content_type": contentType,
			})
			return fmt.Errorf("file type '%s' is not allowed", contentType)
		}
	}

	// If specific types are allowed, check against them
	if len(allowedTypes) > 0 && allowedTypes[0] != "*" {
		allowed := false
		for _, at := range allowedTypes {
			if strings.HasPrefix(contentType, at) {
				allowed = true
				break
			}
		}

		if !allowed {
			return fmt.Errorf("file type '%s' is not allowed. Allowed types: %s",
				contentType, strings.Join(allowedTypes, ", "))
		}
	}

	return nil
}

// ServeFileByID serves a file using its UUID
func (h *Handler) ServeFileByID(w http.ResponseWriter, r *http.Request) {
	// Get ID from request using Chi router's URL parameter extraction
	id := chi.URLParam(r, "fileID")

	// Get file metadata from storage
	fileMetadata, err := h.Storage.GetFile(id)
	if err != nil {
		h.renderError(w, r, "File not found or has expired", http.StatusNotFound)
		return
	}

	// Check if file has expired
	if !fileMetadata.ExpiryTime.IsZero() && fileMetadata.ExpiryTime.Before(time.Now()) {
		// Delete the expired file
		if err := h.Storage.DeleteFile(id); err != nil {
			LogError(err, "Error deleting expired file", map[string]interface{}{
				"file_id": id,
			})
		}

		h.renderError(w, r, "This file has expired and is no longer available", http.StatusGone)
		return
	}

	// If this is a direct download, serve the file directly
	if r.URL.Query().Get("dl") == "true" {
		serveFileContent(w, r, h.Storage, fileMetadata)
		return
	}

	// Otherwise, show the preview page
	servePreviewPage(w, r, h, fileMetadata)
}

// Helper function to serve file content
func serveFileContent(w http.ResponseWriter, r *http.Request, storage *storage.Storage, fileMetadata *models.File) {
	// Get file content stream
	reader, err := storage.GetFileContentStream(fileMetadata.ID)
	if err != nil {
		if err == bitcask.ErrKeyNotFound { // Handle not found specifically
			http.Error(w, "File not found", http.StatusNotFound)
		} else {
			LogError(err, "Error retrieving file content stream", map[string]interface{}{"file_id": fileMetadata.ID})
			http.Error(w, "Error retrieving file content", http.StatusInternalServerError)
		}
		return
	}
	defer reader.Close() // Ensure the stream is closed

	// --- Check for "When Viewed" expiry ---
	shouldDeleteAfterServe := false

	if fileMetadata.ExpiryValue == "when_downloaded" {
		shouldDeleteAfterServe = true // Mark for deletion regardless of key
		LogInfo("'When Viewed' file accessed, scheduling deletion after serve", map[string]interface{}{
			"file_id": fileMetadata.ID,
		})
	}
	// --------------------------------------

	// Add cache control headers for better performance
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")

	// Set content type if we know it
	if fileMetadata.MimeType != "" {
		w.Header().Set("Content-Type", fileMetadata.MimeType)
	}

	// Set filename for download
	// Use attachment instead of inline to force download for certain file types
	isDownloadable :=
		!strings.HasPrefix(fileMetadata.MimeType, "image/") &&
			!strings.HasPrefix(fileMetadata.MimeType, "video/") &&
			!strings.HasPrefix(fileMetadata.MimeType, "audio/")

	if isDownloadable {
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileMetadata.Filename))
	} else {
		w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileMetadata.Filename))
	}

	// Set content length
	w.Header().Set("Content-Length", strconv.FormatInt(fileMetadata.Size, 10))

	// Stream the content directly to the response using io.Copy
	bytesWritten, copyErr := io.Copy(w, reader)

	// --- Execute deletion if scheduled and copy was successful ---
	if copyErr == nil && shouldDeleteAfterServe {
		LogInfo("File stream successful, executing 'When Viewed' deletion", map[string]interface{}{
			"file_id": fileMetadata.ID,
		})
		if err := storage.DeleteFile(fileMetadata.ID); err != nil {
			LogError(err, "Error deleting file after 'When Viewed' download", map[string]interface{}{
				"file_id": fileMetadata.ID,
			})
		} else {
			LogInfo("'When Viewed' file deleted successfully after download", map[string]interface{}{
				"file_id": fileMetadata.ID,
			})
		}
	}
	// ---------------------------------------------------------

	// Handle potential errors during copy
	if copyErr != nil {
		// Can't send error response here since we've already started writing the response
		LogError(copyErr, "Error copying file content stream to response", map[string]interface{}{
			"file_id":       fileMetadata.ID,
			"size":          fileMetadata.Size,
			"bytes_written": bytesWritten,
		})
	}
}

// Helper function to serve the preview page
func servePreviewPage(w http.ResponseWriter, r *http.Request, h *Handler, fileMetadata *models.File) {
	// Get file details
	fileURL := fmt.Sprintf("%s/file/%s", h.getBaseURL(r), fileMetadata.ID)
	shareURL := fileURL

	// Format size for human readability
	sizeFormatted := formatFileSize(fileMetadata.Size)

	// Format times for display
	uploadTimeFormatted := fileMetadata.UploadTime.Format("Jan 2, 2006 3:04 PM")
	expiryTimeFormatted := ""
	if !fileMetadata.ExpiryTime.IsZero() {
		expiryTimeFormatted = fileMetadata.ExpiryTime.Format("Jan 2, 2006 3:04 PM")
	}

	// Determine if file is previewable and what type of preview to show
	isPreviewable := isPreviewableType(fileMetadata.MimeType)
	isImage := strings.HasPrefix(fileMetadata.MimeType, "image/")
	isVideo := strings.HasPrefix(fileMetadata.MimeType, "video/")
	isAudio := strings.HasPrefix(fileMetadata.MimeType, "audio/")

	// Generate CSRF token for the page
	csrfToken, err := h.csrfProtection.GenerateToken() // Handle error
	if err != nil {
		LogError(err, "Failed to generate CSRF token for preview page", map[string]interface{}{"file_id": fileMetadata.ID})
		// Don't panic here, maybe render error or proceed without CSRF?
		// For now, proceed with an empty token, which might break forms on the page.
		csrfToken = ""
	}

	// Prepare template data
	data := struct {
		Filename            string
		MimeType            string
		Size                int64
		SizeFormatted       string
		UploadTime          time.Time
		UploadTimeFormatted string
		ExpiryTime          time.Time
		ExpiryTimeFormatted string
		ExpiryValue         string
		FileURL             string
		ShareURL            string
		IsPreviewable       bool
		IsImage             bool
		IsVideo             bool
		IsAudio             bool
		CSRFToken           string
		IsEncrypted         bool
	}{
		Filename:            fileMetadata.Filename,
		MimeType:            fileMetadata.MimeType,
		Size:                fileMetadata.Size,
		SizeFormatted:       sizeFormatted,
		UploadTime:          fileMetadata.UploadTime,
		UploadTimeFormatted: uploadTimeFormatted,
		ExpiryTime:          fileMetadata.ExpiryTime,
		ExpiryTimeFormatted: expiryTimeFormatted,
		ExpiryValue:         fileMetadata.ExpiryValue,
		FileURL:             fileURL,
		ShareURL:            shareURL,
		IsPreviewable:       isPreviewable,
		IsImage:             isImage,
		IsVideo:             isVideo,
		IsAudio:             isAudio,
		CSRFToken:           csrfToken,
		IsEncrypted:         fileMetadata.IsEncrypted,
	}

	// Serve the preview template
	h.renderTemplate(w, r, "preview.html", data, 0)
}

// isPreviewableType checks if a file can be previewed based on its mime type
func isPreviewableType(mimeType string) bool {
	return strings.HasPrefix(mimeType, "image/") ||
		strings.HasPrefix(mimeType, "video/") ||
		strings.HasPrefix(mimeType, "audio/")
}

// formatFileSize formats file size in bytes to a human-readable string
func formatFileSize(size int64) string {
	const unit = 1024
	if size < unit {
		return fmt.Sprintf("%d B", size)
	}
	div, exp := int64(unit), 0
	for n := size / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(size)/float64(div), "KMGTPE"[exp])
}

// ErrorPage renders the error page
func (h *Handler) ErrorPage(w http.ResponseWriter, r *http.Request) {
	// Generate CSRF token pair for error page
	tokens := h.csrfProtection.GenerateTokenPair()
	h.csrfProtection.SetTokenCookie(w, tokens.CookieToken)

	errMsg := r.URL.Query().Get("message")
	if errMsg == "" {
		errMsg = "An unknown error occurred"
	}

	statusCode := http.StatusBadRequest
	if codeStr := r.URL.Query().Get("code"); codeStr != "" {
		if code, err := strconv.Atoi(codeStr); err == nil && code >= 100 && code < 600 {
			statusCode = code
		}
	}

	// Prepare template data
	data := struct {
		ErrorMessage string
		StatusCode   int
		CSRFToken    string
	}{
		ErrorMessage: errMsg,
		StatusCode:   statusCode,
		CSRFToken:    tokens.FormToken,
	}

	// Render the error template
	h.renderTemplate(w, r, "error.html", data, statusCode)
}

// Helper functions
func (h *Handler) getBaseURL(r *http.Request) string {
	if h.Config.BaseURL != "" {
		return h.Config.BaseURL
	}

	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	return fmt.Sprintf("%s://%s", scheme, r.Host)
}

// Helper function to display allowed file types
func getAllowedTypesDisplay(allowedTypes []string) string {
	if len(allowedTypes) == 0 {
		return "No file types allowed"
	}

	if len(allowedTypes) == 1 && allowedTypes[0] == "*" {
		return "All file types"
	}

	return strings.Join(allowedTypes, ", ")
}

// Helper function to render error
func (h *Handler) renderError(w http.ResponseWriter, r *http.Request, errMsg string, statusCode int) {
	LogInfo("Rendering error page", map[string]interface{}{
		"error_message": errMsg,
		"status_code":   statusCode,
	})

	// Generate new CSRF token pair for error page
	tokens := h.csrfProtection.GenerateTokenPair()
	h.csrfProtection.SetTokenCookie(w, tokens.CookieToken)

	// Prepare template data
	data := struct {
		ErrorMessage string
		StatusCode   int
		CSRFToken    string
	}{
		ErrorMessage: errMsg,
		StatusCode:   statusCode,
		CSRFToken:    tokens.FormToken,
	}

	// Render the error template with the appropriate status code
	h.renderTemplate(w, r, "error.html", data, statusCode)
}

// sanitizeFilename removes potentially dangerous characters and path traversal sequences from filenames
func sanitizeFilename(filename string) string {
	// Remove any path traversal sequences
	sanitized := strings.ReplaceAll(filename, "..", "")

	// Get only the base filename without any directory components
	sanitized = filepath.Base(sanitized)

	// Limit filename length
	if len(sanitized) > 255 {
		sanitized = sanitized[:255]
	}

	// If sanitization removes everything, provide a default name
	if sanitized == "" {
		sanitized = "file"
	}

	return sanitized
}

// Terms renders the terms of service page
func (h *Handler) Terms(w http.ResponseWriter, r *http.Request) {
	h.renderTemplate(w, r, "terms.html", nil, 0)
}

// Privacy renders the privacy policy page
func (h *Handler) Privacy(w http.ResponseWriter, r *http.Request) {
	h.renderTemplate(w, r, "privacy.html", nil, 0)
}

// ServeEncryptedSample serves just the encrypted sample for key validation
func (h *Handler) ServeEncryptedSample(w http.ResponseWriter, r *http.Request) {
	// Extract file ID from URL
	fileID := chi.URLParam(r, "fileID")

	LogInfo("Serving encrypted sample requested", map[string]interface{}{
		"file_id": fileID,
		"path":    r.URL.Path,
		"query":   r.URL.RawQuery,
	})

	// Get file metadata
	fileMetadata, err := h.Storage.GetFile(fileID)
	if err != nil {
		LogError(err, "File not found when requesting sample", map[string]interface{}{
			"file_id": fileID,
		})
		h.renderError(w, r, fmt.Sprintf("File not found or expired"), http.StatusNotFound)
		return
	}

	// Check if file is encrypted and has a sample
	if !fileMetadata.IsEncrypted || len(fileMetadata.EncryptedSample) == 0 {
		LogInfo("Sample not available", map[string]interface{}{
			"file_id":      fileID,
			"is_encrypted": fileMetadata.IsEncrypted,
			"sample_size":  len(fileMetadata.EncryptedSample),
		})
		h.renderError(w, r, fmt.Sprintf("No encryption sample available for this file"), http.StatusNotFound)
		return
	}

	// Set appropriate headers
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s.sample", fileMetadata.Filename))
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(fileMetadata.EncryptedSample)))

	// Serve the sample data
	if _, err := w.Write(fileMetadata.EncryptedSample); err != nil {
		LogError(err, "Error writing sample data to response", map[string]interface{}{
			"file_id": fileID,
		})
		// Error already happened during write, so we can't send an error response
		return
	}

	LogInfo("Served encrypted sample successfully", map[string]interface{}{
		"file_id":     fileID,
		"sample_size": len(fileMetadata.EncryptedSample),
	})
}

// renderTemplate executes the template with the given name and data
// It handles errors consistently and logs any issues
func (h *Handler) renderTemplate(w http.ResponseWriter, r *http.Request, templateName string, data interface{}, statusCode int) {
	// Set default status code if not provided
	if statusCode == 0 {
		statusCode = http.StatusOK
	}

	// Set content type and status code
	w.Header().Set("Content-Type", "text/html")
	if statusCode != http.StatusOK {
		w.WriteHeader(statusCode)
	}

	// Execute the template
	if err := h.Templates.ExecuteTemplate(w, templateName, data); err != nil {
		// Log the error
		LogError(err, "Template error", map[string]interface{}{
			"template": templateName,
		})

		// Only respond with an error if we haven't already written to the response
		if statusCode == http.StatusOK {
			http.Error(w, "Error rendering template", http.StatusInternalServerError)
		}
	}
}

// validateChunkCSRF checks CSRF token leniently for chunk/finalize uploads
func (h *Handler) validateChunkCSRF(w http.ResponseWriter, r *http.Request) bool {
	csrfToken := r.FormValue("csrf_token")
	if csrfToken == "" {
		csrfToken = r.Header.Get("X-CSRF-Token")
	}

	cookie, err := r.Cookie("csrf_token")

	// Condition 1: Standard Double Submit Check
	if err == nil && csrfToken != "" && h.csrfProtection.ValidateToken(csrfToken, cookie.Value) {
		// Valid token and cookie match
		return true
	} else {
		// No valid token/cookie match - reject
		LogInfo("Invalid CSRF protection for chunk/finalize upload", map[string]interface{}{
			"ip":             r.RemoteAddr,
			"path":           r.URL.Path,
			"token_present":  csrfToken != "",
			"cookie_present": err == nil,
		})
		jsonError(w, "Invalid or missing CSRF token. Please refresh the page and try again.", http.StatusForbidden)
		return false
	}
}

// ChunkUpload handles individual chunk uploads in a chunked file upload process
func (h *Handler) ChunkUpload(w http.ResponseWriter, r *http.Request) {
	// Set a much larger chunk size limit to accommodate dynamic chunk sizing
	// 85MB limit allows for 80MB chunks plus form overhead
	chunkSizeLimit := int64(85 * 1024 * 1024)
	r.Body = http.MaxBytesReader(w, r.Body, chunkSizeLimit)

	// Parse the multipart form with chunk size limit
	if err := r.ParseMultipartForm(chunkSizeLimit); err != nil {
		LogError(err, "Error parsing multipart form in chunk upload", map[string]interface{}{
			"max_size": chunkSizeLimit,
		})
		jsonError(w, fmt.Sprintf("The uploaded chunk is too big: %v", err), http.StatusBadRequest)
		return
	}

	// Validate main CSRF token first
	if !h.validateChunkCSRF(w, r) {
		return
	}

	// Get file metadata from request
	fileID := r.FormValue("file_id")
	if fileID == "" {
		jsonError(w, "Missing file ID", http.StatusBadRequest)
		return
	}

	// Parse chunk information
	chunkIndexStr := r.FormValue("chunk_index")
	totalChunksStr := r.FormValue("total_chunks")
	fileSizeStr := r.FormValue("file_size")

	chunkIndex, err := strconv.Atoi(chunkIndexStr)
	if err != nil {
		jsonError(w, "Invalid chunk index", http.StatusBadRequest)
		return
	}

	totalChunks, err := strconv.Atoi(totalChunksStr)
	if err != nil {
		jsonError(w, "Invalid total chunks", http.StatusBadRequest)
		return
	}

	fileSize, err := strconv.ParseInt(fileSizeStr, 10, 64)
	if err != nil {
		jsonError(w, "Invalid file size", http.StatusBadRequest)
		return
	}

	// Validate file size
	if fileSize > h.Config.MaxUploadSize {
		jsonError(w, fmt.Sprintf("File too large. Maximum size is %d MB.", h.Config.MaxUploadSize/(1<<20)), http.StatusBadRequest)
		return
	}

	// --- Chunk Token Validation & Generation ---
	var initialTokens []string // For chunk 0 response
	var nextTokens []string    // For subsequent chunks

	h.chunkStatesMu.Lock() // Lock before accessing shared state

	const maxConcurrent = 3 // Hardcoding for now, ideally from config or constant

	if chunkIndex == 0 {
		// First chunk: Generate initial chunk secret and calculate tokens for the initial concurrent batch
		uploadSecret, err := utils.GenerateRandomString(32) // Handle error
		if err != nil {
			h.chunkStatesMu.Unlock()
			LogError(err, "Failed to generate upload secret", nil)
			jsonError(w, "Server error generating upload secret", http.StatusInternalServerError)
			return
		}

		numTokensToSend := totalChunks
		if numTokensToSend > 3 {
			numTokensToSend = 3
		}

		if numTokensToSend > 0 {
			initialTokens = make([]string, 0, numTokensToSend)
			for i := 1; i <= numTokensToSend; i++ {
				// Ensure we don't generate beyond totalChunks
				if i <= totalChunks {
					token := utils.GenerateHMAC(uploadSecret, fmt.Sprintf("chunk%d", i))
					initialTokens = append(initialTokens, token)
				}
			}
		}

		h.chunkStates[fileID] = &chunkState{
			NextIndex:    1, // Server still expects chunk 1 next
			UploadSecret: uploadSecret,
			LastUpdated:  time.Now(),
		}
		// nextTokens remains empty for chunk 0 response
		LogInfo("Initialized chunk state for upload", map[string]interface{}{
			"file_id":              fileID,
			"next_chunk_index":     1,
			"initial_tokens_count": len(initialTokens),
		})
	} else {
		// Subsequent chunks: Validate incoming token and index
		state, exists := h.chunkStates[fileID]
		if !exists {
			h.chunkStatesMu.Unlock()
			LogInfo("Chunk state not found for file ID", map[string]interface{}{"file_id": fileID, "chunk": chunkIndex})
			jsonError(w, "Invalid upload state or file ID.", http.StatusBadRequest)
			return
		}

		// Get token from header
		chunkToken := r.Header.Get("X-Chunk-Token")

		// --- Add Detailed Logging Inside Lock ---
		LogInfo("Backend validating chunk (inside lock)", map[string]interface{}{
			"file_id":               fileID,
			"incoming_chunk_index":  chunkIndex,
			"state_next_index":      state.NextIndex,
			"state_secret_prefix":   state.UploadSecret[:min(5, len(state.UploadSecret))] + "...", // Log prefix only
			"incoming_token_prefix": chunkToken[:min(10, len(chunkToken))] + "...",                // Log prefix only
		})
		// --------------------------------------

		// Validate token using HMAC (Removed index check to allow concurrency)
		expectedToken := utils.GenerateHMAC(state.UploadSecret, fmt.Sprintf("chunk%d", chunkIndex))
		if chunkToken != expectedToken {
			h.chunkStatesMu.Unlock()
			LogInfo("Chunk validation failed (Token mismatch)", map[string]interface{}{
				"file_id":           fileID,
				"received_index":    chunkIndex,
				"expected_index":    state.NextIndex, // Log expected index for info
				"received_token_ok": false,           // Token check failed
			})
			// Optionally delete state here?
			// delete(h.chunkStates, fileID)
			jsonError(w, fmt.Sprintf("Invalid chunk token for index %d.", chunkIndex), http.StatusForbidden)
			return
		}

		// Validation passed: Generate batch of tokens for subsequent chunks
		startIndex := chunkIndex + 1 // First token to generate is for the chunk after the current one
		endIndex := chunkIndex + 3   // Look ahead by 3 chunks
		if endIndex > totalChunks {  // Don't generate beyond the last chunk/finalize step
			endIndex = totalChunks
		}

		// Use nextTokens (plural) for the array
		nextTokens = nil // Explicitly reset the slice for this request
		if startIndex <= endIndex {
			nextTokens = make([]string, 0, endIndex-startIndex+1) // Assign to the function-scoped variable
			for i := startIndex; i <= endIndex; i++ {
				token := utils.GenerateHMAC(state.UploadSecret, fmt.Sprintf("chunk%d", i))
				nextTokens = append(nextTokens, token) // Append to the function-scoped variable
			}
		}

		// IMPORTANT: Strictly increment NextIndex only if the received chunk is the one we currently expect.
		if chunkIndex == state.NextIndex {
			state.NextIndex++ // Increment if this chunk was the expected next one
		} else {
			LogInfo("Chunk processed out of order but token was valid", map[string]interface{}{"file_id": fileID, "received_index": chunkIndex, "expected_index": state.NextIndex})
			// DO NOT increment state.NextIndex here.
		}
		state.LastUpdated = time.Now()
		LogInfo("Validated chunk and generated next batch of tokens", map[string]interface{}{
			"file_id":          fileID,
			"chunk":            chunkIndex,
			"next_chunk_index": state.NextIndex, // Log the *updated* expected index
		})
	}

	h.chunkStatesMu.Unlock() // Unlock after accessing shared state
	// ------------------------------------

	// Get file chunk from request
	file, handler, err := r.FormFile("file")
	if err != nil {
		LogError(err, "Error retrieving chunk file", map[string]interface{}{
			"form_key": "file",
			"file_id":  fileID,
			"chunk":    chunkIndex,
		})
		jsonError(w, fmt.Sprintf("Error retrieving the chunk: %v", err), http.StatusBadRequest)
		return
	}
	defer file.Close()

	// --- START SHA-256 Hash Verification ---
	clientHash := r.FormValue("chunk_hash")
	if clientHash == "" {
		LogInfo("Missing chunk hash", map[string]interface{}{"file_id": fileID, "chunk": chunkIndex})
		jsonError(w, "Missing chunk hash parameter", http.StatusBadRequest)
		return
	}

	// Create hasher
	hasher := sha256.New()

	// Create temp directory for chunks if it doesn't exist
	chunksDir := filepath.Join(os.TempDir(), "uploadfish", "chunks", fileID)
	if err := os.MkdirAll(chunksDir, 0755); err != nil {
		LogError(err, "Error creating chunks directory", map[string]interface{}{
			"file_id":    fileID,
			"chunks_dir": chunksDir,
		})
		jsonError(w, "Server error preparing chunk storage", http.StatusInternalServerError)
		return
	}

	// Prepare path for the temporary chunk file
	chunkPath := filepath.Join(chunksDir, fmt.Sprintf("chunk_%d", chunkIndex))

	// Create the temporary chunk file
	chunkFile, err := os.Create(chunkPath)
	if err != nil {
		LogError(err, "Error creating temporary chunk file", map[string]interface{}{
			"file_id":    fileID,
			"chunk":      chunkIndex,
			"chunk_path": chunkPath,
		})
		jsonError(w, "Server error saving chunk", http.StatusInternalServerError)
		return
	}

	// Create a TeeReader: Reads from 'file' (the request), writes to 'hasher' as it reads
	teeReader := io.TeeReader(file, hasher)

	// Copy data from TeeReader to the actual chunk file on disk
	// This simultaneously writes the file AND calculates the hash
	writtenBytes, err := io.Copy(chunkFile, teeReader)
	chunkFile.Close() // Close the file handle immediately after copy
	if err != nil {
		// Attempt to clean up the partial file
		os.Remove(chunkPath)
		LogError(err, "Error writing chunk data or reading from request", map[string]interface{}{
			"file_id": fileID,
			"chunk":   chunkIndex,
		})
		jsonError(w, "Error saving chunk data", http.StatusInternalServerError)
		return
	}

	// Calculate the final hash
	serverHashBytes := hasher.Sum(nil)
	serverHashHex := hex.EncodeToString(serverHashBytes)

	// Compare server hash with client hash (case-insensitive)
	if !strings.EqualFold(serverHashHex, clientHash) {
		// Hashes don't match, delete the invalid chunk file
		os.Remove(chunkPath)
		LogError(nil, "Chunk hash mismatch", map[string]interface{}{
			"file_id":     fileID,
			"chunk":       chunkIndex,
			"client_hash": clientHash[:min(10, len(clientHash))] + "...",       // Log prefix
			"server_hash": serverHashHex[:min(10, len(serverHashHex))] + "...", // Log prefix
			"bytes_read":  writtenBytes,
		})
		jsonError(w, "Chunk hash mismatch", http.StatusBadRequest)
		return
	}
	// --- END SHA-256 Hash Verification ---

	// Hash verified successfully, proceed.
	// NOTE: The code below that previously read and wrote the chunk is now removed,
	// as it was handled above with io.Copy and TeeReader.

	// If this is the first chunk, store metadata about the file
	if chunkIndex == 0 {
		// Store the filename, total chunks, and file size for later use
		metadataPath := filepath.Join(chunksDir, "metadata.json")

		// Check if encrypted
		isEncrypted := r.FormValue("encrypted") == "true"

		// Get encrypted sample if available
		var encryptedSample []byte
		if isEncrypted {
			sampleBase64 := r.FormValue("encrypted_sample")
			if sampleBase64 != "" {
				// Decode base64 to bytes
				var err error
				encryptedSample, err = utils.Base64Decode(sampleBase64)
				if err != nil {
					LogError(err, "Error decoding encrypted sample", nil)
					// Continue without sample, not critical
				} else {
					LogInfo("Received encrypted sample for validation", map[string]interface{}{
						"sample_size": len(encryptedSample),
					})
				}
			}
		}

		metadata := map[string]interface{}{
			"filename":     handler.Filename,
			"total_chunks": totalChunks,
			"file_size":    fileSize,
			"content_type": handler.Header.Get("Content-Type"),
			"is_encrypted": isEncrypted,
			"expiry":       r.FormValue("expiry"),
			"upload_time":  time.Now().Format(time.RFC3339),
		}

		// Store encrypted sample if provided
		if len(encryptedSample) > 0 {
			// Save sample to a separate file
			samplePath := filepath.Join(chunksDir, "encrypted_sample")
			if err := os.WriteFile(samplePath, encryptedSample, 0644); err != nil {
				LogError(err, "Error writing encrypted sample to disk", map[string]interface{}{
					"file_id":     fileID,
					"sample_size": len(encryptedSample),
				})
				// Continue without saving sample, not critical
			}
		}

		metadataJSON, err := json.Marshal(metadata)
		if err != nil {
			LogError(err, "Error marshaling metadata", map[string]interface{}{
				"file_id": fileID,
			})
			jsonError(w, "Server error storing metadata", http.StatusInternalServerError)
			return
		}

		if err := os.WriteFile(metadataPath, metadataJSON, 0644); err != nil {
			LogError(err, "Error writing metadata to disk", map[string]interface{}{
				"file_id":       fileID,
				"metadata_path": metadataPath,
			})
			jsonError(w, "Server error storing metadata", http.StatusInternalServerError)
			return
		}
	}

	LogInfo("Chunk uploaded successfully", map[string]interface{}{
		"file_id": fileID,
		"chunk":   chunkIndex,
		"total":   totalChunks,
	})

	// Return success response
	respData := map[string]interface{}{
		"status":      "success",
		"file_id":     fileID,
		"chunk_index": chunkIndex,
	}
	// Add appropriate token(s) to response
	if chunkIndex == 0 && len(initialTokens) > 0 {
		respData["initial_chunk_tokens"] = initialTokens
	} else if len(nextTokens) > 0 { // Check the slice for subsequent chunks
		respData["next_chunk_tokens"] = nextTokens // Return the array
	}
	jsonResponse(w, respData)
}

// FinalizeUpload combines all chunks and completes the upload
func (h *Handler) FinalizeUpload(w http.ResponseWriter, r *http.Request) {
	// Validate CSRF leniently for finalize uploads
	if !h.validateChunkCSRF(w, r) {
		return
	}

	// Get file ID
	fileID := r.FormValue("file_id")
	if fileID == "" {
		jsonError(w, "Missing file ID", http.StatusBadRequest)
		return
	}

	// Get chunks directory
	chunksDir := filepath.Join(os.TempDir(), "uploadfish", "chunks", fileID)
	if _, err := os.Stat(chunksDir); os.IsNotExist(err) {
		LogError(err, "Chunks directory not found", map[string]interface{}{
			"file_id":    fileID,
			"chunks_dir": chunksDir,
		})
		jsonError(w, "No chunks found for this file ID", http.StatusBadRequest)
		return
	}

	// Read metadata file
	metadataPath := filepath.Join(chunksDir, "metadata.json")
	metadataBytes, err := os.ReadFile(metadataPath)
	if err != nil {
		LogError(err, "Error reading metadata file", map[string]interface{}{
			"file_id":       fileID,
			"metadata_path": metadataPath,
		})
		jsonError(w, "Error reading upload metadata", http.StatusInternalServerError)
		return
	}

	// Parse metadata
	var metadata map[string]interface{}
	if err := json.Unmarshal(metadataBytes, &metadata); err != nil {
		LogError(err, "Error parsing metadata", map[string]interface{}{
			"file_id": fileID,
		})
		jsonError(w, "Error parsing upload metadata", http.StatusInternalServerError)
		return
	}

	// Extract required metadata
	filename, _ := metadata["filename"].(string)
	totalChunksFloat, _ := metadata["total_chunks"].(float64)
	totalChunks := int(totalChunksFloat)
	fileSizeFloat, _ := metadata["file_size"].(float64)
	fileSize := int64(fileSizeFloat)
	contentType, _ := metadata["content_type"].(string)
	isEncryptedValue, _ := metadata["is_encrypted"].(bool)
	expiryValue, _ := metadata["expiry"].(string)

	// Validate content type if available
	if contentType != "" {
		if err := validateContentType(contentType, h.Config.AllowedTypes); err != nil {
			LogError(err, "Invalid content type", map[string]interface{}{
				"file_id":      fileID,
				"content_type": contentType,
			})
			jsonError(w, err.Error(), http.StatusBadRequest)
			return
		}
	}

	// --- Validate Final Chunk Token ---
	h.chunkStatesMu.Lock() // Lock before accessing shared state

	state, exists := h.chunkStates[fileID]
	if !exists {
		h.chunkStatesMu.Unlock()
		LogInfo("Chunk state not found during finalize", map[string]interface{}{"file_id": fileID})
		jsonError(w, "Invalid upload state or file ID.", http.StatusBadRequest)
		return
	}

	// Get the final token from the header
	finalChunkToken := r.Header.Get("X-Chunk-Token")

	// Validate token and ensure all chunks were processed (Removed index check)
	// Recalculate the expected token for the final chunk
	expectedToken := utils.GenerateHMAC(state.UploadSecret, fmt.Sprintf("chunk%d", totalChunks))
	if finalChunkToken != expectedToken {
		h.chunkStatesMu.Unlock()
		LogInfo("Final chunk token validation failed (Token mismatch)", map[string]interface{}{
			"file_id":           fileID,
			"final_token_ok":    false,
			"expected_index":    totalChunks,
			"actual_next_index": state.NextIndex, // Log state for info
		})
		// Delete invalid state to prevent reuse
		delete(h.chunkStates, fileID)
		jsonError(w, fmt.Sprintf("Invalid finalization token (expected %d chunks).", totalChunks), http.StatusForbidden)
		return
	}

	// Validation passed, remove the state entry
	delete(h.chunkStates, fileID)
	h.chunkStatesMu.Unlock() // Unlock after accessing shared state
	LogInfo("Final chunk token validated, proceeding with finalize", map[string]interface{}{
		"file_id": fileID,
	})
	// ------------------------------------

	// Prepare to open chunks for streaming
	var chunkFiles []*os.File
	var chunkReaders []io.Reader // Restore chunkReaders slice

	// Open all chunk files
	for i := 0; i < totalChunks; i++ {
		chunkPath := filepath.Join(chunksDir, fmt.Sprintf("chunk_%d", i))
		file, err := os.Open(chunkPath)
		if err != nil {
			// Clean up already opened files before returning error
			for _, f := range chunkFiles {
				_ = f.Close()
			}
			LogError(err, "Error opening chunk file for streaming", map[string]interface{}{
				"file_id":    fileID,
				"chunk":      i,
				"chunk_path": chunkPath,
			})
			jsonError(w, fmt.Sprintf("Error reading chunk %d", i), http.StatusInternalServerError)
			return
		}
		chunkFiles = append(chunkFiles, file)
		chunkReaders = append(chunkReaders, file) // Add file (as io.Reader) to chunkReaders
	}

	// Ensure all opened chunk files are closed eventually
	defer func() {
		for _, f := range chunkFiles {
			_ = f.Close()
		}
	}()

	// Create a MultiReader to stream from all chunks sequentially
	multiReader := io.MultiReader(chunkReaders...) // Pass chunkReaders slice

	// Parse expiry option
	var expiryTime time.Time
	if expiryValue != "when_downloaded" {
		expiryDuration := models.ParseExpiryDuration(expiryValue)
		expiryTime = time.Now().Add(expiryDuration)
	} // else leave expiryTime as zero for "when_downloaded"

	// Check for encrypted sample if the file is encrypted
	var encryptedSample []byte
	if isEncryptedValue {
		samplePath := filepath.Join(chunksDir, "encrypted_sample")
		if sampleData, err := os.ReadFile(samplePath); err == nil {
			encryptedSample = sampleData
			LogInfo("Retrieved encrypted sample from chunked upload", map[string]interface{}{
				"file_id":     fileID,
				"sample_size": len(encryptedSample),
			})
		} else {
			LogError(err, "No encrypted sample found, continuing without", map[string]interface{}{
				"file_id": fileID,
			})
		}
	}

	// Create the file metadata
	fileMetadata := &models.File{
		ID:              fileID,
		Filename:        sanitizeFilename(filename),
		MimeType:        contentType,
		Size:            fileSize,
		UploadTime:      time.Now(),
		ExpiryValue:     expiryValue, // Store raw value
		ExpiryTime:      expiryTime,  // Store calculated time (or zero)
		IsEncrypted:     isEncryptedValue,
		EncryptedSample: encryptedSample,
	}

	// Save to storage using the MultiReader for content
	if err := h.Storage.SaveFile(fileMetadata, multiReader); err != nil {
		LogError(err, "Error saving file via streaming", map[string]interface{}{
			"file_id":   fileMetadata.ID,
			"file_size": fileMetadata.Size,
		})
		jsonError(w, fmt.Sprintf("Error saving file: %v", err), http.StatusInternalServerError)
		return
	}

	LogInfo("File upload finalized successfully", map[string]interface{}{
		"filename":  fileMetadata.Filename,
		"size":      fileMetadata.Size,
		"mime_type": fileMetadata.MimeType,
		"file_id":   fileMetadata.ID,
	})

	// Clean up chunks directory synchronously
	if err := os.RemoveAll(chunksDir); err != nil {
		LogError(err, "Error cleaning up chunks directory", map[string]interface{}{
			"file_id":    fileID,
			"chunks_dir": chunksDir,
		})
	}

	// Return success with redirect URL
	previewURL := fmt.Sprintf("%s/file/%s", h.getBaseURL(r), fileMetadata.ID)
	jsonResponse(w, map[string]interface{}{
		"status":       "success",
		"file_id":      fileID,
		"redirect_url": previewURL,
	})
}

// Helper function to return JSON error responses
func jsonError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "error",
		"message": message,
	})
}

// Helper function to return JSON success responses
func jsonResponse(w http.ResponseWriter, data map[string]interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}
