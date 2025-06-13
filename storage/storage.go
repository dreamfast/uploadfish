package storage

import (
	"bytes"
	"fmt"
	"io"
	"math"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/klauspost/compress/gzip"
	"github.com/prologic/bitcask"

	"uploadfish/config"
	"uploadfish/models"
)

// Logger interface defines the logging methods needed by the storage package
type Logger interface {
	Error(err error, message string, fields map[string]interface{})
	Info(message string, fields map[string]interface{})
}

const (
	// Prefix for content entries in BitCask
	contentPrefix = "content:" // Keep as string for now, byte conversion is explicit
	// Prefix for metadata entries in BitCask
	metadataPrefix = "meta:" // Keep as string for now
)

// Storage handles file metadata persistence and cleanup
type Storage struct {
	db        *bitcask.Bitcask
	config    *config.Config
	mutex     sync.RWMutex
	closeOnce sync.Once
	logger    Logger
}

// New creates a new storage instance
func New(cfg *config.Config, logger Logger) (*Storage, error) {
	// Ensure the data directory exists
	if err := os.MkdirAll(cfg.BitcaskPath, 0750); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	// Calculate max value size based on max upload size plus some overhead for compression
	if cfg.MaxUploadSize > math.MaxInt64-1024*1024 {
		return nil, fmt.Errorf("max upload size is too large, would cause overflow")
	}
	maxValueSize := uint64(cfg.MaxUploadSize + 1024*1024) // Add 1MB for overhead

	// Open the BitCask database with increased max value size
	db, err := bitcask.Open(
		cfg.BitcaskPath,
		bitcask.WithSync(true),
		bitcask.WithMaxValueSize(maxValueSize),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to open BitCask database: %w", err)
	}

	// Create storage instance
	s := &Storage{
		db:     db,
		config: cfg,
		logger: logger,
	}

	// Start cleanup routine
	go s.startCleanupRoutine()

	return s, nil
}

// SaveFile saves file metadata and streams content to the database
func (s *Storage) SaveFile(fileMetadata *models.File, contentReader io.Reader) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Generate UUID if not set
	if fileMetadata.ID == "" {
		fileMetadata.ID = uuid.New().String()
	}

	// Set upload time if not set
	if fileMetadata.UploadTime.IsZero() {
		fileMetadata.UploadTime = time.Now()
	}

	// Convert metadata to JSON
	metadataKey := []byte(metadataPrefix + fileMetadata.ID)
	metadataValue, err := fileMetadata.ToJSON()
	if err != nil {
		return fmt.Errorf("failed to marshal file metadata: %w", err)
	}

	// Save metadata to database
	if err := s.db.Put(metadataKey, metadataValue); err != nil {
		return fmt.Errorf("failed to save file metadata: %w", err)
	}

	// Save content by streaming and compressing
	if contentReader != nil {
		contentKey := []byte(contentPrefix + fileMetadata.ID)

		// Use a pipe to connect the gzip writer to an io.Reader for Bitcask
		// Alternatively, buffer in memory if Bitcask needs a byte slice.
		// Let's buffer for simplicity with Bitcask Put, but acknowledge this
		// still uses memory proportional to the *compressed* size.
		var compressedBuf bytes.Buffer
		gz := gzip.NewWriter(&compressedBuf)

		// Copy from the source reader, through gzip, into the buffer
		written, err := io.Copy(gz, contentReader)
		if err != nil {
			_ = s.db.Delete(metadataKey) // Rollback metadata
			return fmt.Errorf("failed during file content compression: %w", err)
		}
		if err := gz.Close(); err != nil { // Important: Close gzip writer
			_ = s.db.Delete(metadataKey)
			return fmt.Errorf("failed to compress file content: %w", err)
		}

		s.logger.Info("Compressed content stream", map[string]interface{}{
			"file_id":               fileMetadata.ID,
			"original_size":         fileMetadata.Size, // Assuming this was set correctly before calling
			"compressed_size":       compressedBuf.Len(),
			"bytes_written_to_gzip": written,
		})

		// Save compressed content buffer to database
		if err := s.db.Put(contentKey, compressedBuf.Bytes()); err != nil {
			// Try to delete metadata if content save fails
			_ = s.db.Delete(metadataKey)
			return fmt.Errorf("failed to save file content: %w", err)
		}
	}

	return nil
}

// GetFile retrieves file metadata by ID
func (s *Storage) GetFile(id string) (*models.File, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	// Get metadata from database
	metadataKey := []byte(metadataPrefix + id)
	data, err := s.db.Get(metadataKey)
	if err != nil {
		return nil, fmt.Errorf("failed to get file metadata: %w", err)
	}

	// Parse JSON
	file := &models.File{}
	if err := file.FromJSON(data); err != nil {
		return nil, fmt.Errorf("failed to unmarshal file metadata: %w", err)
	}

	return file, nil
}

// GetFileContentStream retrieves a reader for the decompressed file content by ID.
// The caller is responsible for closing the returned io.ReadCloser.
// This reads the compressed data into memory but streams the decompression.
func (s *Storage) GetFileContentStream(id string) (io.ReadCloser, error) {
	s.mutex.RLock() // Lock for reading from DB
	// Get compressed content from database
	contentKey := []byte(contentPrefix + id)
	compressedData, err := s.db.Get(contentKey)
	s.mutex.RUnlock() // Unlock BEFORE returning the reader

	if err != nil {
		if err == bitcask.ErrKeyNotFound {
			return nil, err // Return specific error for not found
		}
		return nil, fmt.Errorf("failed to get file content stream: %w", err)
	}

	// Create a reader for the compressed data
	compressedReader := bytes.NewReader(compressedData)

	// Create a gzip reader to decompress on the fly
	gzReader, err := gzip.NewReader(compressedReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create gzip reader: %w", err)
	}

	// gzReader is an io.ReadCloser, return it directly
	return gzReader, nil
}

// DeleteFile removes file metadata and content
func (s *Storage) DeleteFile(id string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Delete metadata
	metadataKey := []byte(metadataPrefix + id)
	if err := s.db.Delete(metadataKey); err != nil && err != bitcask.ErrKeyNotFound {
		return fmt.Errorf("failed to delete file metadata: %w", err)
	}

	// Delete content
	contentKey := []byte(contentPrefix + id)
	if err := s.db.Delete(contentKey); err != nil && err != bitcask.ErrKeyNotFound {
		return fmt.Errorf("failed to delete file content: %w", err)
	}

	return nil
}

// ListExpiredFiles returns a list of file IDs that have expired
func (s *Storage) ListExpiredFiles() ([]string, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	var expiredIDs []string
	now := time.Now()

	// Iterate over all keys with metadata prefix
	err := s.db.Scan([]byte(metadataPrefix), func(key []byte) error {
		// Get the file metadata
		data, err := s.db.Get(key)
		if err != nil {
			// Log error getting data but continue scan
			s.logger.Error(err, "Failed to get metadata during expired scan", map[string]interface{}{"key": string(key)})
			return nil // Continue with next key
		}

		// Parse the metadata
		file := &models.File{}
		if err := file.FromJSON(data); err != nil {
			// Log error parsing data but continue scan
			s.logger.Error(err, "Failed to parse metadata during expired scan", map[string]interface{}{"key": string(key)})
			return nil // Continue with next key
		}

		// Check if expired
		if !file.ExpiryTime.IsZero() && file.ExpiryTime.Before(now) {
			// Extract ID from key (remove prefix)
			id := string(key)[len(metadataPrefix):]
			expiredIDs = append(expiredIDs, id)
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("error scanning for expired files: %w", err)
	}

	return expiredIDs, nil
}

// CleanupExpiredFiles deletes files that have expired. If any files are deleted,
// it will trigger a database merge to reclaim disk space.
func (s *Storage) CleanupExpiredFiles() error {
	s.logger.Info("Starting cleanup of expired files", nil)
	expiredIDs, err := s.ListExpiredFiles()
	if err != nil {
		return fmt.Errorf("error listing expired files: %w", err)
	}

	// Delete each expired file
	for _, id := range expiredIDs {
		if err := s.DeleteFile(id); err != nil {
			s.logger.Error(err, "Error deleting expired file", map[string]interface{}{
				"file_id": id,
			})
			// Continue with next file even if this one fails
		}
	}

	if len(expiredIDs) > 0 {
		s.logger.Info("Finished cleanup of expired files", map[string]interface{}{"count": len(expiredIDs)})
		// After cleaning up files, trigger a merge to reclaim space.
		if err := s.Merge(); err != nil {
			// Log the error, but don't return it as the primary task was successful
			s.logger.Error(err, "Error during post-cleanup merge", nil)
		}
	}

	return nil
}

// Merge triggers a database merge to reclaim disk space
func (s *Storage) Merge() error {
	s.logger.Info("Starting database merge", nil)
	start := time.Now()
	if err := s.db.Merge(); err != nil {
		s.logger.Error(err, "Failed to merge database", nil)
		return fmt.Errorf("failed to merge database: %w", err)
	}
	duration := time.Since(start)
	s.logger.Info("Finished database merge", map[string]interface{}{"duration": duration.String()})

	return nil
}

// Stats returns statistics about the database.
func (s *Storage) Stats() (bitcask.Stats, error) {
	return s.db.Stats()
}

// startCleanupRoutine starts a background goroutine to clean up expired files
func (s *Storage) startCleanupRoutine() {
	ticker := time.NewTicker(s.config.CleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		if err := s.CleanupExpiredFiles(); err != nil {
			s.logger.Error(err, "Error during cleanup", nil)
		}
	}
}

// Close closes the database
func (s *Storage) Close() error {
	var err error
	s.closeOnce.Do(func() {
		err = s.db.Close()
	})
	return err
}
