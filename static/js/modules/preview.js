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
 * @returns {Promise<boolean>} True if validation passed, false otherwise
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

        // Step 1: Basic format validation of the key
        if (!key) {
            console.error('No encryption key provided');
            showEncryptionError('No encryption key provided. The link may be incomplete.');
            return false;
        }
        
        if (key.length < 10) {
            console.error('Encryption key is too short:', key.length);
            showEncryptionError('Invalid encryption key format: Key is too short.');
            return false;
        }
        
        console.log('Basic key format validation passed, key length:', key.length);
        
        // Step 2: Get the sample file to validate against
        let sampleResponse;
        try {
            // Get the base URL without query parameters for the sample file
            const baseURL = fileURL.split('?')[0];
            console.log('Fetching validation sample from:', baseURL + '.sample');
            
            sampleResponse = await fetch(baseURL + '.sample', {
                credentials: 'omit',
                mode: 'cors'
            });
        } catch (fetchError) {
            // If we can't fetch the sample, assume key is valid (for backward compatibility)
            console.warn('Error fetching validation sample:', fetchError);
            hideDecryptionProgress();
            return true;
        }
        
        // If no sample file exists, it's an older file without sample validation
        if (!sampleResponse.ok) {
            console.log('No validation sample available, skipping validation');
            hideDecryptionProgress();
            return true;
        }
        
        // Step 3: Perform actual validation with sample decryption
        try {
            // Get the sample data
            const sampleData = await sampleResponse.arrayBuffer();
            console.log('Received validation sample data, size:', sampleData.byteLength, 'bytes');
            
            // Check if the sample is valid for decryption (needs at least IV + some content)
            if (sampleData.byteLength < 13) {
                console.warn('Sample is too small for validation:', sampleData.byteLength, 'bytes');
                hideDecryptionProgress();
                return true; // Assume valid for backward compatibility
            }
            
            // Update progress text
            const progressText = DOM.byId('decryptionProgressText');
            if (progressText) {
                progressText.textContent = 'Decrypting validation sample...';
            }
            
            // Try to decrypt the sample with the provided key
            try {
                await FileEncryption.decryptFile(sampleData, key, mimeType);
                console.log('Validation successful: Sample decrypted correctly');
                
                // Update progress text
                if (progressText) {
                    progressText.textContent = 'Key validation successful!';
                }
                
                // Hide progress after a short delay
                setTimeout(hideDecryptionProgress, 1000);
                return true;
            } catch (decryptError) {
                console.error('Validation failed: Cannot decrypt sample with provided key:', decryptError);
                showEncryptionError('Invalid encryption key: The provided key cannot decrypt this file.');
                return false;
            }
        } catch (validationError) {
            console.error('Error during sample validation process:', validationError);
            showEncryptionError('Validation error: ' + validationError.message);
            return false;
        }
    } catch (error) {
        // Handle any unexpected errors during the entire validation process
        console.error('Unexpected error in validation process:', error);
        showEncryptionError('Unexpected error during validation: ' + error.message);
        return false;
    }
}

// Helper function to show encryption errors
function showEncryptionError(message) {
    const encryptionError = DOM.byId('encryptionError');
    if (encryptionError) {
        encryptionError.style.display = 'block';
        encryptionError.textContent = message;
    }
    hideDownloadOptions();
    hideDecryptionProgress();
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
    let downloadURL = null;
    let downloadLink = null;

    try {
        // Initialize progress UI
        showProgressUI('Initializing download...');
        
        // Validate inputs
        if (!key) {
            throw new Error('No encryption key provided');
        }
        if (!fileURL) {
            throw new Error('No file URL provided');
        }
        
        // Step 1: Download the encrypted file
        showProgressUI('Downloading encrypted file...', 10);
        
        let fileResponse;
        try {
            fileResponse = await fetch(fileURL, {
                credentials: 'omit',
                mode: 'cors'
            });
        } catch (fetchError) {
            throw new Error('Failed to download the file: Network error');
        }
        
        if (!fileResponse.ok) {
            throw new Error(`Failed to download the file: Server returned ${fileResponse.status}`);
        }
        
        // Step 2: Get the encrypted data and start decryption
        showProgressUI('Preparing to decrypt file...', 40);
        
        const encryptedData = await fileResponse.arrayBuffer();
        
        if (!encryptedData || encryptedData.byteLength < 13) {
            throw new Error('Downloaded file is invalid or too small');
        }
        
        console.log(`Downloaded encrypted file: ${formatSize(encryptedData.byteLength)} bytes`);
        
        // Step 3: Decrypt the file
        showProgressUI('Decrypting file...', 60);
        
        const decryptedBlob = await FileEncryption.decryptFile(encryptedData, key, mimeType);
        
        // Step 4: Prepare download
        showProgressUI('Preparing download...', 80);
        
        downloadURL = URL.createObjectURL(decryptedBlob);
        downloadLink = document.createElement('a');
        downloadLink.href = downloadURL;
        downloadLink.download = filename || 'download';
        document.body.appendChild(downloadLink);
        
        // Step 5: Trigger download
        showProgressUI('Starting download...', 90);
        
        downloadLink.click();
        
        // Step 6: Show completion
        showProgressUI('Download complete!', 100);
        
        // Hide progress after a delay
        setTimeout(hideDecryptionProgress, 2000);
        
    } catch (error) {
        console.error('Download error:', error);
        
        // Show specific error message
        const encryptionError = DOM.byId('encryptionError');
        if (encryptionError) {
            encryptionError.style.display = 'block';
            encryptionError.textContent = 'Download failed: ' + error.message;
        }
        
        hideDecryptionProgress();
    } finally {
        // Clean up resources
        if (downloadLink && downloadLink.parentNode) {
            setTimeout(() => {
                try {
                    document.body.removeChild(downloadLink);
                    if (downloadURL) {
                        URL.revokeObjectURL(downloadURL);
                    }
                } catch (cleanupError) {
                    console.warn('Cleanup error:', cleanupError);
                }
            }, 100);
        }
    }
}

// Format file size for display
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    else return (bytes / 1073741824).toFixed(1) + ' GB';
}

// Update progress UI with message and percentage
function showProgressUI(message, percent = null) {
    const progressContainer = DOM.byId('decryptionProgress');
    const progressText = DOM.byId('decryptionProgressText');
    const progressBar = DOM.byId('decryptionProgressBar');
    
    if (progressContainer) {
        progressContainer.style.display = 'block';
        progressContainer.classList.add('displayed');
    }
    
    if (progressText && message) {
        progressText.textContent = message;
    }
    
    if (progressBar && percent !== null) {
        progressBar.style.width = percent + '%';
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