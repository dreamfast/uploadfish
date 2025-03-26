package utils

import (
	"net"
	"sync"
	"time"
)

// RateLimiter provides IP-based rate limiting
type RateLimiter struct {
	requests     map[string]*ipRequests
	mu           sync.Mutex
	maxRequests  int           // Maximum requests per window
	windowLength time.Duration // Time window length
	cleanup      time.Duration // Cleanup interval
}

type ipRequests struct {
	count    int
	lastSeen time.Time
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(maxRequests int, windowLength, cleanup time.Duration) *RateLimiter {
	limiter := &RateLimiter{
		requests:     make(map[string]*ipRequests),
		maxRequests:  maxRequests,
		windowLength: windowLength,
		cleanup:      cleanup,
	}

	// Start cleanup routine
	go limiter.startCleanup()

	return limiter
}

// Allow checks if a request from an IP should be allowed
func (rl *RateLimiter) Allow(ipAddr string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()

	// Extract IP from IP:port if needed
	if host, _, err := net.SplitHostPort(ipAddr); err == nil {
		ipAddr = host
	}

	// Initialize if this is the first request from this IP
	req, exists := rl.requests[ipAddr]
	if !exists {
		rl.requests[ipAddr] = &ipRequests{
			count:    1,
			lastSeen: now,
		}
		return true
	}

	// Reset count if window has passed
	if now.Sub(req.lastSeen) > rl.windowLength {
		req.count = 0
		req.lastSeen = now
	}

	// Increment request count
	req.count++
	req.lastSeen = now

	// Check if over limit
	return req.count <= rl.maxRequests
}

// startCleanup periodically removes old entries
func (rl *RateLimiter) startCleanup() {
	ticker := time.NewTicker(rl.cleanup)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()

		for ip, req := range rl.requests {
			if now.Sub(req.lastSeen) > rl.windowLength {
				delete(rl.requests, ip)
			}
		}

		rl.mu.Unlock()
	}
}
