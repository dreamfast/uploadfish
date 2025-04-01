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

// --- Tab Switching Logic --- 
function initializeTabs() {
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    if (!tabLinks.length || !tabContents.length) return; // No tabs on this page

    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            const targetTabId = link.getAttribute('data-tab');

            // Deactivate all links and contents
            tabLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(c => {
                c.classList.remove('active');
                c.style.display = 'none'; // Hide explicitly
            });

            // Activate the target link and content
            link.classList.add('active');
            const targetContent = document.getElementById(targetTabId);
            if (targetContent) {
                targetContent.classList.add('active');
                targetContent.style.display = 'block'; // Show explicitly
            }
        });
    });
}

// Load modules when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    
    // Initialize tab switching if tabs exist
    initializeTabs();

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
        
        
        // Initialize the appropriate page
        if (isUploadPage) {
            if (typeof initializeUploader === 'function') {
                safeCall(initializeUploader);
            } else {
                console.error('Upload module not loaded correctly');
            }
        } else if (isPreviewPage) {
            if (typeof initializePreviewPage === 'function') {
                safeCall(initializePreviewPage);
            } else {
                console.error('Preview module not loaded correctly');
            }
        }
    } catch (error) {
        console.error('Error during application initialization:', error);
    }
}); 