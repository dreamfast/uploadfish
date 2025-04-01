package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chi_middleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"uploadfish/config"
	"uploadfish/handlers"
	"uploadfish/middleware"
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

	// Set up middleware package logging functions
	middleware.LogInfo = LogInfo
	middleware.LogError = LogError
	middleware.LogDebug = LogDebug

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
	r.Use(chi_middleware.RealIP)
	r.Use(middleware.RequestIDMiddleware)
	r.Use(middleware.LoggingMiddleware)
	r.Use(middleware.CustomRecoverer)
	r.Use(chi_middleware.Compress(5))
	r.Use(chi_middleware.Timeout(30 * time.Minute))

	// Add CORS middleware
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.BaseURL},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "Range", "X-CSRF-Token", "X-Requested-With", "X-Chunk-Token"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Add security headers middleware
	r.Use(middleware.SecurityHeadersMiddleware)

	// Add rate limiter middleware
	r.Use(middleware.RateLimiterMiddleware(uploadRateLimiter, chunkUploadRateLimiter, apiRateLimiter))

	// Add body size limiting middleware for non-upload endpoints
	r.Use(middleware.BodyLimiterMiddleware())

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
	r.Handle("/static/*", middleware.CacheControlMiddleware(http.StripPrefix("/static", fileServer)))

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
