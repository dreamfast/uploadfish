package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
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

	// Initialize storage with logger
	store, err := storage.New(cfg, &StorageLogger{})
	if err != nil {
		Logger.Fatal().Err(err).Msg("Failed to initialize storage")
	}
	defer store.Close()

	// Initialize rate limiter
	rateLimiter := utils.NewRateLimiter(cfg.RateLimit, cfg.RateLimitWindow, cfg.RateLimitCleanup)

	// Initialize CSRF protection with logger
	csrfProtection := utils.NewCSRFProtection(cfg.CSRFExpiration, &CSRFLogger{})

	// Initialize router with middleware
	r := chi.NewRouter()

	// Add standard middlewares
	r.Use(middleware.RealIP)
	r.Use(loggingMiddleware) // Our structured logging middleware
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// Add CORS middleware
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.BaseURL},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Add security headers middleware
	r.Use(securityHeadersMiddleware)

	// Add rate limiter middleware
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip rate limiting for static resources
			if strings.HasPrefix(r.URL.Path, "/static/") {
				next.ServeHTTP(w, r)
				return
			}

			// Get client IP
			ip := r.RemoteAddr
			if forwardedFor := r.Header.Get("X-Forwarded-For"); forwardedFor != "" {
				ip = strings.Split(forwardedFor, ",")[0]
			}

			// Check rate limit
			if !rateLimiter.Allow(ip) {
				http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	})

	// Create handlers
	h := handlers.New(cfg, store, csrfProtection)

	// Register routes
	r.Get("/", h.Index)
	r.Post("/upload", h.Upload)
	r.Get("/file/{id}", h.ServeFileByID)
	r.Get("/error", h.ErrorPage)

	// Serve static files
	fileServer := http.FileServer(http.Dir("static"))
	r.Handle("/static/*", http.StripPrefix("/static", fileServer))

	// Create server
	addr := fmt.Sprintf(":%s", cfg.Port)
	server := &http.Server{
		Addr:    addr,
		Handler: r,
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
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Shutdown server
	if err := server.Shutdown(ctx); err != nil {
		Logger.Error().Err(err).Msg("Server shutdown error")
	}

	Logger.Info().Msg("Server gracefully stopped")
}

// loggingMiddleware is a custom middleware that uses our structured logging
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Wrap the response writer to capture the status code
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

		// Call the next handler
		next.ServeHTTP(ww, r)

		// Log the request details using our helper function
		LogHTTPRequest(r, ww.Status(), ww.BytesWritten(), time.Since(start))
	})
}

// securityHeadersMiddleware adds security headers to responses
func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set security headers
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// Strict CSP configuration
		w.Header().Set("Content-Security-Policy",
			"default-src 'none'; "+
				"script-src 'self' 'unsafe-inline'; "+ // Required for inline event handlers
				"style-src 'self' 'unsafe-inline'; "+ // Required for inline styles
				"img-src 'self' data: blob:; "+ // Allow images and file previews
				"media-src 'self' blob:; "+ // For audio/video previews
				"connect-src 'self'; "+ // Only allow API calls to same origin
				"font-src 'self'; "+ // Only allow self-hosted fonts
				"frame-ancestors 'none'; "+ // Prevent framing
				"form-action 'self'; "+ // Only allow forms to submit to same origin
				"base-uri 'self'; "+ // Restrict base URI
				"manifest-src 'self'; "+ // For web manifest
				"upgrade-insecure-requests")

		next.ServeHTTP(w, r)
	})
}
