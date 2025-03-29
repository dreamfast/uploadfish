/**
 * UploadFish main JavaScript file
 * This file loads the appropriate modules based on page type
 */

// Add class to HTML tag to indicate JavaScript is enabled
document.documentElement.className = 'js';

// Function to safely call a function if it exists
function safeCall(fn, ...args) {
    if (typeof fn === 'function') {
        try {
            return fn(...args);
        } catch (error) {
            console.error(`Error calling function ${fn.name}:`, error);
            return null;
        }
    }
    return null;
}

// Load modules when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    console.log('UploadFish initializing...');
    
    try {
        // Check for required modules
        if (typeof DOM === 'undefined') {
            console.error('DOM module not loaded');
        }
        
        if (typeof FileEncryption === 'undefined') {
            console.error('FileEncryption module not loaded');
        }
        
        // Determine what page we're on
        const isUploadPage = document.querySelector('#dropZone') !== null;
        const isPreviewPage = document.body.hasAttribute('data-encrypted') || 
                             document.getElementById('previewContainer') !== null;
        
        console.log('Page type:', isUploadPage ? 'Upload' : (isPreviewPage ? 'Preview' : 'Other'));
        
        // Initialize the appropriate page
        if (isUploadPage) {
            if (typeof initializeUploader === 'function') {
                console.log('Initializing uploader page...');
                safeCall(initializeUploader);
            } else {
                console.error('Upload module not loaded correctly');
            }
        } else if (isPreviewPage) {
            if (typeof initializePreviewPage === 'function') {
                console.log('Initializing preview page...');
                safeCall(initializePreviewPage);
            } else {
                console.error('Preview module not loaded correctly');
            }
        }
        
        // Check for encryption support
        if (typeof FileEncryption !== 'undefined') {
            const isSupported = FileEncryption.isEncryptionSupported();
            console.log('Encryption support:', isSupported ? 'Available' : 'Not available');
            
            if (!isSupported && typeof showEncryptionWarning === 'function') {
                safeCall(showEncryptionWarning);
            }
        }
    } catch (error) {
        console.error('Error during application initialization:', error);
    }
}); 