FROM golang:1.24.1-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum* ./
RUN go mod download

# Copy source code
COPY . .

# Build the application with optimizations
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags="-s -w" -o uploadfish .

# Final stage
FROM alpine:3.19

WORKDIR /app

# Install CA certificates for HTTPS and wget for healthcheck
RUN apk --no-cache add ca-certificates wget && \
    # Create data directory for BitCask
    mkdir -p /app/data && \
    chmod 755 /app/data

# Copy binary from builder stage
COPY --from=builder /app/uploadfish /app/uploadfish

# Copy template and static files
COPY --from=builder /app/templates /app/templates
COPY --from=builder /app/static /app/static

# Environment variables
ENV PORT=8080
ENV BITCASK_PATH=/app/data
ENV MAX_UPLOAD_SIZE=1073741824
ENV CLEANUP_INTERVAL=1h

# Expose port
EXPOSE 8080

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:8080/ || exit 1

# Run the application
CMD ["/app/uploadfish"]