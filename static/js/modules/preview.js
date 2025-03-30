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
        
        
        // Step 2: Get the sample file to validate against
        let sampleResponse;
        try {
            // Get the base URL without query parameters for the sample file
            const baseURL = fileURL.split('?')[0];
            
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
            hideDecryptionProgress();
            return true;
        }
        
        // Step 3: Perform actual validation with sample decryption
        try {
            // Get the sample data
            const sampleData = await sampleResponse.arrayBuffer();
            
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

// Reset UI after download is complete
function resetDownloadUI() {
    const downloadSection = DOM.byId('fileActions');
    const progressContainer = DOM.byId('downloadProgress');
    
    if (downloadSection) downloadSection.style.display = 'flex';
    if (progressContainer) {
        progressContainer.style.display = 'none';
        progressContainer.classList.remove('displayed');
    }
    
    // Remove all phase classes
    document.body.classList.remove('downloading-active', 'decrypting-active');
    
    // Reset fish logo animation
    const fishLogo = document.querySelector('.preview-logo');
    if (fishLogo) {
        fishLogo.classList.remove('downloading', 'decrypting');
    }
    
    // Clear any phrase rotation intervals
    if (window.previewPhraseInterval) {
        clearInterval(window.previewPhraseInterval);
        window.previewPhraseInterval = null;
    }
}

// Handle direct download of encrypted file
async function handleEncryptedDownload(key, fileURL, mimeType, filename) {
    try {
        // Show progress UI
        showProgressUI('Initializing download...');
        
        // Create abort controller for fetch
        const controller = new AbortController();
        const signal = controller.signal;
        
        try {
            // Step 1: Download the encrypted file
            showProgressUI('Downloading encrypted file...', 10);
            
            const response = await fetch(fileURL, {
                method: 'GET',
                credentials: 'omit',
                mode: 'cors',
                signal: signal
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Get file as ArrayBuffer for decryption
            const encryptedData = await response.arrayBuffer();
            
            // Show 40% progress after download completes
            showProgressUI('Preparing to decrypt file...', 40);
            
            // Allow UI to update before heavy decryption begins
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Step 2: Decrypt the file
            showProgressUI('Decrypting file...', 60);
            
            // Decrypt the file using the encryption key from the URL hash
            const decryptedFile = await FileEncryption.decryptFile(encryptedData, key, mimeType);
            
            // Step 3: Prepare for download
            showProgressUI('Preparing download...', 80);
            
            // Create a blob from the decrypted file
            const blob = new Blob([decryptedFile], { type: mimeType });
            
            // Step 4: Download the decrypted file
            const downloadUrl = URL.createObjectURL(blob);
            
            // Create a temporary link to trigger the download
            const downloadLink = document.createElement('a');
            downloadLink.href = downloadUrl;
            downloadLink.download = filename || 'download';
            
            // Trigger download
            showProgressUI('Starting download...', 90);
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // Clean up the URL object after a delay
            setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
            
            // Complete progress
            showProgressUI('Download complete!', 100);
            
            // Reset UI after a delay
            setTimeout(resetDownloadUI, 2000);
            
        } catch (error) {
            // Error handling
            console.error('Download error:', error);
            
            showProgressUI('Error: ' + error.message);
            
            // Abort the fetch if it's still in progress
            controller.abort();
            
            // Reset UI after error display
            setTimeout(resetDownloadUI, 5000);
        }
        
    } catch (error) {
        console.error('Unexpected error in download process:', error);
        showProgressUI('Unexpected error: ' + error.message);
        
        // Reset UI after error display
        setTimeout(resetDownloadUI, 5000);
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
    const downloadSection = DOM.byId('fileActions');
    const progressContainer = DOM.byId('downloadProgress');
    const progressBar = DOM.byId('downloadProgressBar');
    const progressText = DOM.byId('downloadProgressText');
    
    if (!progressContainer || !progressBar || !progressText) return;
    
    // Show progress UI
    if (downloadSection) downloadSection.style.display = 'none';
    progressContainer.style.display = 'block';
    progressContainer.classList.add('displayed'); // Add displayed class for better spacing
    
    // Determine the current phase based on the message
    let currentPhase = null;
    if (message && message.includes('Decrypt')) {
        currentPhase = 'decrypting';
    } else if (message && message.includes('Download')) {
        currentPhase = 'downloading';
    }
    
    // Remove all phase classes and add the current one
    document.body.classList.remove('downloading-active', 'decrypting-active');
    if (currentPhase) {
        document.body.classList.add(currentPhase + '-active');
    }
    
    // Update fish logo animation based on phase
    const fishLogo = document.querySelector('.preview-logo');
    if (fishLogo) {
        fishLogo.classList.remove('downloading', 'decrypting');
        if (currentPhase) {
            fishLogo.classList.add(currentPhase);
        }
    }
    
    // Handle indefinite progress bar for decryption
    if (currentPhase === 'decrypting') {
        // Use indefinite progress bar
        progressBar.classList.add('indefinite');
        
        // Set progress text from uploadFishPhrases
        progressText.textContent = uploadFishPhrases.getRandomDecryptingPhrase();
        
        // Start phrase rotation for decryption
        if (!window.previewPhraseInterval) {
            window.previewPhraseInterval = setInterval(function() {
                progressText.textContent = uploadFishPhrases.getRandomDecryptingPhrase();
            }, 5000);
        }
    } else {
        // Use percentage-based progress bar
        progressBar.classList.remove('indefinite');
        
        // Update progress bar with percent
        if (percent !== null) {
            progressBar.style.width = percent + '%';
            
            // Get phrase from the appropriate category based on phase
            if (currentPhase === 'downloading') {
                // Set progress text with percentage and downloading phrase
                progressText.textContent = percent + '% - ' + uploadFishPhrases.getRandomDownloadingPhrase();
                
                // Start phrase rotation for downloading
                if (!window.previewPhraseInterval) {
                    window.previewPhraseInterval = setInterval(function() {
                        const currentPercent = parseInt(progressBar.style.width) || percent;
                        progressText.textContent = currentPercent + '% - ' + uploadFishPhrases.getRandomDownloadingPhrase();
                    }, 5000);
                }
            } else {
                // Default progress text
                progressText.textContent = message;
            }
        } else {
            // Default progress text
            progressText.textContent = message;
        }
    }
    
    // Clear the phrase interval if we're done
    if (percent === 100) {
        progressText.textContent = '100% - Complete!';
        if (window.previewPhraseInterval) {
            clearInterval(window.previewPhraseInterval);
            window.previewPhraseInterval = null;
        }
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