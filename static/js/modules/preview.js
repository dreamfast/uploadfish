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
            // Use the generic copyToClipboard from utils.js
            copyToClipboard(window.location.href)
                .then(success => {
                    updateCopyButton(success ? 'Copied!' : 'Copy failed!');
                })
                .catch(err => { // Should not happen with current implementation, but good practice
                    console.error('Copying failed unexpectedly:', err);
                    updateCopyButton('Copy failed!');
                });
        });
    }

    // Handle encrypted file display and decryption
    handleEncryptedPreview();
}

// Module-scoped variable for phrase interval
let previewPhrasesInterval = null;
let currentDownloadPhrase = ''; // ADD THIS FOR STABLE PHRASE DURING DOWNLOAD

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

// Reset download UI elements to their default state
// (Hides progress, shows download button, clears interval)
function resetDownloadUI() {
    const progressContainer = DOM.byId('downloadProgress');
    const downloadSection = DOM.byId('fileActions');

    // Hide progress
    if (progressContainer) {
        progressContainer.style.display = 'none';
        progressContainer.classList.remove('displayed');
    }

    // Show download button (only if file wasn't invalid due to key)
    const encryptionError = DOM.byId('encryptionError');
    if (downloadSection && (!encryptionError || encryptionError.style.display === 'none')) {
        downloadSection.style.display = 'flex';
    }

    // Clear interval
    if (previewPhrasesInterval) {
        clearInterval(previewPhrasesInterval);
        previewPhrasesInterval = null;
    }

    // Reset body/logo classes (optional but good practice)
    document.body.classList.remove('validating-active', 'downloading-active', 'decrypting-active', 'complete-active', 'error-active');
    const fishLogo = document.querySelector('.preview-logo');
    if (fishLogo) {
        fishLogo.classList.remove('validating', 'downloading', 'decrypting', 'complete', 'error');
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
    if (previewPhrasesInterval) {
        clearInterval(previewPhrasesInterval);
        previewPhrasesInterval = null;
    }

    // Delegate UI updates to helpers
    _setDownloadVisualPhase(phase);
    _updateDownloadProgressBarDisplay(percent, phase);
    _updateDownloadProgressTextDisplay(percent, message, phase);

    if (phase) {
        // Show progress container and hide download button
        progressContainer.style.display = 'block';
        progressContainer.classList.add('displayed');
        if(downloadSection) downloadSection.style.display = 'none';
    } else {
        // Phase is null: Hide the progress container, show download button
        resetDownloadUI(); // Use the centralized reset function
    }
}

// --- Download Progress Helper Functions ---

function _setDownloadVisualPhase(phase) {
    document.body.classList.remove('validating-active', 'downloading-active', 'decrypting-active', 'complete-active', 'error-active');
    const fishLogo = document.querySelector('.preview-logo');
    if (fishLogo) {
       fishLogo.classList.remove('validating', 'downloading', 'decrypting', 'complete', 'error');
    }

    if (phase) {
        document.body.classList.add(phase + '-active');
        if (fishLogo) {
           fishLogo.classList.add(phase);
        }
    }
}

function _updateDownloadProgressBarDisplay(percent, phase) {
    const progressBar = DOM.byId('downloadProgressBar');
    if (!progressBar) return;

    progressBar.classList.remove('indefinite');
    progressBar.style.transition = 'width 0.2s ease-in-out';
    progressBar.style.backgroundColor = ''; // Reset color

    if (phase === 'validating' || phase === 'decrypting') {
        progressBar.classList.add('indefinite');
        progressBar.style.width = '100%';
        progressBar.style.transition = 'none';
    } else if (phase === 'downloading' && percent !== null) {
        progressBar.style.width = Math.max(0, Math.min(100, percent)) + '%';
    } else if (phase === 'complete') {
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = '#27ae60'; // Green
    } else if (phase === 'error') {
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = '#e74c3c'; // Red
    } else {
        progressBar.style.width = (percent !== null ? Math.max(0, Math.min(100, percent)) : 0) + '%';
    }
}

function _updateDownloadProgressTextDisplay(percent, message, phase) {
    const progressText = DOM.byId('downloadProgressText');
    const progressBar = DOM.byId('downloadProgressBar');
    if (!progressText || !progressBar) return;

    // --- REVISED LOGIC v2 ---

    // 1. Clear any existing interval when the phase ends or changes.
    const isRotatingPhase = phase === 'downloading' || phase === 'decrypting';
    if (!isRotatingPhase && previewPhrasesInterval) {
        clearInterval(previewPhrasesInterval);
        previewPhrasesInterval = null;
        currentDownloadPhrase = '';
    }

    let textContent = message;

    // 2. Handle 'downloading' phase
    if (phase === 'downloading') {
        const displayPercent = percent !== null ? percent : parseInt(progressBar.style.width, 10) || 0;

        if (!previewPhrasesInterval) {
            // First tick: Set initial phrase and start the rotator
            currentDownloadPhrase = getRandomDownloadingPhrase();
            
            previewPhrasesInterval = setInterval(() => {
                // Every 5s: get a new phrase and update the text.
                // This is now the ONLY place the phrase changes.
                const currentPercent = parseInt(progressBar.style.width, 10) || 0;
                currentDownloadPhrase = getRandomDownloadingPhrase();
                progressText.textContent = `${currentPercent}% - ${currentDownloadPhrase}`;
            }, 5000);
        }
        
        // On every progress update, just update the text with the current phrase.
        textContent = `${displayPercent}% - ${currentDownloadPhrase}`;

    // 3. Handle other phases
    } else if (phase === 'decrypting') {
         if (!message) {
             textContent = getRandomDecryptingPhrase(); // Initial phrase
             if (!previewPhrasesInterval) {
                 previewPhrasesInterval = setInterval(() => {
                     // Rotate phrase every 5s while decrypting
                     progressText.textContent = getRandomDecryptingPhrase();
                 }, 5000);
             }
         }
    } else if (phase === 'validating' && !textContent) {
        textContent = "Validating...";
    } else if (phase === 'complete' && !textContent) {
        textContent = 'Complete!';
    } else if (phase === 'error' && !textContent) {
        textContent = 'Error!';
    }
    
    // 4. Set the final text content
    progressText.textContent = textContent || ' ';
}

// --- End Download Progress Helper Functions ---

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

// Export main initialization function
if (typeof module !== 'undefined') {
    module.exports = { initializePreviewPage };
} 