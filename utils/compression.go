package utils

import (
	"bytes"
	"compress/gzip"
	"encoding/base64"
	"io"
	"strings"
)

// Compress compresses data using gzip with best compression level
func Compress(data []byte) ([]byte, error) {
	var b bytes.Buffer
	gz, err := gzip.NewWriterLevel(&b, gzip.BestCompression)
	if err != nil {
		return nil, err
	}
	if _, err := gz.Write(data); err != nil {
		return nil, err
	}
	if err := gz.Close(); err != nil {
		return nil, err
	}
	return b.Bytes(), nil
}

// Decompress decompresses gzipped data
func Decompress(data []byte) ([]byte, error) {
	b := bytes.NewReader(data)
	gz, err := gzip.NewReader(b)
	if err != nil {
		return nil, err
	}
	defer gz.Close()
	return io.ReadAll(gz)
}

// Base64Encode encodes data to URL-safe base64
func Base64Encode(data []byte) string {
	encoded := base64.StdEncoding.EncodeToString(data)
	// Make URL safe
	return strings.ReplaceAll(strings.ReplaceAll(encoded, "+", "-"), "/", "_")
}

// Base64Decode decodes URL-safe base64 to bytes
func Base64Decode(encoded string) ([]byte, error) {
	// Restore standard base64
	standardBase64 := strings.ReplaceAll(strings.ReplaceAll(encoded, "-", "+"), "_", "/")

	// Add padding if needed
	switch len(standardBase64) % 4 {
	case 2:
		standardBase64 += "=="
	case 3:
		standardBase64 += "="
	}

	return base64.StdEncoding.DecodeString(standardBase64)
}
