/**
 * UploadFish main JavaScript file
 * This file loads the appropriate modules based on page type
 */

// Add class to HTML tag to indicate JavaScript is enabled
document.documentElement.className = 'js';

// Load modules when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // Determine what page we're on
    const isUploadPage = document.querySelector('#dropZone') !== null;
    const isPreviewPage = document.body.hasAttribute('data-encrypted') || 
                         document.getElementById('previewContainer') !== null;
    
    // Initialize the appropriate page
    if (isUploadPage) {
        // We're on the upload page - initialize uploader
        initializeUploader();
    } else if (isPreviewPage) {
        // We're on the preview/download page - initialize preview
        initializePreviewPage();
    }
});

// Check for encryption support and show warning if needed
document.addEventListener('DOMContentLoaded', function() {
    if (typeof FileEncryption !== 'undefined') {
        const isSupported = FileEncryption.isEncryptionSupported();
        if (!isSupported && typeof showEncryptionWarning === 'function') {
            showEncryptionWarning();
        }
    }
}); 