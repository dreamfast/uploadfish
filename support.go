package main

import (
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// Logger is a global variable that holds the structured logger instance
var Logger zerolog.Logger

// InitLogger initializes the structured logger
// Should be called early in your application startup
func InitLogger() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	zerolog.SetGlobalLevel(zerolog.InfoLevel)

	// Use pretty console logging in development
	if os.Getenv("ENV") != "production" {
		consoleWriter := zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}
		Logger = zerolog.New(consoleWriter).With().Timestamp().Caller().Logger()
	} else {
		// In production, use JSON logging
		Logger = zerolog.New(os.Stdout).With().Timestamp().Logger()
	}

	// Set the global logger
	log.Logger = Logger
}

// LogHTTPRequest logs HTTP request details in a structured format
// Can be used outside the middleware context when needed
func LogHTTPRequest(r *http.Request, status, bytes int, latency time.Duration) {
	path := r.URL.Path
	if r.URL.RawQuery != "" {
		path = path + "?" + r.URL.RawQuery
	}

	// Extract client IP from headers
	clientIP := r.RemoteAddr
	if forwardedFor := r.Header.Get("X-Forwarded-For"); forwardedFor != "" {
		clientIP = strings.Split(forwardedFor, ",")[0]
	}

	// Log the request with structured fields
	log := Logger.Info().
		Str("method", r.Method).
		Str("path", path).
		Int("status", status).
		Int64("latency_ms", latency.Milliseconds()).
		Str("ip", clientIP).
		Str("user_agent", r.UserAgent())

	// Add content length if available
	if bytes > 0 {
		log = log.Int("bytes", bytes)
	}

	log.Msg("Request processed")
}

// LogError logs an error with additional context
func LogError(err error, message string, fields map[string]interface{}) {
	if err == nil {
		return
	}

	event := Logger.Error().Err(err).Str("message", message)

	for key, value := range fields {
		switch v := value.(type) {
		case string:
			event = event.Str(key, v)
		case int:
			event = event.Int(key, v)
		case bool:
			event = event.Bool(key, v)
		case float64:
			event = event.Float64(key, v)
		case time.Time:
			event = event.Time(key, v)
		case time.Duration:
			event = event.Dur(key, v)
		default:
			event = event.Interface(key, v)
		}
	}

	event.Msg("Error occurred")
}

// LogInfo logs an informational message with additional context
func LogInfo(message string, fields map[string]interface{}) {
	event := Logger.Info().Str("message", message)

	for key, value := range fields {
		switch v := value.(type) {
		case string:
			event = event.Str(key, v)
		case int:
			event = event.Int(key, v)
		case bool:
			event = event.Bool(key, v)
		case float64:
			event = event.Float64(key, v)
		case time.Time:
			event = event.Time(key, v)
		case time.Duration:
			event = event.Dur(key, v)
		default:
			event = event.Interface(key, v)
		}
	}

	event.Msg("Info")
}

// LogDebug logs a debug message with additional context
func LogDebug(message string, fields map[string]interface{}) {
	event := Logger.Debug().Str("message", message)

	for key, value := range fields {
		switch v := value.(type) {
		case string:
			event = event.Str(key, v)
		case int:
			event = event.Int(key, v)
		case bool:
			event = event.Bool(key, v)
		case float64:
			event = event.Float64(key, v)
		case time.Time:
			event = event.Time(key, v)
		case time.Duration:
			event = event.Dur(key, v)
		default:
			event = event.Interface(key, v)
		}
	}

	event.Msg("Debug")
}

// SetLogLevel sets the global log level
func SetLogLevel(level string) error {
	lvl, err := zerolog.ParseLevel(level)
	if err != nil {
		return errors.New("invalid log level: " + level)
	}

	zerolog.SetGlobalLevel(lvl)
	return nil
}
