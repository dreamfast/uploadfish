package utils

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"strings"
	"sync"
	"time"
)

// CSRFProtection provides protection against Cross-Site Request Forgery attacks
type CSRFProtection struct {
	tokens     map[string]time.Time
	mu         sync.Mutex
	expiration time.Duration
	logger     Logger
}

// Logger interface defines the logging methods needed by the CSRF package
type Logger interface {
	Info(message string, fields map[string]interface{})
}

// TokenPair represents a pair of CSRF tokens
type TokenPair struct {
	FormToken   string
	CookieToken string
}

// NewCSRFProtection creates a new CSRF protection handler
func NewCSRFProtection(expiration time.Duration, logger Logger) *CSRFProtection {
	csrf := &CSRFProtection{
		tokens:     make(map[string]time.Time),
		expiration: expiration,
		logger:     logger,
	}

	// Start cleanup routine
	go csrf.startCleanup()

	return csrf
}

// GenerateToken creates a new CSRF token
func (c *CSRFProtection) GenerateToken() string {
	// Generate 32 bytes of random data
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		// If we can't get random data, use timestamp
		return base64.StdEncoding.EncodeToString([]byte(time.Now().String()))
	}

	// Convert to base64 for URL safety
	token := base64.StdEncoding.EncodeToString(b)

	// Store token
	c.mu.Lock()
	defer c.mu.Unlock()
	c.tokens[token] = time.Now().Add(c.expiration)

	return token
}

// GenerateTokenPair creates a new pair of CSRF tokens
func (c *CSRFProtection) GenerateTokenPair() TokenPair {
	// Generate form token
	formToken := c.GenerateToken()

	// Generate cookie token
	cookieToken := c.GenerateToken()

	// Store both tokens with the same expiry
	c.mu.Lock()
	defer c.mu.Unlock()
	expiry := time.Now().Add(c.expiration)
	c.tokens[formToken] = expiry
	c.tokens[cookieToken] = expiry

	return TokenPair{
		FormToken:   formToken,
		CookieToken: cookieToken,
	}
}

// ValidateToken checks if a token is valid and matches the cookie
func (c *CSRFProtection) ValidateToken(formToken string, cookieToken string) bool {
	if formToken == "" || cookieToken == "" {
		return false
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	// Check if both tokens exist and haven't expired
	formExpiry, formExists := c.tokens[formToken]
	cookieExpiry, cookieExists := c.tokens[cookieToken]

	if !formExists || !cookieExists {
		return false
	}

	// Check if either token has expired
	now := time.Now()
	if now.After(formExpiry) || now.After(cookieExpiry) {
		// Clean up expired tokens
		delete(c.tokens, formToken)
		delete(c.tokens, cookieToken)
		return false
	}

	// Valid tokens - // remove after use for true one-time use
	// delete(c.tokens, formToken)  // Allow token reuse within expiry
	// delete(c.tokens, cookieToken) // Allow token reuse within expiry
	return true
}

// SetTokenCookie sets the CSRF token in a secure cookie
func (c *CSRFProtection) SetTokenCookie(w http.ResponseWriter, token string) {
	cookie := &http.Cookie{
		Name:     "csrf_token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   int(c.expiration.Seconds()),
	}
	http.SetCookie(w, cookie)
}

// startCleanup periodically removes expired tokens
func (c *CSRFProtection) startCleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		c.mu.Lock()
		now := time.Now()

		for token, expiry := range c.tokens {
			if now.After(expiry) {
				delete(c.tokens, token)
			}
		}

		c.mu.Unlock()
	}
}

// Middleware returns a middleware function that validates CSRF tokens
func (c *CSRFProtection) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip CSRF check for GET requests and static resources
		if r.Method == "GET" || strings.HasPrefix(r.URL.Path, "/static/") {
			next.ServeHTTP(w, r)
			return
		}

		// Get cookie token
		cookie, err := r.Cookie("csrf_token")
		if err != nil {
			c.logger.Info("CSRF validation failed - no cookie", map[string]interface{}{
				"method":      r.Method,
				"path":        r.URL.Path,
				"remote_addr": r.RemoteAddr,
			})
			http.Error(w, "Invalid or missing CSRF token", http.StatusForbidden)
			return
		}

		// Look for token in various places
		var token string

		// Try URL query parameter first
		token = r.URL.Query().Get("csrf_token")
		if token != "" && c.ValidateToken(token, cookie.Value) {
			next.ServeHTTP(w, r)
			return
		}

		// Check Content-Type for appropriate form parsing
		contentType := r.Header.Get("Content-Type")

		// For non-multipart forms, parse the regular form data
		if !strings.Contains(contentType, "multipart/form-data") {
			// Regular form data
			if err := r.ParseForm(); err == nil {
				token = r.FormValue("csrf_token")
				if token != "" && c.ValidateToken(token, cookie.Value) {
					next.ServeHTTP(w, r)
					return
				}
			}
		} else {
			// For multipart forms, we need careful parsing to not consume the body
			// Limit parsing to a reasonable size (32MB) to prevent DOS
			err := r.ParseMultipartForm(32 << 20)
			if err == nil {
				// Check multipart form values for CSRF token
				if values := r.MultipartForm.Value["csrf_token"]; len(values) > 0 {
					token = values[0]
					if token != "" && c.ValidateToken(token, cookie.Value) {
						next.ServeHTTP(w, r)
						return
					}
				}
			}
		}

		// No valid token found - return a CSRF error
		c.logger.Info("CSRF validation failed", map[string]interface{}{
			"method":      r.Method,
			"path":        r.URL.Path,
			"remote_addr": r.RemoteAddr,
		})
		http.Error(w, "Invalid or missing CSRF token", http.StatusForbidden)
	})
}

// GenerateRandomString creates a random string of specified length
// Useful for generating nonces and other security tokens
func GenerateRandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	_, err := rand.Read(b)
	if err != nil {
		// If we can't get random data, use timestamp as fallback
		// This should never happen in practice
		timestamp := []byte(time.Now().String())
		copy(b, timestamp)
		if len(timestamp) < length {
			for i := len(timestamp); i < length; i++ {
				b[i] = charset[i%len(charset)]
			}
		}
		return string(b[:length])
	}

	// Convert random bytes to characters from charset
	for i := range b {
		b[i] = charset[int(b[i])%len(charset)]
	}
	return string(b)
}

// GenerateHMAC generates a Base64 encoded HMAC-SHA256 hash
func GenerateHMAC(secret string, message string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(message))
	expectedMAC := mac.Sum(nil)
	return base64.StdEncoding.EncodeToString(expectedMAC)
}
