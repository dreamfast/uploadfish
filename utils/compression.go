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
	// Use the standard library's URL-safe encoding
	return base64.URLEncoding.EncodeToString(data)
}

// Base64Decode decodes standard base64 to bytes (Reverted from URL-safe)
func Base64Decode(encoded string) ([]byte, error) {
	// Restore standard base64 characters if they were URL-encoded (though input is expected to be standard)
	standardBase64 := strings.ReplaceAll(strings.ReplaceAll(encoded, "-", "+"), "_", "/")

	// Add padding if needed for standard decoding
	switch len(standardBase64) % 4 {
	case 2:
		standardBase64 += "=="
	case 3:
		standardBase64 += "="
	}

	// Use standard decoder
	return base64.StdEncoding.DecodeString(standardBase64)
}
