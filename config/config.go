package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds the application configuration
type Config struct {
	Port             string
	BaseURL          string
	MaxUploadSize    int64
	AllowedTypes     []string
	BitcaskPath      string
	CleanupInterval  time.Duration
	RateLimit        int
	RateLimitWindow  time.Duration
	RateLimitCleanup time.Duration
	CSRFExpiration   time.Duration
}

// New creates a new configuration with defaults and environment overrides
func New() *Config {
	// Default configuration
	cfg := &Config{
		Port:             getEnv("PORT", "8085"),
		BaseURL:          getEnv("BASE_URL", ""),
		MaxUploadSize:    getEnvAsInt64("MAX_UPLOAD_SIZE", 1073741824), // 1GB default (1024MB)
		AllowedTypes:     getEnvAsStringSlice("ALLOWED_TYPES", "*"),
		BitcaskPath:      getEnv("BITCASK_PATH", "data"),
		CleanupInterval:  getEnvAsDuration("CLEANUP_INTERVAL", 1*time.Minute),
		RateLimit:        getEnvAsInt("RATE_LIMIT", 60),                         // 60 requests per window
		RateLimitWindow:  getEnvAsDuration("RATE_LIMIT_WINDOW", 1*time.Minute),  // 1 minute window
		RateLimitCleanup: getEnvAsDuration("RATE_LIMIT_CLEANUP", 5*time.Minute), // Clean up every 5 minutes
		CSRFExpiration:   getEnvAsDuration("CSRF_EXPIRATION", 1*time.Hour),      // CSRF tokens expire after 1 hour
	}

	// Override with environment variables if available
	if envPort := os.Getenv("PORT"); envPort != "" {
		cfg.Port = envPort
	}

	if envBaseURL := os.Getenv("BASE_URL"); envBaseURL != "" {
		cfg.BaseURL = envBaseURL
	}

	if envMaxSize := os.Getenv("MAX_UPLOAD_SIZE"); envMaxSize != "" {
		if maxSize, err := strconv.ParseInt(envMaxSize, 10, 64); err == nil {
			cfg.MaxUploadSize = maxSize
		}
	}

	if envTypes := os.Getenv("ALLOWED_TYPES"); envTypes != "" {
		cfg.AllowedTypes = strings.Split(envTypes, ",")
	}

	return cfg
}

// Helper functions for environment variables
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsStringSlice(key string, defaultValue string) []string {
	if value := os.Getenv(key); value != "" {
		return strings.Split(value, ",")
	}
	return []string{defaultValue}
}

func getEnvAsDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
