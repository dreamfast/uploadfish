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
        updateDownloadProgress(null, 'Validating encryption key...', 'validating');

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
            // Hide progress
            updateDownloadProgress(null, null, null);
            return true;
        }
        
        // Step 3: Perform actual validation with sample decryption
        try {
            // Get the sample data
            const sampleData = await sampleResponse.arrayBuffer();
            
            // Check if the sample is valid for decryption (needs at least IV + some content)
            if (sampleData.byteLength < 13) {
                console.warn('Sample is too small for validation:', sampleData.byteLength, 'bytes');
                // Hide progress
                updateDownloadProgress(null, null, null);
                return true; // Assume valid for backward compatibility
            }
            
            // Update progress text
            updateDownloadProgress(null, 'Decrypting validation sample...', 'validating');
            
            // Try to decrypt the sample with the provided key
            try {
                await FileEncryption.decryptFile(sampleData, key, mimeType);
                
                // Hide progress after a short delay
                setTimeout(() => updateDownloadProgress(null, null, null), 1000);
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
    const controller = new AbortController();
    const signal = controller.signal;
    let lastProgressUpdate = 0;

    try {
        updateDownloadProgress(0, 'Initializing download...', 'downloading');
        
        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 50)); 

        // Step 1: Download the encrypted file using fetch streams
        const response = await fetch(fileURL, {
            method: 'GET',
            credentials: 'omit',
            mode: 'cors',
            signal: signal
        });

        if (!response.ok) {
            throw new Error(`Download failed: Server returned ${response.status}`);
        }

        const reader = response.body.getReader();
        const contentLength = +response.headers.get('Content-Length'); // Get file size
        let receivedLength = 0;
        let chunks = [];
        
        // Show initial progress
        updateDownloadProgress(0, null, 'downloading');

        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                break;
            }
            
            chunks.push(value);
            receivedLength += value.length;
            
            const now = Date.now();
            // Update progress bar, but throttle updates to avoid killing the browser
            if (contentLength && now - lastProgressUpdate > 100) { // Update every 100ms
                const percent = Math.round((receivedLength / contentLength) * 100);
                updateDownloadProgress(percent, null, 'downloading');
                lastProgressUpdate = now;
            } else if (!contentLength && now - lastProgressUpdate > 500) { // Update less often if size unknown
                 // Show bytes downloaded if size is unknown
                 updateDownloadProgress(null, `Downloaded ${formatSize(receivedLength)}...`, 'downloading');
                 lastProgressUpdate = now;
            }
        }
        
        // Ensure final download percentage is shown
         if (contentLength) {
             updateDownloadProgress(100, null, 'downloading');
         } else {
             updateDownloadProgress(null, `Downloaded ${formatSize(receivedLength)}`, 'downloading');
         }
        
        // Combine chunks into a single blob/buffer
        const encryptedBlob = new Blob(chunks, { type: mimeType });
        const encryptedData = await encryptedBlob.arrayBuffer();
        chunks = []; // Clear chunks array to free memory

        // Step 2: Decrypt the file
        updateDownloadProgress(null, 'Download complete. Decrypting file...', 'decrypting');
        
        // Allow UI to update before heavy decryption begins
        await new Promise(resolve => setTimeout(resolve, 100));

        const decryptedFile = await FileEncryption.decryptFile(encryptedData, key, mimeType);
        
        // Step 3: Prepare and trigger download
        updateDownloadProgress(null, 'Decryption complete. Preparing download...', 'decrypting'); // Keep decrypting phase briefly
        
        const decryptedBlob = new Blob([decryptedFile], { type: mimeType });
        const downloadUrl = URL.createObjectURL(decryptedBlob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.download = filename || 'download'; // Use original filename
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Clean up the URL object after a short delay
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 500);

        // Step 4: Show completion
        updateDownloadProgress(100, 'Download complete!', 'complete');

        // Reset UI after a longer delay to show completion message
        setTimeout(resetDownloadUI, 3000);

    } catch (error) {
        console.error('Download/Decryption error:', error);
        // Abort fetch if active
        if (!controller.signal.aborted) {
             controller.abort();
        }
        updateDownloadProgress(null, `Error: ${error.message}`, 'error');
        // Reset UI after showing error
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

// NEW Centralized function to update progress UI (replaces showProgressUI and show/hideDecryptionProgress)
function updateDownloadProgress(percent = null, message = null, phase = null) {
    const progressContainer = DOM.byId('downloadProgress');
    const progressBar = DOM.byId('downloadProgressBar');
    const progressText = DOM.byId('downloadProgressText');
    const downloadSection = DOM.byId('fileActions'); // Needed to hide download button
    const fishLogo = document.querySelector('.preview-logo'); // Assuming logo exists
    
    if (!progressContainer || !progressBar || !progressText) {
        console.error("Progress UI elements not found!");
        return;
    }

    // Clear any existing phrase interval first
    if (window.previewPhraseInterval) {
        clearInterval(window.previewPhraseInterval);
        window.previewPhraseInterval = null;
    }

    // --- Phase Management ---
    document.body.classList.remove('validating-active', 'downloading-active', 'decrypting-active', 'complete-active', 'error-active');
    if (fishLogo) {
       fishLogo.classList.remove('validating', 'downloading', 'decrypting', 'complete', 'error');
    }

    if (phase) {
        document.body.classList.add(phase + '-active');
        if (fishLogo) {
           fishLogo.classList.add(phase);
        }
        
        // Show progress container and hide download button
        progressContainer.style.display = 'block';
        progressContainer.classList.add('displayed');
        if(downloadSection) downloadSection.style.display = 'none';
        
        // --- Progress Bar Style ---
        progressBar.classList.remove('indefinite'); // Reset indefinite state
        progressBar.style.transition = 'width 0.2s ease-in-out'; // Default transition
        progressBar.style.backgroundColor = ''; // Reset color

        if (phase === 'validating' || phase === 'decrypting') {
            progressBar.classList.add('indefinite');
            progressBar.style.width = '100%';
            progressBar.style.transition = 'none';
        } else if (phase === 'downloading' && percent !== null) {
            progressBar.style.width = Math.max(0, Math.min(100, percent)) + '%';
        } else if (phase === 'complete') {
            progressBar.style.width = '100%';
            progressBar.style.backgroundColor = '#27ae60'; // Green for complete
        } else if (phase === 'error') {
            progressBar.style.width = '100%';
            progressBar.style.backgroundColor = '#e74c3c'; // Red for error
        } else {
            // Default/fallback state (e.g., initializing)
            progressBar.style.width = (percent !== null ? percent : 0) + '%';
        }
        
        // --- Progress Text & Phrases ---
        let textContent = message; // Use provided message by default
        
        // Start interval only for ongoing phases
        if (phase === 'downloading' || phase === 'decrypting' || phase === 'validating') {
             // Set initial text if message is null
             if (!textContent) {
                 if (phase === 'downloading') {
                     textContent = (percent !== null ? percent : 0) + '% - ' + getRandomDownloadingPhrase();
                 } else if (phase === 'decrypting') {
                     textContent = getRandomDecryptingPhrase();
                 } else { // validating
                     textContent = "Validating..."; // Default validation text
                 }
             }
             
             // Start interval
             window.previewPhraseInterval = setInterval(() => {
                if (phase === 'downloading') {
                    const currentPercent = parseInt(progressBar.style.width) || 0;
                    progressText.textContent = currentPercent + '% - ' + getRandomDownloadingPhrase();
                } else if (phase === 'decrypting') {
                     progressText.textContent = getRandomDecryptingPhrase();
                } else { // validating - typically short, maybe no interval needed?
                     // Optionally rotate validating phrases if we add them
                     // progressText.textContent = getRandomValidatingPhrase(); 
                }
             }, 5000); // Rotate every 5 seconds
        }
        
        // Set the final text content
        progressText.textContent = textContent;

    } else {
        // Phase is null: Hide the progress container, show download button
        progressContainer.style.display = 'none';
        progressContainer.classList.remove('displayed');
        if(downloadSection) downloadSection.style.display = 'flex';
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