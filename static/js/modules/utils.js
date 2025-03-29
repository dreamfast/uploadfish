/**
 * Utility functions for the application
 */

/**
 * Format file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size string
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    else return (bytes / 1073741824).toFixed(1) + ' GB';
}

/**
 * Show encryption not supported warning
 */
function showEncryptionWarning() {
    const encryptionCheckbox = document.getElementById('encryptionEnabled');
    if (encryptionCheckbox) {
        encryptionCheckbox.checked = false;
        encryptionCheckbox.disabled = true;

        const warning = document.createElement('div');
        warning.className = 'encryption-warning';
        warning.innerHTML = '<p>Your browser does not support secure encryption. Files will be uploaded unencrypted.</p>';

        const parent = encryptionCheckbox.closest('.form-group');
        parent.appendChild(warning);
    }
}

/**
 * Copy text to clipboard with fallback for older browsers
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - Promise resolving to success state
 */
function copyToClipboard(text) {
    return new Promise((resolve) => {
        // Use the modern Clipboard API first
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text)
                .then(() => resolve(true))
                .catch(err => {
                    console.error('Clipboard API error:', err);
                    const success = fallbackCopyToClipboard(text);
                    resolve(success);
                });
            return;
        }
        
        // Fallback for browsers without clipboard API
        const success = fallbackCopyToClipboard(text);
        resolve(success);
    });
}

/**
 * Fallback copy method for older browsers
 * @param {string} text - Text to copy
 * @returns {boolean} - Success state
 */
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
        
        return successful;
    } catch (err) {
        console.error('Fallback: Could not copy text:', err);
        return false;
    }
}

/**
 * Update preview with content
 * @param {string} objectURL - Object URL of the content
 * @param {string} mimeType - MIME type of the content
 */
function updatePreview(objectURL, mimeType) {
    if (mimeType.startsWith('image/')) {
        const img = document.getElementById('previewImage');
        if (img) img.src = objectURL;
    } else if (mimeType.startsWith('video/')) {
        const source = document.getElementById('previewVideoSource');
        if (source) {
            source.src = objectURL;
            document.getElementById('previewVideo').load();
        }
    } else if (mimeType.startsWith('audio/')) {
        const source = document.getElementById('previewAudioSource');
        if (source) {
            source.src = objectURL;
            document.getElementById('previewAudio').load();
        }
    }
}

// Export functions
if (typeof module !== 'undefined') {
    module.exports = {
        formatFileSize,
        showEncryptionWarning,
        copyToClipboard,
        fallbackCopyToClipboard,
        updatePreview
    };
} 