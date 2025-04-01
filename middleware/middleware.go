package middleware

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"runtime"
	"strings"
	"time"

	"uploadfish/utils"

	"github.com/go-chi/chi/v5/middleware"
)

// Define custom type for context keys to avoid collisions
type contextKey string

// Define constants for context keys
const (
	contextKeyCSPNonce  contextKey = "csp-nonce"
	contextKeyRequestID contextKey = "request-id"
)

// Logger functions - these need to be initialized from main package
var LogInfo func(message string, fields map[string]interface{})
var LogError func(err error, message string, fields map[string]interface{})
var LogDebug func(message string, fields map[string]interface{}) // Assuming Debug might be needed too

// --- Custom Middleware Functions ---

// LoggingMiddleware logs request details using the structured logger
func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

		// Get request ID from context
		requestID, _ := r.Context().Value(contextKeyRequestID).(string)
		// Get CSP Nonce from context
		cspNonce, _ := r.Context().Value(contextKeyCSPNonce).(string)

		defer func() {
			duration := time.Since(start)
			fields := map[string]interface{}{
				"request_id":  requestID,
				"csp_nonce":   cspNonce,
				"status":      ww.Status(),
				"duration_ms": duration.Milliseconds(),
				"bytes":       ww.BytesWritten(),
				"method":      r.Method,
				"path":        r.URL.Path,
				"remote_addr": r.RemoteAddr,
				"user_agent":  r.UserAgent(),
			}
			// Log based on status code
			if LogError != nil && ww.Status() >= 500 {
				LogError(nil, "Server error", fields)
			} else if LogInfo != nil && ww.Status() >= 400 {
				LogInfo("Client error", fields)
			} else if LogInfo != nil {
				LogInfo("Request completed", fields)
			}
		}()

		next.ServeHTTP(ww, r)
	})
}

// SecurityHeadersMiddleware adds security headers to responses
func SecurityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Generate a nonce for CSP
		nonce, err := utils.GenerateRandomString(16) // Handle error
		if err != nil {
			panic(fmt.Sprintf("CRITICAL: Failed to generate CSP nonce: %v", err))
		}

		// Store the nonce in the request context for use in templates
		ctx := context.WithValue(r.Context(), contextKeyCSPNonce, nonce)
		r = r.WithContext(ctx)

		// Set security headers
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()")

		// Strict CSP configuration with nonce
		w.Header().Set("Content-Security-Policy",
			"default-src 'none'; "+
				"script-src 'self' 'nonce-"+nonce+"'; "+
				"style-src 'self' 'nonce-"+nonce+"'; "+
				"style-src-attr 'unsafe-inline'; "+
				"img-src 'self' data: blob:; "+
				"media-src 'self' data: blob:; "+
				"connect-src 'self'; "+
				"font-src 'self'; "+
				"frame-ancestors 'none'; "+
				"form-action 'self'; "+
				"base-uri 'self'; "+
				"manifest-src 'self'; "+
				"worker-src 'self' blob:; "+
				"object-src 'none'; "+
				"upgrade-insecure-requests")

		next.ServeHTTP(w, r)
	})
}

// RequestIDMiddleware adds a unique request ID to each request
func RequestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Generate a unique request ID or use X-Request-ID from header if present
		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" {
			var err error                                   // Declare err
			requestID, err = utils.GenerateRandomString(16) // Handle error
			if err != nil {
				panic(fmt.Sprintf("CRITICAL: Failed to generate request ID: %v", err))
			}
		}

		// Set the request ID in a response header
		w.Header().Set("X-Request-ID", requestID)

		// Store request ID in context for logging
		ctx := context.WithValue(r.Context(), contextKeyRequestID, requestID)
		r = r.WithContext(ctx)

		next.ServeHTTP(w, r)
	})
}

// CustomRecoverer is a custom middleware that recovers from panics and logs them
func CustomRecoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rvr := recover(); rvr != nil {
				// Get stack trace
				buf := make([]byte, 4096)
				n := runtime.Stack(buf, false)
				stackTrace := string(buf[:n])

				// Get request ID from context
				requestID, _ := r.Context().Value(contextKeyRequestID).(string)

				// Log the panic with context
				if LogError != nil {
					LogError(fmt.Errorf("%v", rvr), "Panic recovered", map[string]interface{}{
						"request_id":  requestID,
						"method":      r.Method,
						"path":        r.URL.Path,
						"remote_addr": r.RemoteAddr,
						"stack_trace": stackTrace,
					})
				}

				// Return Internal Server Error
				http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			}
		}()

		next.ServeHTTP(w, r)
	})
}

// RateLimiterMiddleware applies different rate limits based on the request path
func RateLimiterMiddleware(uploadLimiter, chunkLimiter, apiLimiter *utils.RateLimiter) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip rate limiting for static resources and health check
			if strings.HasPrefix(r.URL.Path, "/static/") || r.URL.Path == "/health" {
				next.ServeHTTP(w, r)
				return
			}

			// Get client IP
			ipStr := r.RemoteAddr
			if forwardedFor := r.Header.Get("X-Forwarded-For"); forwardedFor != "" {
				ipStr = strings.Split(forwardedFor, ",")[0]
			}

			// Clean the IP address (remove port if present)
			cleanIP, _, err := net.SplitHostPort(strings.TrimSpace(ipStr))
			if err != nil {
				cleanIP = strings.TrimSpace(ipStr)
			}

			var limiter *utils.RateLimiter
			var limitType string

			// Select the appropriate limiter
			if r.Method == "POST" && r.URL.Path == "/upload" {
				limiter = uploadLimiter
				limitType = "upload"
			} else if r.Method == "POST" && r.URL.Path == "/upload/chunk" {
				limiter = chunkLimiter
				limitType = "chunk upload"
			} else if r.Method == "POST" && r.URL.Path == "/upload/finalize" {
				// No rate limit for finalize
				next.ServeHTTP(w, r)
				return
			} else {
				limiter = apiLimiter
				limitType = "api"
			}

			// Apply the selected rate limit
			if !limiter.Allow(cleanIP) {
				if LogInfo != nil {
					LogInfo(fmt.Sprintf("Rate limit exceeded for %s", limitType), map[string]interface{}{
						"ip":   cleanIP,
						"path": r.URL.Path,
					})
				}
				http.Error(w, fmt.Sprintf("%s rate limit exceeded", strings.Title(limitType)), http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// BodyLimiterMiddleware limits request body size for non-upload endpoints
func BodyLimiterMiddleware() func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip for upload endpoints and static resources
			if r.URL.Path == "/upload" ||
				r.URL.Path == "/upload/chunk" ||
				r.URL.Path == "/upload/finalize" ||
				strings.HasPrefix(r.URL.Path, "/static/") {
				next.ServeHTTP(w, r)
				return
			}

			// Limit body size to 1MB for all other endpoints
			r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
			next.ServeHTTP(w, r)
		})
	}
}

// CacheControlMiddleware adds cache headers for static assets
func CacheControlMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip cache headers for HTML files
		if !strings.HasSuffix(r.URL.Path, ".html") {
			// Set caching headers for static assets (1 week)
			w.Header().Set("Cache-Control", "public, max-age=604800, immutable")
		} else {
			// No caching for HTML files
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		}
		next.ServeHTTP(w, r)
	})
}
