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

// Export necessary utility functions
if (typeof module !== 'undefined') {
    module.exports = {
        formatFileSize,
        copyToClipboard,
        fallbackCopyToClipboard
    };
} 