/**
 * Preview page functionality
 */

// Initialize preview page functionality
function initializePreviewPage() {
    // Check if we're on the preview page
    const previewContainer = document.getElementById('previewContainer');
    if (!previewContainer) return;

    // Initialize copy link button functionality
    const copyButton = document.getElementById('copyLinkBtn');
    if (copyButton) {
        copyButton.addEventListener('click', function () {
            copyLinkToClipboard();
        });
    }

    // Handle encrypted file display and decryption
    handleEncryptedPreview();
}

// Handle encrypted file preview functionality
function handleEncryptedPreview() {
    // Get data from body data attributes
    const body = document.body;
    const isEncrypted = body.getAttribute('data-encrypted') === 'true';
    const fileURL = body.getAttribute('data-file-url');
    const mimeType = body.getAttribute('data-mime-type');
    const filename = body.getAttribute('data-filename');

    // Only show encryption-related elements if the file is actually encrypted
    if (isEncrypted) {
        // Show encryption notice
        const encryptionNotice = DOM.byId('encryptionNotice');
        if (encryptionNotice) {
            encryptionNotice.style.display = 'flex';
        }

        // Get the encryption key from the URL fragment
        const encryptionKey = window.location.hash.substring(1);

        // Validate key format first
        if (encryptionKey && validateEncryptionKeyFormat(encryptionKey)) {
            // Format looks valid, but we won't load preview for encrypted files
            const encryptionError = DOM.byId('encryptionError');
            if (encryptionError) {
                encryptionError.style.display = 'none';
            }

            // Show the download section
            const downloadSection = DOM.byId('fileActions');
            if (downloadSection) {
                downloadSection.style.display = 'flex';
            }

            // Update download button to include the key in the URL
            const downloadBtn = DOM.byId('downloadBtn');
            if (downloadBtn) {
                const currentHref = downloadBtn.getAttribute('href');
                downloadBtn.setAttribute('href', currentHref + '#' + encryptionKey);

                // For direct downloads, we need to handle it with JS
                downloadBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    handleEncryptedDownload(encryptionKey, fileURL, mimeType, filename);
                });
            }

            // Immediately validate the sample when the page loads
            validateEncryptionSample(encryptionKey, fileURL, mimeType, filename);
        } else {
            // Invalid key format
            const encryptionError = DOM.byId('encryptionError');
            if (encryptionError) {
                encryptionError.style.display = 'block';
                encryptionError.textContent = 'Invalid encryption key format. The link may be incomplete or incorrect.';
            }
            hideDownloadOptions();
        }
    } else {
        // For non-encrypted files, make sure encryption-related elements are hidden
        const encryptionNotice = DOM.byId('encryptionNotice');
        const encryptionError = DOM.byId('encryptionError');
        
        if (encryptionNotice) {
            encryptionNotice.style.display = 'none';
        }
        
        if (encryptionError) {
            encryptionError.style.display = 'none';
        }
    }
}

/**
 * Validate encryption key by decrypting a sample before showing download options.
 * This ensures that we don't allow downloads with invalid keys.
 */
async function validateEncryptionSample(key, fileURL, mimeType, filename) {
    try {
        // Show progress indicator
        const progressContainer = DOM.byId('decryptionProgress');
        if (progressContainer) {
            progressContainer.style.display = 'block';
            const progressText = DOM.byId('decryptionProgressText');
            if (progressText) {
                progressText.textContent = 'Validating encryption key...';
            }
        }
        
        // Fetch the sample data from the server
        const sampleURL = fileURL.split('?')[0] + '.sample';
        const sampleResponse = await fetch(sampleURL, {
            credentials: 'omit',
            mode: 'cors'
        });

        if (!sampleResponse.ok) {
            // If the sample isn't available, we can't validate
            // This is likely an old file before sample support was added
            console.log('Sample not available, skipping validation');
            hideDecryptionProgress();
            return;
        }

        // Get the sample data
        const sampleData = await sampleResponse.arrayBuffer();
        
        console.log('Validating encryption key with sample data...');
        
        // Try to decrypt the sample
        await FileEncryption.decryptFile(sampleData, key, mimeType);
        
        // If we got here, decryption succeeded - show success message
        console.log('Encryption key is valid');
        
        // Update progress
        const progressText = DOM.byId('decryptionProgressText');
        if (progressText) {
            progressText.textContent = 'Key validation successful';
        }
        
        // Hide progress after a short delay
        setTimeout(hideDecryptionProgress, 1000);
        
    } catch (error) {
        console.error('Sample validation failed:', error);
        
        // Show error message
        const encryptionError = DOM.byId('encryptionError');
        if (encryptionError) {
            encryptionError.style.display = 'block';
            encryptionError.textContent = 'Unable to validate encryption key: ' + error.message;
        }
        
        hideDownloadOptions();
        hideDecryptionProgress();
    }
}

// Hide preview containers for encrypted files
function hidePreviewContainers() {
    // Hide all preview containers
    const previewContainers = [
        document.getElementById('previewContainer'),
        document.getElementById('previewImage'),
        document.getElementById('previewVideo'),
        document.getElementById('previewAudio')
    ];

    previewContainers.forEach(container => {
        if (container) {
            container.style.display = 'none';
        }
    });

    // Hide any progress indicators
    const progressContainer = document.getElementById('decryptionProgress');
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
}

/**
 * Validate the encryption key format
 * @param {string} key - The encryption key to validate
 * @returns {boolean} - True if the key format is valid
 */
function validateEncryptionKeyFormat(key) {

    if (!key) {
        console.error('Key is empty or undefined');
        return false;
    }

    // Base64 URL-safe format validation (no padding)
    // Should consist of letters, numbers, hyphens, and underscores
    // Length should be appropriate for a 256-bit key (32 bytes = ~43 base64 chars)
    const keyRegex = /^[A-Za-z0-9_-]{42,44}$/;
    return keyRegex.test(key);
}

// Hide download options when decryption fails
function hideDownloadOptions() {
    const downloadSection = DOM.byId('fileActions');
    if (downloadSection) {
        downloadSection.style.display = 'none';
    }
    
    const downloadTip = DOM.byId('downloadTip');
    if (downloadTip) {
        downloadTip.style.display = 'none';
    }
}

// Hide decryption progress display
function hideDecryptionProgress() {
    const progressContainer = DOM.byId('decryptionProgress');
    if (progressContainer) {
        progressContainer.style.display = 'none';
        progressContainer.classList.remove('displayed');
    }
}

// Show decryption progress 
function showDecryptionProgress(message) {
    const progressContainer = DOM.byId('decryptionProgress');
    const progressText = DOM.byId('decryptionProgressText');
    
    if (progressContainer && progressText) {
        if (message) {
            progressText.textContent = message;
        }
        progressContainer.style.display = 'block';
        progressContainer.classList.add('displayed');
    }
}

// Handle direct download of encrypted file
async function handleEncryptedDownload(key, fileURL, mimeType, filename) {
    try {
        // Show decryption progress
        const progressContainer = DOM.byId('decryptionProgress');
        if (progressContainer) {
            progressContainer.style.display = 'block';
            progressContainer.classList.add('displayed');
            
            const progressText = DOM.byId('decryptionProgressText');
            if (progressText) {
                progressText.textContent = 'Downloading encrypted file...';
            }
            
            const progressBar = DOM.byId('decryptionProgressBar');
            if (progressBar) {
                progressBar.style.width = '0%';
            }
        }
        
        // Fetch the encrypted file
        const fileResponse = await fetch(fileURL, {
            credentials: 'omit',
            mode: 'cors'
        });
        
        if (!fileResponse.ok) {
            throw new Error('Failed to download the file');
        }
        
        // Update progress
        const progressText = DOM.byId('decryptionProgressText');
        if (progressText) {
            progressText.textContent = 'Decrypting file...';
        }
        
        const progressBar = DOM.byId('decryptionProgressBar');
        if (progressBar) {
            progressBar.style.width = '50%';
        }
        
        // Get the encrypted data
        const encryptedData = await fileResponse.arrayBuffer();
        
        // Decrypt the file
        const decryptedBlob = await FileEncryption.decryptFile(encryptedData, key, mimeType);
        
        // Update progress
        if (progressBar) {
            progressBar.style.width = '90%';
        }
        
        if (progressText) {
            progressText.textContent = 'Preparing download...';
        }
        
        // Create a download link and trigger it
        const downloadURL = URL.createObjectURL(decryptedBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadURL;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(downloadURL);
        }, 100);
        
        // Complete progress
        if (progressBar) {
            progressBar.style.width = '100%';
        }
        
        if (progressText) {
            progressText.textContent = 'Download complete!';
        }
        
        // Hide progress after a delay
        setTimeout(hideDecryptionProgress, 2000);
        
    } catch (error) {
        console.error('Download failed:', error);
        
        // Show error
        const encryptionError = DOM.byId('encryptionError');
        if (encryptionError) {
            encryptionError.style.display = 'block';
            encryptionError.textContent = 'Download failed: ' + error.message;
        }
        
        hideDecryptionProgress();
    }
}

// Copy link to clipboard
function copyLinkToClipboard() {
    const link = window.location.href;

    // Use the modern Clipboard API first
    if (navigator.clipboard) {
        navigator.clipboard.writeText(link)
            .then(() => updateCopyButton('Copied!'))
            .catch(err => {
                console.error('Clipboard API error:', err);
                fallbackCopyToClipboard(link);
            });
        return;
    }
    
    // Fallback for browsers without clipboard API
    fallbackCopyToClipboard(link);
}

// Fallback copy method for older browsers
function fallbackCopyToClipboard(text) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // Avoid scrolling to bottom
        textArea.style.cssText = 'position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;box-shadow:none;background:transparent;';
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            updateCopyButton('Copied!');
        } else {
            console.error('Fallback: Copy command was unsuccessful');
            updateCopyButton('Copy failed!');
        }
    } catch (err) {
        console.error('Fallback: Could not copy text:', err);
        updateCopyButton('Copy failed!');
    }
}

// Update copy button text with animation
function updateCopyButton(text) {
    const btn = document.getElementById('copyLinkBtn');
    if (!btn) return;

    const originalText = btn.textContent;
    btn.textContent = text;

    setTimeout(() => {
        btn.textContent = originalText;
    }, 2000);
}

// Export functions
if (typeof module !== 'undefined') {
    module.exports = {
        initializePreviewPage,
        handleEncryptedPreview,
        validateEncryptionSample,
        hidePreviewContainers,
        validateEncryptionKeyFormat,
        hideDownloadOptions,
        hideDecryptionProgress,
        showDecryptionProgress,
        handleEncryptedDownload,
        copyLinkToClipboard
    };
} 