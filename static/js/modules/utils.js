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

// --- History Management ---

/**
 * Saves an upload record to localStorage.
 * @param {object} item - The history item object to save.
 */
function saveToHistory(item) {
    if (!item || !item.id) {
        console.error("Attempted to save invalid item to history");
        return;
    }
    try {
        // Ensure uploadTime is set, default to now if missing
        if (!item.uploadTime) {
            item.uploadTime = Date.now();
        }

        const history = JSON.parse(localStorage.getItem('uploadHistory') || '[]');
        // Optional: Prevent duplicates? Check if item.id already exists?
        
        // Optional: Limit history size (e.g., keep last 50)
        const MAX_HISTORY_ITEMS = 50; 
        while (history.length >= MAX_HISTORY_ITEMS) {
            history.shift(); // Remove the oldest item
        }

        history.push(item);
        localStorage.setItem('uploadHistory', JSON.stringify(history));
        console.log("Saved item to history:", item.id);
    } catch (e) {
        console.error("Failed to save item to history:", e);
    }
}

/**
 * Calculates the expiry timestamp based on the expiry value string.
 * @param {string} expiryValue - e.g., "1h", "6h", "24h", "72h", "when_downloaded".
 * @param {number} uploadTimestamp - The timestamp (ms since epoch) when the upload occurred.
 * @returns {number|null} The expiry timestamp (ms since epoch), or null if invalid/never/when_downloaded.
 */
function parseExpiryValueToTimestamp(expiryValue, uploadTimestamp) {
    if (!expiryValue || !uploadTimestamp) return null;
    if (expiryValue === 'when_downloaded') return null; // Use null to represent this special case

    const now = new Date(uploadTimestamp); // Use upload time as the base
    let durationMs = 0;

    const value = parseInt(expiryValue.slice(0, -1), 10); // Explicit radix 10
    const unit = expiryValue.slice(-1).toLowerCase();

    if (isNaN(value) || value <= 0) {
        console.warn("Invalid numeric value in expiry string:", expiryValue);
        return null;
    }

    switch (unit) {
        case 'h': // hours
            durationMs = value * 60 * 60 * 1000;
            break;
        case 'd': // days
            durationMs = value * 24 * 60 * 60 * 1000;
            break;
        // Add 'm' for minutes or 'w' for weeks if needed later
        default:
            console.warn("Invalid unit in expiry string:", expiryValue);
            return null; // Invalid unit
    }

    return now.getTime() + durationMs; // Return expiry timestamp
}

// --- End History Management ---

// Export functions if using modules, otherwise they are global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        copyToClipboard,
        formatFileSize,
        saveToHistory,
        parseExpiryValueToTimestamp
    };
} 