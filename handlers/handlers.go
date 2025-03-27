package handlers

import (
	"fmt"
	"html/template"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"uploadfish/config"
	"uploadfish/models"
	"uploadfish/storage"
	"uploadfish/utils"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// Handler contains all the dependencies for the handlers
type Handler struct {
	Config         *config.Config
	Templates      *template.Template
	Storage        *storage.Storage
	csrfProtection *utils.CSRFProtection
}

// New creates a new Handler with the given configuration
func New(cfg *config.Config, store *storage.Storage, csrfProtection *utils.CSRFProtection) *Handler {
	// Parse templates
	tmpl := template.Must(template.ParseGlob("templates/*.html"))

	return &Handler{
		Config:         cfg,
		Templates:      tmpl,
		Storage:        store,
		csrfProtection: csrfProtection,
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

	w.Header().Set("Content-Type", "text/html")
	if err := h.Templates.ExecuteTemplate(w, "index.html", data); err != nil {
		http.Error(w, "Error rendering template", http.StatusInternalServerError)
		LogError(err, "Template error", map[string]interface{}{
			"template": "index.html",
		})
	}
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
		h.renderError(w, fmt.Sprintf("The uploaded file is too big. Please choose a file that's less than %d MB.", h.Config.MaxUploadSize/(1<<20)), http.StatusBadRequest)
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
		h.renderError(w, fmt.Sprintf("Error retrieving the file: %v", err), http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Process and validate file
	fileMetadata, err := h.processUploadedFile(file, handler, r)
	if err != nil {
		h.renderError(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Save to storage
	if err := h.Storage.SaveFile(fileMetadata); err != nil {
		LogError(err, "Error saving file", map[string]interface{}{
			"file_id":   fileMetadata.ID,
			"file_size": fileMetadata.Size,
		})
		h.renderError(w, fmt.Sprintf("Error saving file: %v", err), http.StatusInternalServerError)
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
		h.renderError(w, "Invalid or missing CSRF token, try refreshing the page.", http.StatusForbidden)
		return false
	}

	if csrfToken == "" || !h.csrfProtection.ValidateToken(csrfToken, cookie.Value) {
		LogInfo("Invalid or missing CSRF token", map[string]interface{}{
			"ip": r.RemoteAddr,
		})
		h.renderError(w, "Invalid or missing CSRF token, try refreshing the page.", http.StatusForbidden)
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
	validExpiryValues := map[string]bool{"1h": true, "6h": true, "24h": true, "72h": true}
	if !validExpiryValues[expiryValue] {
		LogInfo("Invalid expiry value provided, using default", map[string]interface{}{
			"provided_expiry": expiryValue,
			"default_expiry":  "1h",
		})
		expiryValue = "1h" // Default to 1 hour if invalid
	}

	expiryDuration := models.ParseExpiryDuration(expiryValue)
	expiryTime := time.Now().Add(expiryDuration)

	// Check if the file is encrypted client-side
	isEncrypted := false
	encryptedValue := r.FormValue("encrypted")
	if encryptedValue == "true" {
		isEncrypted = true
		LogInfo("File is encrypted client-side", nil)
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

	// Read file content
	content, err := io.ReadAll(file)
	if err != nil {
		LogError(err, "Error reading file content", nil)
		return nil, fmt.Errorf("error reading file: %v", err)
	}

	// Create file metadata
	return &models.File{
		ID:          fileID,
		Filename:    sanitizeFilename(handler.Filename),
		MimeType:    contentType,
		Size:        int64(len(content)),
		UploadTime:  time.Now(),
		ExpiryTime:  expiryTime,
		Content:     content,
		IsEncrypted: isEncrypted,
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
	id := chi.URLParam(r, "id")

	// Get file metadata from storage
	fileMetadata, err := h.Storage.GetFile(id)
	if err != nil {
		h.renderError(w, "File not found or has expired", http.StatusNotFound)
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

		h.renderError(w, "This file has expired and is no longer available", http.StatusGone)
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
	// Get file content
	content, err := storage.GetFileContent(fileMetadata.ID)
	if err != nil {
		http.Error(w, "Error retrieving file content", http.StatusInternalServerError)
		return
	}

	// Add cache control headers for better performance
	w.Header().Set("Cache-Control", "public, max-age=86400")

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

	// Write the content directly to the response
	if _, err := w.Write(content); err != nil {
		// Can't send error response here since we've already started writing the response
		LogError(err, "Error writing file content to response", map[string]interface{}{
			"file_id": fileMetadata.ID,
			"size":    fileMetadata.Size,
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
		FileURL:             fileURL,
		ShareURL:            shareURL,
		IsPreviewable:       isPreviewable,
		IsImage:             isImage,
		IsVideo:             isVideo,
		IsAudio:             isAudio,
		CSRFToken:           h.csrfProtection.GenerateToken(),
		IsEncrypted:         fileMetadata.IsEncrypted,
	}

	// Serve the preview template
	w.Header().Set("Content-Type", "text/html")
	if err := h.Templates.ExecuteTemplate(w, "preview.html", data); err != nil {
		LogError(err, "Error rendering preview page", nil)
		http.Error(w, "Error rendering preview page", http.StatusInternalServerError)
		return
	}
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

	// Set content type and status code
	w.Header().Set("Content-Type", "text/html")
	w.WriteHeader(statusCode)

	// Execute the error template
	if err := h.Templates.ExecuteTemplate(w, "error.html", data); err != nil {
		// Fallback to basic error if template fails
		LogError(err, "Error template failed", map[string]interface{}{
			"template": "error.html",
		})
		http.Error(w, fmt.Sprintf("Error: %s", errMsg), statusCode)
	}
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
func (h *Handler) renderError(w http.ResponseWriter, errMsg string, statusCode int) {
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

	// Set content type and status code
	w.Header().Set("Content-Type", "text/html")
	w.WriteHeader(statusCode)

	// Execute the error template
	if err := h.Templates.ExecuteTemplate(w, "error.html", data); err != nil {
		// Fallback to basic error if template fails
		LogError(err, "Error template failed", map[string]interface{}{
			"template": "error.html",
		})
		http.Error(w, fmt.Sprintf("Error: %s", errMsg), statusCode)
	}
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
