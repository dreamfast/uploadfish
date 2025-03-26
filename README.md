<p align="center">
  <img src="https://upload.fish/static/logo.png" alt="Upload Fish Logo" width="200">
</p>

A simple file sharing application. It uses vanilla javascript and CSS, with javascript being optional. Files are automatically removed from 1 hour to 3 days. You can check it out at https://upload.fish/

## Features

- **Easy File Uploads**: Drag-and-drop interface or traditional file selection
- **Auto-Expiring Links**: Choose how long your files should be available (1 hour to 3 days)
- **Large File Support**: Upload files up to 1GB in size
- **Real-time Progress**: Track upload progress with speed and time remaining estimates
- **Content Type Detection**: Automatically handles various file types appropriately
- **No JavaScript Required**: Works with or without JavaScript enabled
- **Shareable URLs**: Easy sharing with copyable links
- **Automatic Cleanup**: Expired files are automatically removed
- **Embedded Compressed Storage with BitCask**: For both file data and metadata

## Configuration

Upload Fish can be configured using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 8085 |
| `BASE_URL` | Base URL for CORS and generated links | (empty) |
| `MAX_UPLOAD_SIZE` | Max file size in bytes | 1073741824 (1GB) |
| `ALLOWED_TYPES` | Comma-separated MIME types | * (all types) |
| `BITCASK_PATH` | Path to store data files | data |
| `CLEANUP_INTERVAL` | Interval to check for expired files | 1m |
| `RATE_LIMIT` | Maximum requests per time window | 60 |
| `RATE_LIMIT_WINDOW` | Time window for rate limiting | 1m |
| `RATE_LIMIT_CLEANUP` | Cleanup interval for rate limit data | 5m |
| `CSRF_EXPIRATION` | CSRF token expiration time | 1h |

For Docker deployment, you can configure these options in the `docker-compose.yml` file:

```yaml
environment:
  - PORT=8080
  - MAX_UPLOAD_SIZE=1073741824  # 1GB in bytes
  - BITCASK_PATH=/app/data
  - CLEANUP_INTERVAL=1h
  # Uncomment and set this if you're behind a reverse proxy
  # - BASE_URL=https://upload.fish
```

When running behind a reverse proxy, make sure to set the `BASE_URL` to your domain to ensure proper CORS configuration and link generation.

## Running Locally

```bash
# Clone the repository
git clone https://github.com/dreamfast/uploadfish.git
cd uploadfish

# Build the application
go build -o uploadfish main.go

# Run the server
./uploadfish
```

## Docker Deployment

You can run `deploy.sh` to bring the docker container online.


```bash
docker-compose up -d
```

The service will be available at http://localhost:8085

## Development

```bash
go run main.go
```

## License

MIT License - Feel free to use and modify as needed. 