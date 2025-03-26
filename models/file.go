package models

import (
	"encoding/json"
	"time"
)

// ExpiryOption represents the available expiry time options
type ExpiryOption struct {
	Label       string `json:"label"`
	Description string `json:"description"`
	Value       string `json:"value"`
}

// GetExpiryOptions returns the available expiry options
func GetExpiryOptions() []ExpiryOption {
	return []ExpiryOption{
		{Label: "1 Hour", Description: "Delete after 1 hour", Value: "1h"},
		{Label: "6 Hours", Description: "Delete after 6 hours", Value: "6h"},
		{Label: "24 Hours", Description: "Delete after 24 hours", Value: "24h"},
		{Label: "3 Days", Description: "Delete after 3 days", Value: "72h"},
	}
}

// ParseExpiryDuration parses an expiry option value to its duration
// Only accepts the predefined values: "1h", "6h", "24h", "72h"
// Any other value will result in the default duration (24 hours)
func ParseExpiryDuration(value string) time.Duration {
	// Default: 24 hours
	duration := 24 * time.Hour

	switch value {
	case "1h":
		duration = 1 * time.Hour
	case "6h":
		duration = 6 * time.Hour
	case "24h":
		duration = 24 * time.Hour
	case "72h":
		duration = 72 * time.Hour
	default:
		// Log unexpected values for monitoring
		// This should not happen as values should be validated before calling this function
		duration = 24 * time.Hour
	}

	return duration
}

// File represents the metadata for an uploaded file
type File struct {
	ID         string    `json:"id"`                // UUID for the file
	Filename   string    `json:"filename"`          // Original filename
	MimeType   string    `json:"mime_type"`         // Content type of the file
	Size       int64     `json:"size"`              // Size of the file in bytes
	UploadTime time.Time `json:"upload_time"`       // When the file was uploaded
	ExpiryTime time.Time `json:"expiry_time"`       // When the file will expire
	Content    []byte    `json:"content,omitempty"` // Compressed file content
}

// ToJSON converts the file metadata to JSON
func (f *File) ToJSON() ([]byte, error) {
	return json.Marshal(f)
}

// FromJSON parses JSON data into the file metadata
func (f *File) FromJSON(data []byte) error {
	return json.Unmarshal(data, f)
}
