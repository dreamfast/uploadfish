/**
 * UploadFish main JavaScript file
 */

// Common initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {   
    // Apply JS class to both html and body elements
    document.documentElement.classList.add('js');
    document.body.classList.add('js');
    
    // Explicitly hide/show elements based on JS support
    const hideElements = document.querySelectorAll('.js-disabled');
    const showElements = document.querySelectorAll('.js-enabled');
    
    hideElements.forEach(el => el.style.display = 'none');
    showElements.forEach(el => el.style.display = 'block');
    
    // Initialize the uploader functionality if we're on the upload page
    initializeUploader();
    
    // Initialize the preview page functionality (copy button)
    initializePreviewPage();
});

// Initialize preview page functionality
function initializePreviewPage() {
    const copyButton = document.getElementById('copyLinkBtn');
    if (copyButton) {
        copyButton.addEventListener('click', function() {
            copyToClipboard();
        });
    }
}

// Copy to clipboard functionality for the preview page
function copyToClipboard() {
    const link = window.location.href;
    
    if (!navigator.clipboard) {
        // Fallback for browsers without clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = link;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            updateCopyButton('Copied!');
        } catch (err) {
            console.error('Fallback: Could not copy text: ', err);
        }
        
        document.body.removeChild(textArea);
        return;
    }
    
    navigator.clipboard.writeText(link)
        .then(() => updateCopyButton('Copied!'))
        .catch(err => console.error('Failed to copy link:', err));
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

// Upload page functionality
function initializeUploader() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    
    // If uploader elements don't exist, we're not on the upload page
    if (!dropZone || !fileInput) return;
    
    const formFileInput = document.getElementById('formFileInput');
    const formExpiryInput = document.getElementById('formExpiryInput');
    const jsExpiry = document.getElementById('jsExpiry');
    const uploadForm = document.getElementById('uploadForm');
    const selectFileBtn = document.getElementById('selectFileBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    // Fish-related processing phrases
    const fishProcessingPhrases = [
        "Catching your fish...",
        "Reeling it in...",
        "Fish on the hook!",
        "Scaling your data...",
        "Baiting the server...",
        "Gone fishing for bytes...",
        "Swimming upstream...",
        "Something's fishy...",
        "Diving into deep waters...",
        "Untangling the net...",
        "Hook, line, and syncing...",
        "Finding Nemo...",
        "Feeding the server sharks...",
        "Splashing around...",
        "Waving to the jellyfish...",
        "Talking to the dolphins...",
        "Exploring the deep web sea...",
        "Fish processing in progress...",
        "Taking the bait...",
        "Uploading to the school of fish...",
        "Teaching fish to code...",
        "Consulting with the octopus...",
        "Swimming with the data stream...",
        "Casting the net wide...",
        "Waiting for the fish to bite...",
        "Checking the water temperature...",
        "Organizing the coral reef...",
        "Synchronizing with the tide...",
        "Playing with the sea horses...",
        "Diving for pearls...",
        "Counting the fish in the sea...",
        "Training the server fish...",
        "Making waves in the data ocean...",
        "Following the data current...",
        "Checking the fish finder...",
        "Preparing the fishing gear...",
        "Setting up the fish trap...",
        "Waiting for the perfect catch...",
        "Measuring the data depth...",
        "Navigating the data waters..."
    ];
    
    // Track the last used phrase index to avoid immediate repetition
    let lastPhraseIndex = -1;
    
    // Get random fish phrase
    function getRandomFishPhrase() {
        let randomIndex;
        do {
            randomIndex = Math.floor(Math.random() * fishProcessingPhrases.length);
        } while (randomIndex === lastPhraseIndex && fishProcessingPhrases.length > 1);
        
        lastPhraseIndex = randomIndex;
        return "90% - " + fishProcessingPhrases[randomIndex];
    }
    
    // Get max file size from the UI
    function getMaxFileSize() {
        const infoElement = document.querySelector('.info strong');
        if (!infoElement) return 1024; // Default to 1GB
        
        const sizeText = infoElement.innerText;
        const match = sizeText.match(/(\d+)/);
        return match && match[1] ? parseInt(match[1], 10) : 1024;
    }
    
    // Get max file size
    const maxSizeMB = getMaxFileSize();
    const maxSizeBytes = maxSizeMB * 1024 * 1024; // Convert to bytes
    
    // Event listeners
    selectFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelection);
    
    // Setup drag and drop
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('highlight');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('highlight');
    });
    
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('highlight');
        
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelection();
        }
    });
    
    // Handle file selection and upload
    function handleFileSelection() {
        if (!fileInput.files.length) return;
        
        const file = fileInput.files[0];
        
        // Check file size before attempting to upload
        if (file.size > maxSizeBytes) {
            showError(`File too large (${formatFileSize(file.size)}). Maximum size is ${maxSizeMB} MB.`);
            fileInput.value = '';
            return;
        }
        
        // Prepare upload
        prepareUpload(file);
        sendUploadRequest();
    }
    
    // Prepare the upload form
    function prepareUpload(file) {
        // Copy the selected file to the form's file input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        formFileInput.files = dataTransfer.files;
        
        // Set and validate the expiry option
        const expiryValue = jsExpiry.value;
        const validExpiryValues = ["1h", "6h", "24h", "72h"];
        
        if (validExpiryValues.includes(expiryValue)) {
            formExpiryInput.value = expiryValue;
        } else {
            console.warn(`Invalid expiry value: ${expiryValue}, using default`);
            formExpiryInput.value = "1h"; // Default to 1 hour if invalid
        }
        
        // Show and reset progress bar
        progressContainer.style.display = 'block';
        progressBar.style.backgroundColor = '#4CAF50';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
    }
    
    // Send the upload request with progress tracking
    function sendUploadRequest() {
        const formData = new FormData(uploadForm);
        ensureCsrfToken(formData);
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload', true);
        
        // Track upload progress
        xhr.upload.onprogress = e => {
            if (e.lengthComputable) {
                // Only update up to 90% for upload progress
                // This reserves the last 10% for server-side processing
                const percent = Math.round((e.loaded / e.total) * 90);
                updateProgress(percent);
            }
        };
        
        // When upload is complete but before server processing is done
        xhr.upload.onload = () => {
            updateProgress(90, getRandomFishPhrase());
        };
        
        // Handle response
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 400) {
                // Success handling
                updateProgress(100, '100% - Complete!');
                // Add a small delay before redirect to show the completion
                setTimeout(() => {
                    redirect(xhr);
                }, 500);
            } else {
                // Error handling
                handleUploadError(xhr);
            }
        };
        
        xhr.onerror = () => showError('Network error during upload.');
        xhr.send(formData);
    }
    
    // Ensure CSRF token is included
    function ensureCsrfToken(formData) {
        const csrfToken = document.getElementById('formCsrfToken').value;
        if (!formData.has('csrf_token')) {
            formData.set('csrf_token', csrfToken);
        }
    }
    
    // Update progress bar
    function updateProgress(percent, text) {
        // Apply transition for smoother animation
        progressBar.style.transition = 'width 0.3s ease-in-out';
        progressBar.style.width = percent + '%';
        
        // Update text with custom message or percentage
        if (text) {
            progressText.textContent = text;
        } else {
            // For regular progress, update with clear message
            if (percent < 90) {
                progressText.textContent = percent + '% - Uploading...';
            } else if (percent === 90) {
                progressText.textContent = getRandomFishPhrase();
            } else {
                progressText.textContent = percent + '% - Complete!';
            }
        }
        
        // Update color based on state
        if (percent === 100) {
            progressBar.style.backgroundColor = '#27ae60'; // Darker green for completion
        }
    }
    
    // Handle redirect after successful upload
    function redirect(xhr) {
        const location = xhr.getResponseHeader('Location') || xhr.responseURL;
        if (location) {
            window.location.href = location;
        } else {
            window.location.href = '/';
        }
    }
    
    // Handle upload errors
    function handleUploadError(xhr) {
        progressBar.style.backgroundColor = '#e74c3c';
        const errorMessage = parseErrorMessage(xhr) || 'Upload failed! Server returned status ' + xhr.status;
        progressText.textContent = errorMessage;
    }
    
    // Show error message in progress area
    function showError(message) {
        progressContainer.style.display = 'block';
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = '#e74c3c';
        progressText.textContent = 'Error: ' + message;
    }
    
    // Try to extract error message from HTML response
    function parseErrorMessage(xhr) {
        if (!xhr.responseText || !xhr.responseText.includes('Error:')) return null;
        
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xhr.responseText, 'text/html');
            const errorElement = doc.querySelector('.error strong');
            if (errorElement && errorElement.nextElementSibling) {
                return errorElement.nextElementSibling.textContent;
            }
        } catch (e) {
            console.error('Error parsing error response:', e);
        }
        return null;
    }
}

// Helper function to format file size
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    else return (bytes / 1073741824).toFixed(1) + ' GB';
} 