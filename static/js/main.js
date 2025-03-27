/**
 * UploadFish main JavaScript file
 */

/**
 * FileEncryption utility class
 * Uses Web Crypto API for secure client-side encryption
 */
class FileEncryption {
    /**
     * Generate a random encryption key and format it as base64
     * @returns {Promise<string>} The base64 encoded encryption key
     */
    static async generateKey() {
        // Generate a random 256-bit key (32 bytes)
        const key = new Uint8Array(32);
        window.crypto.getRandomValues(key);
        
        // Convert to base64 for easier handling in URLs
        return this.arrayBufferToBase64(key);
    }
    
    /**
     * Encrypt a file with the provided base64 key
     * @param {File} file - The file to encrypt
     * @param {string} base64Key - The base64 encoded encryption key
     * @returns {Promise<Blob>} - The encrypted file as a Blob
     */
    static async encryptFile(file, base64Key) {
        // Convert the base64 key back to an array buffer
        const keyData = this.base64ToArrayBuffer(base64Key);
        
        // Create a random initialization vector
        const iv = new Uint8Array(12); // 96 bits for AES-GCM
        window.crypto.getRandomValues(iv);
        
        // Import the key
        const key = await window.crypto.subtle.importKey(
            "raw",
            keyData,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt"]
        );
        
        // Read the file as an ArrayBuffer
        const fileBuffer = await this.readFileAsArrayBuffer(file);
        
        // Encrypt the file content
        const encryptedContent = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            fileBuffer
        );
        
        // Create a combined buffer: IV + encrypted content
        const combinedBuffer = this.concatArrayBuffers(iv.buffer, encryptedContent);
        
        // Return as a Blob with original file type
        return new Blob([combinedBuffer], { type: file.type });
    }
    
    /**
     * Decrypt a file with the provided base64 key
     * @param {ArrayBuffer} encryptedData - The encrypted file data
     * @param {string} base64Key - The base64 encoded encryption key
     * @param {string} fileType - The MIME type of the original file
     * @returns {Promise<Blob>} - The decrypted file as a Blob
     */
    static async decryptFile(encryptedData, base64Key, fileType) {
        try {
            // Convert the base64 key back to an array buffer
            const keyData = this.base64ToArrayBuffer(base64Key);
            
            // Extract the IV from the beginning of the data (first 12 bytes)
            const iv = new Uint8Array(encryptedData.slice(0, 12));
            
            // Extract the encrypted content (everything after the IV)
            const encryptedContent = new Uint8Array(encryptedData.slice(12));
            
            // Import the key
            const key = await window.crypto.subtle.importKey(
                "raw",
                keyData,
                { name: "AES-GCM", length: 256 },
                false,
                ["decrypt"]
            );
            
            // Decrypt the content
            const decryptedContent = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                key,
                encryptedContent
            );
            
            // Return as a Blob with original file type
            return new Blob([decryptedContent], { type: fileType });
        } catch (error) {
            console.error("Decryption failed:", error);
            throw new Error("Failed to decrypt file. The encryption key may be incorrect.");
        }
    }
    
    // Helper methods
    
    /**
     * Read a file as an ArrayBuffer
     * @param {File} file - The file to read
     * @returns {Promise<ArrayBuffer>} - The file content as ArrayBuffer
     */
    static readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }
    
    /**
     * Concatenate two ArrayBuffers
     * @param {ArrayBuffer} buffer1 - First buffer
     * @param {ArrayBuffer} buffer2 - Second buffer
     * @returns {ArrayBuffer} - Combined buffer
     */
    static concatArrayBuffers(buffer1, buffer2) {
        const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
        tmp.set(new Uint8Array(buffer1), 0);
        tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
        return tmp.buffer;
    }
    
    /**
     * Convert ArrayBuffer to base64 string
     * @param {ArrayBuffer|Uint8Array} buffer - Buffer to convert
     * @returns {string} - Base64 encoded string
     */
    static arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary)
            .replace(/\+/g, '-') // URL safe base64
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }
    
    /**
     * Convert base64 string to ArrayBuffer
     * @param {string} base64 - Base64 encoded string
     * @returns {ArrayBuffer} - Decoded array buffer
     */
    static base64ToArrayBuffer(base64) {
        // Restore standard base64 for atob
        base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
        // Add padding if needed
        while (base64.length % 4 !== 0) {
            base64 += '=';
        }
        
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
    
    /**
     * Check if encryption is supported in this browser
     * @returns {boolean} - True if encryption is supported
     */
    static isEncryptionSupported() {
        return window.crypto && 
               window.crypto.subtle && 
               typeof window.crypto.subtle.encrypt === 'function';
    }
}

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
    
    // Check if encryption is supported and show warning if not
    if (!FileEncryption.isEncryptionSupported()) {
        showEncryptionWarning();
    }
    
    // Initialize the uploader functionality if we're on the upload page
    initializeUploader();
    
    // Initialize the preview page functionality
    initializePreviewPage();
});

// Show encryption not supported warning
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

// Initialize preview page functionality
function initializePreviewPage() {
    // Check if we're on the preview page
    const previewContainer = document.getElementById('previewContainer');
    if (!previewContainer) return;
    
    // Initialize copy link button functionality
    const copyButton = document.getElementById('copyLinkBtn');
    if (copyButton) {
        copyButton.addEventListener('click', function() {
            copyToClipboard();
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
    
    if (isEncrypted) {
        document.getElementById('encryptionNotice').style.display = 'flex';
        
        // Get the encryption key from the URL fragment
        const encryptionKey = window.location.hash.substring(1);
        if (encryptionKey) {
            handleEncryptedFile(encryptionKey, fileURL, mimeType);
        } else {
            document.getElementById('encryptionError').style.display = 'block';
            hideDownloadOptions();
        }
        
        // Update download button to include the key in the URL
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn && encryptionKey) {
            const currentHref = downloadBtn.getAttribute('href');
            downloadBtn.setAttribute('href', currentHref + '#' + encryptionKey);
            
            // For direct downloads, we need to handle it with JS
            downloadBtn.addEventListener('click', function(e) {
                e.preventDefault();
                handleEncryptedDownload(encryptionKey, fileURL, mimeType, filename);
            });
        }
    }
}

// Hide download options when decryption fails
function hideDownloadOptions() {
    // Hide download button and copy link button, but keep the "Upload Another File" button
    const downloadBtn = document.getElementById('downloadBtn');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const downloadTip = document.getElementById('downloadTip');
    
    if (downloadBtn) downloadBtn.style.display = 'none';
    if (copyLinkBtn) copyLinkBtn.style.display = 'none';
    if (downloadTip) downloadTip.style.display = 'none';
}

// Handle encrypted file preview
async function handleEncryptedFile(key, fileURL, mimeType) {
    try {
        // Show decryption progress
        const progressContainer = document.getElementById('decryptionProgress');
        progressContainer.style.display = 'block';
        
        // Fetch the encrypted file
        const response = await fetch(fileURL);
        if (!response.ok) {
            throw new Error('Failed to fetch file');
        }
        
        // Get the encrypted data
        const encryptedData = await response.arrayBuffer();
        
        // Decrypt the file
        const decryptedBlob = await FileEncryption.decryptFile(encryptedData, key, mimeType);
        
        // Create object URL for the decrypted file
        const objectURL = URL.createObjectURL(decryptedBlob);
        
        // Update preview based on file type
        updatePreview(objectURL, mimeType);
        
        // Hide progress
        progressContainer.style.display = 'none';
        
        // Show preview container
        document.getElementById('previewContainer').style.display = 'block';
    } catch (error) {
        console.error('Decryption failed:', error);
        document.getElementById('decryptionProgress').style.display = 'none';
        document.getElementById('encryptionError').style.display = 'block';
        hideDownloadOptions();
    }
}

// Update the preview with decrypted content
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

// Handle direct download of encrypted file
async function handleEncryptedDownload(key, fileURL, mimeType, filename) {
    try {
        // Show decryption progress
        const progressContainer = document.getElementById('decryptionProgress');
        const progressText = document.getElementById('decryptionProgressText');
        progressContainer.style.display = 'block';
        progressText.textContent = 'Preparing download...';
        
        // Fetch the encrypted file
        const response = await fetch(fileURL);
        if (!response.ok) {
            throw new Error('Failed to fetch file');
        }
        
        // Get the encrypted data
        const encryptedData = await response.arrayBuffer();
        
        progressText.textContent = 'Decrypting...';
        
        // Decrypt the file
        const decryptedBlob = await FileEncryption.decryptFile(encryptedData, key, mimeType);
        
        // Trigger download
        progressText.textContent = 'Download starting...';
        
        const a = document.createElement('a');
        a.href = URL.createObjectURL(decryptedBlob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Hide progress after a short delay
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 1000);
        
    } catch (error) {
        console.error('Download failed:', error);
        document.getElementById('decryptionProgress').style.display = 'none';
        document.getElementById('encryptionError').style.display = 'block';
        hideDownloadOptions();
    }
}

// Copy to clipboard functionality for the preview page
function copyToClipboard() {
    // Include the full URL with the hash fragment
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
    const formEncryptedInput = document.getElementById('formEncryptedInput');
    const jsExpiry = document.getElementById('jsExpiry');
    const encryptionEnabled = document.getElementById('encryptionEnabled');
    const uploadForm = document.getElementById('uploadForm');
    const selectFileBtn = document.getElementById('selectFileBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    // Check if encryption is available in this browser
    const isEncryptionSupported = FileEncryption.isEncryptionSupported();
    
    // If encryption is not supported, disable the option
    if (!isEncryptionSupported && encryptionEnabled) {
        encryptionEnabled.checked = false;
        encryptionEnabled.disabled = true;
    }
    
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
    
    // Encryption-specific phrases
    const encryptionPhrases = [
        "Encrypting your fish...",
        "Securing the treasure...",
        "Putting your data in a safe...",
        "Scrambling the message...",
        "Building an underwater vault...",
        "Creating a secret reef...",
        "Generating submarine codes...",
        "Hiding the treasure map...",
        "Making your data invisible...",
        "Protecting with underwater shields..."
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
    
    // Get random encryption phrase
    function getRandomEncryptionPhrase() {
        return encryptionPhrases[Math.floor(Math.random() * encryptionPhrases.length)];
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
    }
    
    // Prepare the upload form
    function prepareUpload(file) {
        // Show and reset progress bar
        progressContainer.style.display = 'block';
        progressBar.style.backgroundColor = '#4CAF50';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        
        // Set and validate the expiry option
        const expiryValue = jsExpiry.value;
        const validExpiryValues = ["1h", "6h", "24h", "72h"];
        
        if (validExpiryValues.includes(expiryValue)) {
            formExpiryInput.value = expiryValue;
        } else {
            console.warn(`Invalid expiry value: ${expiryValue}, using default`);
            formExpiryInput.value = "1h"; // Default to 1 hour if invalid
        }
        
        // Check if encryption is enabled and supported
        const shouldEncrypt = encryptionEnabled && 
                             encryptionEnabled.checked && 
                             isEncryptionSupported;
        
        formEncryptedInput.value = shouldEncrypt ? "true" : "false";
        
        if (shouldEncrypt) {
            // Update progress to show encryption state
            updateProgress(20, getRandomEncryptionPhrase());
            
            // Encrypt the file before upload
            encryptAndUpload(file);
        } else {
            // If not encrypting, proceed with normal upload
            processRegularUpload(file);
        }
    }
    
    // Handle encryption and upload
    async function encryptAndUpload(file) {
        try {
            // Generate a random encryption key
            const encryptionKey = await FileEncryption.generateKey();
            
            // Update progress
            updateProgress(40, "Encrypting your file...");
            
            // Encrypt the file
            const encryptedBlob = await FileEncryption.encryptFile(file, encryptionKey);
            
            // Update progress
            updateProgress(70, "File encrypted! Preparing upload...");
            
            // Create a File object from the encrypted blob
            const encryptedFile = new File([encryptedBlob], file.name, {
                type: file.type,
                lastModified: file.lastModified
            });
            
            // Copy the encrypted file to the form's file input
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(encryptedFile);
            formFileInput.files = dataTransfer.files;
            
            // Send the upload request
            sendUploadRequest(encryptionKey);
        } catch (error) {
            console.error('Encryption failed:', error);
            showError('Encryption failed: ' + error.message);
        }
    }
    
    // Process regular, unencrypted upload
    function processRegularUpload(file) {
        // Copy the selected file to the form's file input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        formFileInput.files = dataTransfer.files;
        
        // Send the upload request
        sendUploadRequest();
    }
    
    // Send the upload request with progress tracking
    function sendUploadRequest(encryptionKey = null) {
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
                    // Check if we have an encryption key to append to the URL
                    if (encryptionKey) {
                        redirect(xhr, encryptionKey);
                    } else {
                        redirect(xhr);
                    }
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
    function redirect(xhr, encryptionKey = null) {
        let location = xhr.getResponseHeader('Location') || xhr.responseURL;
        
        // If we have an encryption key, append it as a URL fragment
        if (location && encryptionKey) {
            location += '#' + encryptionKey;
        }
        
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