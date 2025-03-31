package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"uploadfish/config"
	"uploadfish/handlers"
	"uploadfish/storage"
	"uploadfish/utils"
)

// Define custom type for context keys to avoid collisions
type contextKey string

// Define constants for context keys
const (
	contextKeyCSPNonce  contextKey = "csp-nonce"
	contextKeyRequestID contextKey = "request-id"
)

// StorageLogger implements the storage.Logger interface
type StorageLogger struct{}

func (l *StorageLogger) Error(err error, message string, fields map[string]interface{}) {
	LogError(err, message, fields)
}

func (l *StorageLogger) Info(message string, fields map[string]interface{}) {
	LogInfo(message, fields)
}

// CSRFLogger implements the utils.Logger interface for CSRF
type CSRFLogger struct{}

func (l *CSRFLogger) Info(message string, fields map[string]interface{}) {
	LogInfo(message, fields)
}

func main() {
	// Initialize the structured logger
	InitLogger()

	// Set up handler package logging functions
	handlers.LogErrorFunc = LogError
	handlers.LogInfoFunc = LogInfo
	handlers.LogDebugFunc = LogDebug

	// Load configuration
	cfg := config.New()
	Logger.Info().
		Str("port", cfg.Port).
		Int64("maxUploadSize", cfg.MaxUploadSize).
		Strs("allowedTypes", cfg.AllowedTypes).
		Msg("Configuration loaded")

	// Check dependencies before starting
	if err := checkDependencies(cfg); err != nil {
		Logger.Fatal().Err(err).Msg("Failed dependency check")
	}

	// Initialize storage with logger
	store, err := storage.New(cfg, &StorageLogger{})
	if err != nil {
		Logger.Fatal().Err(err).Msg("Failed to initialize storage")
	}
	defer func(store *storage.Storage) {
		err := store.Close()
		if err != nil {
			Logger.Error().Err(err).Msg("Failed to close storage")
		}
	}(store)

	// Initialize rate limiters with different rates
	uploadRateLimiter := utils.NewRateLimiter(cfg.RateLimit/10, cfg.RateLimitWindow, cfg.RateLimitCleanup)     // Stricter for uploads
	chunkUploadRateLimiter := utils.NewRateLimiter(cfg.RateLimit*5, cfg.RateLimitWindow, cfg.RateLimitCleanup) // Much more permissive for chunks
	apiRateLimiter := utils.NewRateLimiter(cfg.RateLimit, cfg.RateLimitWindow, cfg.RateLimitCleanup)           // Normal for regular requests

	// Initialize CSRF protection with logger
	csrfProtection := utils.NewCSRFProtection(cfg.CSRFExpiration, &CSRFLogger{})

	// Initialize router with middleware
	r := chi.NewRouter()

	// Add standard middlewares
	r.Use(middleware.RealIP)
	r.Use(requestIDMiddleware)    // Add request ID to each request
	r.Use(loggingMiddleware)      // Our structured logging middleware
	r.Use(customRecoverer)        // Custom recovery middleware with better logging
	r.Use(middleware.Compress(5)) // Add compression middleware with level 5
	r.Use(middleware.Timeout(30 * time.Minute))

	// Add CORS middleware
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.BaseURL},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "Range", "X-CSRF-Token", "X-Requested-With", "X-Chunk-Token"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Add security headers middleware
	r.Use(securityHeadersMiddleware)

	// Add rate limiter middleware
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip rate limiting for static resources
			if strings.HasPrefix(r.URL.Path, "/static/") || r.URL.Path == "/health" {
				next.ServeHTTP(w, r)
				return
			}

			// Get client IP
			ip := r.RemoteAddr
			if forwardedFor := r.Header.Get("X-Forwarded-For"); forwardedFor != "" {
				ip = strings.Split(forwardedFor, ",")[0]
			}

			// Apply stricter rate limits for standard uploads, bypass for chunked uploads
			if r.Method == "POST" && r.URL.Path == "/upload" {
				if !uploadRateLimiter.Allow(ip) {
					LogInfo("Rate limit exceeded for upload", map[string]interface{}{
						"ip":   ip,
						"path": r.URL.Path,
					})
					http.Error(w, "Upload rate limit exceeded", http.StatusTooManyRequests)
					return
				}
			} else if r.Method == "POST" && r.URL.Path == "/upload/chunk" {
				// Use a very permissive rate limiter for chunks, with higher log visibility
				if !chunkUploadRateLimiter.Allow(ip) {
					LogInfo("Rate limit exceeded for chunk upload", map[string]interface{}{
						"ip":   ip,
						"path": r.URL.Path,
					})
					http.Error(w, "Chunk upload rate limit exceeded", http.StatusTooManyRequests)
					return
				}
			} else if r.Method == "POST" && r.URL.Path == "/upload/finalize" {
				// Skip rate limiting for finalization to ensure uploads complete
			} else {
				// Regular rate limit for other endpoints
				if !apiRateLimiter.Allow(ip) {
					LogInfo("Rate limit exceeded", map[string]interface{}{
						"ip":   ip,
						"path": r.URL.Path,
					})
					http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
					return
				}
			}

			next.ServeHTTP(w, r)
		})
	})

	// Add body size limiting middleware for non-upload endpoints
	r.Use(func(next http.Handler) http.Handler {
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
	})

	// Create handlers
	h := handlers.New(cfg, store, csrfProtection)

	// Register routes
	r.Get("/", h.Index)
	r.Post("/upload", h.Upload)
	r.Post("/upload/chunk", h.ChunkUpload)
	r.Post("/upload/finalize", h.FinalizeUpload)
	r.Get("/file/{fileID:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}}.sample", h.ServeEncryptedSample)
	r.Get("/file/{fileID:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}}", h.ServeFileByID)
	r.Get("/error", h.ErrorPage)
	r.Get("/terms", h.Terms)
	r.Get("/privacy", h.Privacy)

	// Health check endpoint
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Serve static files
	fileServer := http.FileServer(http.Dir("static"))
	r.Handle("/static/*", cacheControlMiddleware(http.StripPrefix("/static", fileServer)))

	// Create server
	addr := fmt.Sprintf(":%s", cfg.Port)
	server := &http.Server{
		Addr:    addr,
		Handler: r,
		// Configure server timeouts for very large file uploads
		ReadTimeout:  30 * time.Minute,  // 30 minutes for read operations
		WriteTimeout: 30 * time.Minute,  // 30 minutes for write operations
		IdleTimeout:  120 * time.Second, // 2 minutes for idle connections
	}

	// Handle graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	// Start server in a goroutine
	go func() {
		Logger.Info().Msgf("Upload Fish server running at http://localhost%s", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			Logger.Fatal().Err(err).Msg("Failed to start server")
		}
	}()

	// Wait for interrupt signal
	<-stop
	Logger.Info().Msg("Shutting down server...")

	// Create shutdown context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// First set the server to not accept new connections
	server.SetKeepAlivesEnabled(false)
	Logger.Info().Msg("Stopped accepting new connections")

	// Shutdown server
	if err := server.Shutdown(ctx); err != nil {
		Logger.Fatal().Err(err).Msg("Server forced to shutdown")
	}

	Logger.Info().Msg("Server gracefully stopped")
}

// loggingMiddleware is a custom middleware that uses our structured logging
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Get request ID from context if available
		requestID, _ := r.Context().Value(contextKeyRequestID).(string)

		// Wrap the response writer to capture the status code
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

		// Call the next handler
		next.ServeHTTP(ww, r)

		// Calculate duration
		duration := time.Since(start)

		// Prepare fields for logging
		fields := map[string]interface{}{
			"status":      ww.Status(),
			"bytes":       ww.BytesWritten(),
			"method":      r.Method,
			"path":        r.URL.Path,
			"remote_addr": r.RemoteAddr,
			"duration_ms": duration.Milliseconds(),
		}

		// Add request ID if available
		if requestID != "" {
			fields["request_id"] = requestID
		}

		// Add user agent
		if ua := r.UserAgent(); ua != "" {
			fields["user_agent"] = ua
		}

		// Log based on status code
		if ww.Status() >= 500 {
			LogError(nil, "Server error", fields)
		} else if ww.Status() >= 400 {
			LogInfo("Client error", fields)
		} else {
			LogInfo("Request completed", fields)
		}
	})
}

// securityHeadersMiddleware adds security headers to responses
func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Generate a nonce for CSP
		nonce := utils.GenerateRandomString(16)

		// Store the nonce in the request context for use in templates
		ctx := context.WithValue(r.Context(), contextKeyCSPNonce, nonce)
		r = r.WithContext(ctx)

		// Set security headers
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()")

		// Strict CSP configuration with nonce instead of unsafe-inline
		w.Header().Set("Content-Security-Policy",
			"default-src 'none'; "+
				"script-src 'self' 'nonce-"+nonce+"'; "+ // No need for script-src-elem with script-src
				"style-src 'self' 'nonce-"+nonce+"' 'unsafe-inline'; "+ // Use nonce for styles
				"style-src-attr 'unsafe-inline'; "+ // Allow inline style attributes
				"img-src 'self' data: blob:; "+ // Allow images and file previews
				"media-src 'self' data: blob:; "+ // For audio/video previews
				"connect-src 'self'; "+ // Only allow API calls to same origin
				"font-src 'self'; "+ // Only allow self-hosted fonts
				"frame-ancestors 'none'; "+ // Prevent framing (anti-clickjacking)
				"form-action 'self'; "+ // Only allow forms to submit to same origin
				"base-uri 'self'; "+ // Restrict base URI
				"manifest-src 'self'; "+ // For web manifest
				"worker-src 'self' blob:; "+ // For Web Workers if needed
				"object-src 'none'; "+ // Disallow plugins like Flash
				"upgrade-insecure-requests")

		next.ServeHTTP(w, r)
	})
}

// requestIDMiddleware adds a unique request ID to each request
func requestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Generate a unique request ID or use X-Request-ID from header if present
		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = utils.GenerateRandomString(16) // Generate random ID
		}

		// Set the request ID in a response header
		w.Header().Set("X-Request-ID", requestID)

		// Store request ID in context for logging
		ctx := context.WithValue(r.Context(), contextKeyRequestID, requestID)
		r = r.WithContext(ctx)

		next.ServeHTTP(w, r)
	})
}

// customRecoverer is a custom middleware that recovers from panics and logs them
func customRecoverer(next http.Handler) http.Handler {
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
				LogError(fmt.Errorf("%v", rvr), "Panic recovered", map[string]interface{}{
					"request_id":  requestID,
					"method":      r.Method,
					"path":        r.URL.Path,
					"remote_addr": r.RemoteAddr,
					"stack_trace": stackTrace,
				})

				// Return Internal Server Error
				http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			}
		}()

		next.ServeHTTP(w, r)
	})
}

// cacheControlMiddleware adds cache headers for static assets
func cacheControlMiddleware(next http.Handler) http.Handler {
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

// checkDependencies verifies all required dependencies are available
func checkDependencies(cfg *config.Config) error {
	// Check storage data directory exists
	if _, err := os.Stat(cfg.BitcaskPath); os.IsNotExist(err) {
		// Try to create it
		Logger.Info().Str("path", cfg.BitcaskPath).Msg("Storage directory does not exist, creating")
		if err := os.MkdirAll(cfg.BitcaskPath, 0755); err != nil {
			return fmt.Errorf("failed to create storage directory: %w", err)
		}
	}

	// Verify static directory exists
	if _, err := os.Stat("static"); os.IsNotExist(err) {
		return fmt.Errorf("static directory not found")
	}

	// Verify templates directory exists
	if _, err := os.Stat("templates"); os.IsNotExist(err) {
		return fmt.Errorf("templates directory not found")
	}

	return nil
}
