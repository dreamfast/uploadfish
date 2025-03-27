<p align="center">
  <img src="https://upload.fish/static/logo.png" alt="Upload Fish Logo" width="200">
</p>

A simple file sharing application. It uses vanilla javascript and CSS, with javascript being optional. Files are automatically removed from 1 hour to 3 days. You can check it out at https://upload.fish/

## Features

- **Easy File Uploads**: Drag-and-drop interface or traditional file selection
- **Auto-Expiring Links**: Choose how long your files should be available (1 hour to 3 days)
- **Large File Support**: Upload files up to 1GB in size
- **Client-Side Encryption**: Optional end-to-end encryption that happens in the browser
- **Enhanced CSRF Protection**: Double-submit cookie pattern for secure form submissions
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

## Security Features

### CSRF Protection

Upload Fish implements a robust double-submit cookie pattern for CSRF protection:

1. A secure, HttpOnly cookie containing a CSRF token is set on page load
2. A matching token is included in forms as a hidden input field
3. On form submission, both tokens are validated to ensure they match
4. Tokens expire after 1 hour and are one-time use only

This approach protects against cross-site request forgery attacks while maintaining compatibility with both JavaScript and non-JavaScript clients.

### Client-Side Encryption

When enabled, files are encrypted in the browser before uploading:

1. A random encryption key is generated client-side
2. The file is encrypted using AES-GCM with the generated key
3. The encrypted file is uploaded to the server
4. The encryption key is stored only in the URL fragment (#) and never sent to the server
5. When accessing the file, the key from the URL fragment is used to decrypt the file in the browser
6. Javascript is required for this process

This ensures that the server never has access to the unencrypted content or the encryption key, providing true end-to-end encryption.

## Development

```bash
go run main.go
```

## Privacy Policy

### 1. Information We Collect

UploadFish collects minimal data to operate our service:
- Temporary file metadata (file name, size, type, upload time, expiry time)
- Server logs containing IP addresses and request information
- Essential cookies for CSRF protection

We do not collect personal information beyond what's necessary to provide the service.

### 2. Client-Side Encryption

When you enable client-side encryption, your files are encrypted in your browser before being uploaded to our servers. We do not have access to the encryption keys, which are only shared in the URL fragment (#) and never sent to our servers.

### 3. How We Use Your Information

We use collected information solely to:
- Provide the file hosting service
- Enforce our file expiration policies
- Prevent abuse of our service
- Improve service reliability and performance

### 4. Data Retention

All uploaded files and associated metadata are automatically deleted when they expire (1 to 72 hours after upload, as selected by you). Server logs are retained for 7 days for technical and security purposes.

### 5. Security

We implement reasonable security measures to protect your data during transmission and storage. However, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security.

## Terms of Service

### 1. Acceptable Use

You agree not to use UploadFish to:
- Upload, share, or distribute illegal content
- Infringe upon copyrights, trademarks, or other intellectual property rights
- Share malicious software, viruses, or harmful code
- Harass, intimidate, or threaten others
- Attempt to disrupt or overload our servers or network

### 2. File Storage and Removal

All files uploaded to UploadFish are temporary and will automatically be deleted after the expiration period you select. We reserve the right to remove any content that violates these terms at any time without notice.

### 3. Encryption and Privacy

Client-side encryption is available to protect your data. When enabled, we cannot access the contents of your files. However, you are responsible for safeguarding your encryption keys and sharing links securely.

### 4. Limitation of Liability

UploadFish provides this service "as is" without any warranties. We shall not be liable for any damages, lost files, or service interruptions. We don't guarantee constant availability or security against all possible threats.

## License

MIT License - Feel free to use and modify as needed. 