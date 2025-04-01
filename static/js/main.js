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

                // --- Call displayHistory if History tab is activated ---
                if (targetTabId === 'history-tab') {
                    displayHistory();
                }
                // -----------------------------------------------------
            }
        });
    });
}

// --- History Tab Functionality ---

function displayHistory() {
    const listContainer = document.getElementById('historyList');
    const emptyMsg = document.getElementById('historyEmptyMsg');
    const clearBtn = document.getElementById('clearHistoryBtn');

    if (!listContainer || !emptyMsg || !clearBtn) return; // Elements not found

    let history = [];
    try {
        history = JSON.parse(localStorage.getItem('uploadHistory') || '[]');
    } catch (e) {
        console.error("Error parsing history from localStorage:", e);
        history = [];
    }

    // Filter out expired items (excluding 'when_downloaded' which has expiryTime=null)
    const now = Date.now();
    const validHistory = history.filter(item => {
        // Keep items with null expiryTime (e.g., 'when_downloaded')
        // Keep items where expiryTime is a future timestamp
        return item.expiryTime === null || (typeof item.expiryTime === 'number' && item.expiryTime > now);
    });

    // Clear previous list content
    listContainer.innerHTML = '';

    if (validHistory.length === 0) {
        emptyMsg.style.display = 'block';
        listContainer.style.display = 'none';
        clearBtn.style.display = 'none';
    } else {
        emptyMsg.style.display = 'none';
        listContainer.style.display = ''; // Use default display (block or grid)
        clearBtn.style.display = '';

        // Sort by upload time, newest first
        validHistory.sort((a, b) => (b.uploadTime || 0) - (a.uploadTime || 0));

        validHistory.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'history-item';

            const filename = item.filename || 'unknown_file';
            const size = typeof item.size === 'number' ? formatFileSize(item.size) : 'N/A';
            const uploadDate = item.uploadTime ? new Date(item.uploadTime).toLocaleString() : 'N/A';
            let expiryText = item.expiryValue || 'N/A';
            if (item.expiryTime) {
                expiryText += ` (expires ${new Date(item.expiryTime).toLocaleString()})`;
            } else if (item.expiryValue === 'when_downloaded') {
                 expiryText = 'Expires when downloaded';
            }
            const encryptionStatus = item.isEncrypted ? 'Encrypted' : 'Not Encrypted';
            const url = item.url || '';
            const linkHref = item.isEncrypted && item.key ? `${url}#${item.key}` : url;

            itemDiv.innerHTML = `
                <div class="history-item-details">
                    <strong class="history-item-filename">${filename}</strong>
                    <span class="history-item-info">Size: ${size}</span>
                    <span class="history-item-info">Uploaded: ${uploadDate}</span>
                    <span class="history-item-info">Expiry: ${expiryText}</span>
                    <span class="history-item-info">Status: ${encryptionStatus}</span>
                </div>
                <div class="history-item-actions">
                    ${linkHref ? `<a href="${linkHref}" class="btn btn-secondary btn-sm" target="_blank">View</a>` : ''}
                </div>
            `;
            listContainer.appendChild(itemDiv);
        });
    }
}

function setupHistoryTab() {
    const clearBtn = document.getElementById('clearHistoryBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear your entire upload history for this browser?')) {
                try {
                    localStorage.removeItem('uploadHistory');
                    console.log("Upload history cleared.");
                    displayHistory(); // Refresh the view
                } catch (e) {
                    console.error("Failed to clear history:", e);
                }
            }
        });
    }
}

// --- End History Tab Functionality ---

// Load modules when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    
    // Initialize tab switching if tabs exist
    initializeTabs();

    // Setup History Tab specific listeners
    setupHistoryTab();

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