/**
 * UploadFish main JavaScript file
 */

/**
 * DOM utility functions for more efficient element selection and manipulation
 */
const DOM = {
    // Get element by ID with caching
    byId: (() => {
        const cache = {};
        return (id) => {
            if (!(id in cache)) {
                cache[id] = document.getElementById(id);
            }
            return cache[id];
        };
    })(),
    
    // Get elements by class name
    byClass: (className, parent = document) => parent.getElementsByClassName(className),
    
    // Get elements by tag name
    byTag: (tagName, parent = document) => parent.getElementsByTagName(tagName),
    
    // Query selector
    query: (selector, parent = document) => parent.querySelector(selector),
    
    // Query selector all
    queryAll: (selector, parent = document) => parent.querySelectorAll(selector),
    
    // Create element with attributes and properties
    create: (tag, attributes = {}, content = '') => {
        const element = document.createElement(tag);
        
        // Set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'style' && typeof value === 'object') {
                Object.entries(value).forEach(([prop, val]) => {
                    element.style[prop] = val;
                });
            } else if (key === 'className') {
                element.className = value;
            } else {
                element.setAttribute(key, value);
            }
        });
        
        // Set content
        if (content) {
            element.textContent = content;
        }
        
        return element;
    }
};

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
            {name: "AES-GCM", length: 256},
            false,
            ["encrypt"]
        );

        // Read the file as an ArrayBuffer
        const fileBuffer = await this.readFileAsArrayBuffer(file);

        // Encrypt the file content
        const encryptedContent = await window.crypto.subtle.encrypt(
            {name: "AES-GCM", iv},
            key,
            fileBuffer
        );

        // Create a combined buffer: IV + encrypted content
        const combinedBuffer = this.concatArrayBuffers(iv.buffer, encryptedContent);

        // Return as a Blob with original file type
        return new Blob([combinedBuffer], {type: file.type});
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
            // Check if encryptedData is available and has sufficient length
            if (!encryptedData || encryptedData.byteLength < 13) {
                console.error(`Encrypted data is invalid - size: ${encryptedData ? encryptedData.byteLength : 'undefined'} bytes`);
                throw new Error(`Encrypted data is invalid (size: ${encryptedData ? encryptedData.byteLength : 'undefined'} bytes)`);
            }

            // Convert the base64 key back to an array buffer
            const keyData = this.base64ToArrayBuffer(base64Key);

            // Extract the IV from the beginning of the data (first 12 bytes)
            const iv = new Uint8Array(encryptedData.slice(0, 12));
            console.log("IV bytes:", Array.from(iv).slice(0, 5), "...");

            // Extract the encrypted content (everything after the IV)
            const encryptedContent = new Uint8Array(encryptedData.slice(12));
            
            // Log the data we're working with
            console.log("Decrypting data - total size:", encryptedData.byteLength, 
                        "bytes, IV size:", iv.length, 
                        "bytes, content size:", encryptedContent.length, "bytes");
            
            if (encryptedContent.length < 1) {
                console.error("No encrypted content found after IV");
                throw new Error("No encrypted content found after IV");
            }

            // Import the key
            const key = await window.crypto.subtle.importKey(
                "raw",
                keyData,
                {name: "AES-GCM", length: 256},
                false,
                ["decrypt"]
            );

            // Decrypt the content
            const decryptedContent = await window.crypto.subtle.decrypt(
                {name: "AES-GCM", iv},
                key,
                encryptedContent
            );

            console.log("Decryption successful, decrypted size:", decryptedContent.byteLength, "bytes");

            // Return as a Blob with original file type
            return new Blob([decryptedContent], {type: fileType});
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


        try {
            const binary = atob(base64);

            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            return bytes.buffer;
        } catch (e) {
            console.error('Error in base64ToArrayBuffer:', e);
            throw new Error('Invalid encryption key format: ' + e.message);
        }
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
document.addEventListener('DOMContentLoaded', function () {
    // Check if JavaScript is enabled and add class to html tag
    document.documentElement.className = 'js';

    // Specific page initializations
    if (document.querySelector('#dropZone')) {
        // Initialize the uploader page functionality
        initializeUploader();
    } else if (document.body.hasAttribute('data-encrypted')) {
        // Initialize the preview page functionality
        initializePreviewPage();
    }
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
        copyButton.addEventListener('click', function () {
            copyLinkToClipboard();
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
 * This ensures that we don't allow downloads with invalid keys.
 */
async function validateEncryptionSample(key, fileURL, mimeType, filename) {
    try {
        // Show progress indicator
        const progressContainer = DOM.byId('decryptionProgress');
        if (progressContainer) {
            progressContainer.style.display = 'block';
            const progressText = DOM.byId('decryptionProgressText');
            if (progressText) {
                progressText.textContent = 'Validating encryption key...';
            }
        }
        
        // Fetch the sample data from the server
        const sampleURL = fileURL.split('?')[0] + '.sample';
        const sampleResponse = await fetch(sampleURL, {
            credentials: 'omit',
            mode: 'cors'
        });

        if (!sampleResponse.ok) {
            // If the sample isn't available, we can't validate
            // This is likely an old file before sample support was added
            console.log('Sample not available, skipping validation');
            hideDecryptionProgress();
            return;
        }

        // Get the sample data
        const sampleData = await sampleResponse.arrayBuffer();
        
        console.log('Validating encryption key with sample data...');
        
        // Try to decrypt the sample
        await FileEncryption.decryptFile(sampleData, key, mimeType);
        
        // If we got here, decryption succeeded - show success message
        console.log('Encryption key is valid');
        
        // Update progress
        const progressText = DOM.byId('decryptionProgressText');
        if (progressText) {
            progressText.textContent = 'Key validation successful';
        }
        
        // Hide progress after a short delay
        setTimeout(hideDecryptionProgress, 1000);
        
    } catch (error) {
        console.error('Sample validation failed:', error);
        
        // Show error message
        const encryptionError = DOM.byId('encryptionError');
        if (encryptionError) {
            encryptionError.style.display = 'block';
            encryptionError.textContent = 'Unable to validate encryption key: ' + error.message;
        }
        
        hideDownloadOptions();
        hideDecryptionProgress();
    }
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

// Show decryption progress 
function showDecryptionProgress(message) {
    const progressContainer = DOM.byId('decryptionProgress');
    const progressText = DOM.byId('decryptionProgressText');
    
    if (progressContainer && progressText) {
        if (message) {
            progressText.textContent = message;
        }
        progressContainer.style.display = 'block';
        progressContainer.classList.add('displayed');
    }
}

// Handle direct download of encrypted file
async function handleEncryptedDownload(key, fileURL, mimeType, filename) {
    try {
        // Show decryption progress
        const progressContainer = DOM.byId('decryptionProgress');
        if (progressContainer) {
            progressContainer.style.display = 'block';
            progressContainer.classList.add('displayed');
            
            const progressText = DOM.byId('decryptionProgressText');
            if (progressText) {
                progressText.textContent = 'Downloading encrypted file...';
            }
            
            const progressBar = DOM.byId('decryptionProgressBar');
            if (progressBar) {
                progressBar.style.width = '0%';
            }
        }
        
        // Fetch the encrypted file
        const fileResponse = await fetch(fileURL, {
            credentials: 'omit',
            mode: 'cors'
        });
        
        if (!fileResponse.ok) {
            throw new Error('Failed to download the file');
        }
        
        // Update progress
        const progressText = DOM.byId('decryptionProgressText');
        if (progressText) {
            progressText.textContent = 'Decrypting file...';
        }
        
        const progressBar = DOM.byId('decryptionProgressBar');
        if (progressBar) {
            progressBar.style.width = '50%';
        }
        
        // Get the encrypted data
        const encryptedData = await fileResponse.arrayBuffer();
        
        // Decrypt the file
        const decryptedBlob = await FileEncryption.decryptFile(encryptedData, key, mimeType);
        
        // Update progress
        if (progressBar) {
            progressBar.style.width = '90%';
        }
        
        if (progressText) {
            progressText.textContent = 'Preparing download...';
        }
        
        // Create a download link and trigger it
        const downloadURL = URL.createObjectURL(decryptedBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadURL;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(downloadURL);
        }, 100);
        
        // Complete progress
        if (progressBar) {
            progressBar.style.width = '100%';
        }
        
        if (progressText) {
            progressText.textContent = 'Download complete!';
        }
        
        // Hide progress after a delay
        setTimeout(hideDecryptionProgress, 2000);
        
    } catch (error) {
        console.error('Download failed:', error);
        
        // Show error
        const encryptionError = DOM.byId('encryptionError');
        if (encryptionError) {
            encryptionError.style.display = 'block';
            encryptionError.textContent = 'Download failed: ' + error.message;
        }
        
        hideDecryptionProgress();
    }
}

// Copy link to clipboard
function copyLinkToClipboard() {
    const link = window.location.href;

    // Use the modern Clipboard API first
    if (navigator.clipboard) {
        navigator.clipboard.writeText(link)
            .then(() => updateCopyButton('Copied!'))
            .catch(err => {
                console.error('Clipboard API error:', err);
                fallbackCopyToClipboard(link);
            });
        return;
    }
    
    // Fallback for browsers without clipboard API
    fallbackCopyToClipboard(link);
}

// Fallback copy method for older browsers
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
        
        if (successful) {
            updateCopyButton('Copied!');
        } else {
            console.error('Fallback: Copy command was unsuccessful');
            updateCopyButton('Copy failed!');
        }
    } catch (err) {
        console.error('Fallback: Could not copy text:', err);
        updateCopyButton('Copy failed!');
    }
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
    // Get DOM elements and cache them
    const dropZone = DOM.byId('dropZone');
    const fileInput = DOM.byId('fileInput');

    // If uploader elements don't exist, we're not on the upload page
    if (!dropZone || !fileInput) return;

    // Cache elements using our DOM utility
    const elements = {
        formFileInput: DOM.byId('formFileInput'),
        formExpiryInput: DOM.byId('formExpiryInput'),
        formEncryptedInput: DOM.byId('formEncryptedInput'),
        jsExpiry: DOM.byId('jsExpiry'),
        encryptionEnabled: DOM.byId('encryptionEnabled'),
        uploadForm: DOM.byId('uploadForm'),
        selectFileBtn: DOM.byId('selectFileBtn'),
        progressContainer: DOM.byId('progressContainer'),
        progressBar: DOM.byId('progressBar'),
        progressText: DOM.byId('progressText'),
        dropZoneContent: DOM.query('.drop-zone-content'),
        dropZoneLogo: DOM.query('.drop-zone-logo')
    };
    
    // Phrase rotation interval reference
    let phrasesInterval = null;

    // Check if encryption is available in this browser
    const isEncryptionSupported = FileEncryption.isEncryptionSupported();

    // If encryption is not supported, disable the option
    if (!isEncryptionSupported && elements.encryptionEnabled) {
        elements.encryptionEnabled.checked = false;
        elements.encryptionEnabled.disabled = true;
    }

    // Phrases for upload and encryption process feedback
    const phrases = {
        fish: [
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
        ],
        encryption: [
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
        ]
    };

    // Track the last used phrase index to avoid immediate repetition
    let lastPhraseIndex = -1;

    // Get random fish phrase
    function getRandomPhrase(phraseArray, prefix = "") {
        let randomIndex;
        do {
            randomIndex = Math.floor(Math.random() * phraseArray.length);
        } while (randomIndex === lastPhraseIndex && phraseArray.length > 1);

        lastPhraseIndex = randomIndex;
        return prefix + phraseArray[randomIndex];
    }
    
    // Simplified access to phrase arrays
    function getRandomFishPhrase() {
        return "90% - " + getRandomPhrase(phrases.fish);
    }

    function getRandomEncryptionPhrase() {
        return getRandomPhrase(phrases.encryption);
    }

    // Get max file size from the UI
    function getMaxFileSize() {
        const infoElement = DOM.query('.info strong');
        if (!infoElement) return 1024; // Default to 1GB

        const sizeText = infoElement.innerText;
        const match = sizeText.match(/(\d+)/);
        return match && match[1] ? parseInt(match[1], 10) : 1024;
    }

    // Get max file size
    const maxSizeMB = getMaxFileSize();
    const maxSizeBytes = maxSizeMB * 1024 * 1024; // Convert to bytes

    // Event listeners
    elements.selectFileBtn.addEventListener('click', () => fileInput.click());
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
        // Hide any previous error messages
        const errorContainer = document.getElementById('errorContainer');
        if (errorContainer) {
            errorContainer.style.display = 'none';
        }
        
        // Create a separate copy of the logo at the top
        let uploadingLogo = document.querySelector('.uploading-logo');
        if (!uploadingLogo && elements.dropZoneLogo) {
            uploadingLogo = elements.dropZoneLogo.cloneNode(true);
            uploadingLogo.classList.add('uploading-logo');
            uploadingLogo.style.position = 'absolute';
            uploadingLogo.style.top = '50px';
            uploadingLogo.style.zIndex = '20';
            uploadingLogo.classList.add('uploading');
            dropZone.appendChild(uploadingLogo);
        }
        
        // Hide the select file button
        if (elements.selectFileBtn) {
            elements.selectFileBtn.style.display = 'none';
        }
        
        // Hide drop zone content
        if (elements.dropZoneContent) {
            elements.dropZoneContent.style.opacity = '0';
            elements.dropZoneContent.style.pointerEvents = 'none';
            elements.dropZoneContent.style.position = 'absolute';
        }
        
        // Show and position progress container inside drop zone
        elements.progressContainer.style.display = 'block';
        if (!dropZone.contains(elements.progressContainer)) {
            dropZone.appendChild(elements.progressContainer);
        }
        
        // Add uploading class to dropzone
        dropZone.classList.add('uploading');
        
        // Add uploading-active class to body for bubble animation
        document.body.classList.add('uploading-active');
        
        // Hide form options during upload
        const formOptions = document.querySelector('.form-options');
        if (formOptions) {
            formOptions.style.display = 'none';
        }

        // Reset progress bar
        elements.progressBar.style.backgroundColor = '#4CAF50';
        elements.progressBar.style.width = '0%';
        elements.progressText.textContent = '0%';

        // Set and validate the expiry option
        const expiryValue = elements.jsExpiry.value;
        const validExpiryValues = ["1h", "6h", "24h", "72h"];

        if (validExpiryValues.includes(expiryValue)) {
            elements.formExpiryInput.value = expiryValue;
        } else {
            console.warn(`Invalid expiry value: ${expiryValue}, using default`);
            elements.formExpiryInput.value = "1h"; // Default to 1 hour if invalid
        }

        // Check if encryption is enabled and supported
        const shouldEncrypt = elements.encryptionEnabled &&
            elements.encryptionEnabled.checked &&
            isEncryptionSupported;

        elements.formEncryptedInput.value = shouldEncrypt ? "true" : "false";

        if (shouldEncrypt) {
            // Update progress to show encryption state
            updateProgress(20, getRandomEncryptionPhrase());

            // Encrypt the file before upload
            encryptAndUpload(file).catch(error => {
                // This ensures any unhandled errors are properly shown to the user
                console.error('Upload process failed:', error);
                showError('Upload failed: ' + error.message);
                resetUploadUI();
            });
        } else {
            // If not encrypting, proceed with normal upload
            processRegularUpload(file);
        }
    }

    // Reset UI after error or completion
    function resetUploadUI() {
        // Stop the phrase rotation interval
        if (phrasesInterval) {
            clearInterval(phrasesInterval);
            phrasesInterval = null;
        }
        
        // Remove uploading class from dropzone
        dropZone.classList.remove('uploading');
        
        // Remove the cloned logo if it exists
        const uploadingLogo = document.querySelector('.uploading-logo');
        if (uploadingLogo) {
            dropZone.removeChild(uploadingLogo);
        }
        
        // Show the select file button again
        if (elements.selectFileBtn) {
            elements.selectFileBtn.style.display = '';
        }
        
        // Remove uploading-active class from body to stop bubble animation
        document.body.classList.remove('uploading-active');
        
        // Show drop zone content again
        if (elements.dropZoneContent) {
            elements.dropZoneContent.style.opacity = '1';
            elements.dropZoneContent.style.pointerEvents = 'auto';
            elements.dropZoneContent.style.position = '';
        }
        
        // Show form options again
        const formOptions = document.querySelector('.form-options');
        if (formOptions) {
            formOptions.style.display = 'block';
        }
    }

    // Handle encryption and upload
    async function encryptAndUpload(file) {
        try {
            // Generate a random encryption key
            const encryptionKey = await FileEncryption.generateKey();

            // Start rotating encryption phrases during the encryption process
            updateProgress(20, getRandomEncryptionPhrase());
            
            // Set up rotation interval for encryption phrases
            phrasesInterval = setInterval(function() {
                updateProgress(null, getRandomEncryptionPhrase());
            }, 5000);
            
            // First, create a 4KB sample from the original file
            const originalSample = file.slice(0, 4096);
            console.log("Created 4KB sample of original file:", originalSample.size, "bytes");
            
            // Update progress for sample encryption
            updateProgress(30, "Creating validation sample...");
            
            // Encrypt the sample separately for validation
            const encryptedSample = await FileEncryption.encryptFile(originalSample, encryptionKey);
            const sampleArrayBuffer = await encryptedSample.arrayBuffer();
            console.log("Encrypted sample size:", sampleArrayBuffer.byteLength, "bytes");
            
            // Convert sample to base64 for storage
            const sampleBase64 = FileEncryption.arrayBufferToBase64(sampleArrayBuffer);
            console.log("Sample base64 length:", sampleBase64.length);
            
            // Update progress for main file encryption
            updateProgress(40, "Sample created! Encrypting main file...");

            // Encrypt the main file
            const encryptedBlob = await FileEncryption.encryptFile(file, encryptionKey);

            // Clear the encryption phrases interval
            if (phrasesInterval) {
                clearInterval(phrasesInterval);
                phrasesInterval = null;
            }

            // Update progress
            updateProgress(70, "File encryption complete! Preparing upload...");

            // Add the encrypted sample to a hidden form field
            const sampleInput = document.createElement('input');
            sampleInput.type = 'hidden';
            sampleInput.name = 'encrypted_sample';
            sampleInput.value = sampleBase64;
            elements.uploadForm.appendChild(sampleInput);

            // Create a File object from the encrypted blob
            const encryptedFile = new File([encryptedBlob], file.name, {
                type: file.type,
                lastModified: file.lastModified
            });

            // Copy the encrypted file to the form's file input
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(encryptedFile);
            elements.formFileInput.files = dataTransfer.files;

            // Send the upload request
            await sendUploadRequest(encryptionKey);
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
        elements.formFileInput.files = dataTransfer.files;

        // Send the upload request
        sendUploadRequest();
    }

    // Send the upload request with progress tracking
    async function sendUploadRequest(encryptionKey = null) {
        try {
            const formData = new FormData(elements.uploadForm);
            ensureCsrfToken(formData);
            
            // Create controller for aborting fetch request on timeout
            const controller = new AbortController();
            const signal = controller.signal;
            
            // Set timeout to 1 hour (3600000ms) for very large uploads
            const timeoutId = setTimeout(() => {
                controller.abort();
                showError('Upload timed out. Please try with a smaller file or check your connection.');
            }, 3600000);
            
            // Set up progress tracking
            const fileSize = elements.formFileInput.files[0].size;
            let uploadComplete = false;
            let uploadStartTime = Date.now();
            let lastProgressUpdate = uploadStartTime;
            let bytesUploaded = 0;
            
            // Use XMLHttpRequest for accurate progress tracking
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/upload', true);
            xhr.timeout = 3600000; // 1 hour timeout
            
            // Set up proper CSRF token
            const csrfToken = document.getElementById('formCsrfToken').value;
            if (csrfToken) {
                xhr.setRequestHeader('X-CSRF-Token', csrfToken);
            }
            
            // Track upload progress accurately
            xhr.upload.onprogress = function(event) {
                if (event.lengthComputable) {
                    bytesUploaded = event.loaded;
                    const now = Date.now();
                    
                    // Only update progress every 200ms to avoid too many UI updates
                    if (now - lastProgressUpdate > 200) {
                        const percent = Math.min(Math.round((bytesUploaded / fileSize) * 100), 99);
                        
                        // Show fish phrases throughout the entire upload process
                        if (!phrasesInterval) {
                            updateProgress(percent, percent + "% - " + getRandomFishPhrase());
                            
                            // Start rotating phrases every 5 seconds
                            phrasesInterval = setInterval(function() {
                                const currentPercent = Math.min(Math.round((bytesUploaded / fileSize) * 100), 99);
                                elements.progressText.textContent = currentPercent + "% - " + getRandomFishPhrase();
                            }, 5000);
                        } else {
                            // Just update the percentage number in the existing phrase
                            const currentText = elements.progressText.textContent;
                            const newText = percent + "%" + currentText.substring(currentText.indexOf("%") + 1);
                            elements.progressText.textContent = newText;
                        }
                        
                        // Still update the progress bar
                        elements.progressBar.style.width = percent + '%';
                        
                        lastProgressUpdate = now;
                    }
                }
            };
            
            // Handle upload completion
            xhr.onload = function() {
                uploadComplete = true;
                
                // Clear the timeout since request completed
                clearTimeout(timeoutId);
                
                if (xhr.status >= 200 && xhr.status < 300) {
                    // Success handling
                    updateProgress(100, '100% - Complete!');
                    
                    // Add a small delay before redirect to show the completion
                    setTimeout(() => {
                        // Redirect with encryption key if needed
                        if (encryptionKey) {
                            const redirectUrl = xhr.responseURL || '/';
                            window.location.href = redirectUrl + '#' + encryptionKey;
                        } else {
                            window.location.href = xhr.responseURL || '/';
                        }
                    }, 500);
                } else {
                    // Error handling - parse error from response
                    const errorMessage = parseErrorMessageFromHTML(xhr.responseText) || 
                                      `Upload failed! Server returned status ${xhr.status}`;
                    showError(errorMessage);
                }
            };
            
            // Handle network errors
            xhr.onerror = function() {
                clearTimeout(timeoutId);
                console.error('XHR error during upload');
                showError('Network error during upload. Please check your connection and try again.');
            };
            
            // Handle timeout
            xhr.ontimeout = function() {
                console.error('XHR timeout during upload');
                showError('Upload timed out. Please try with a smaller file or check your connection.');
            };
            
            // Send the form data
            xhr.send(formData);
            
        } catch (error) {
            console.error('Upload preparation error:', error);
            showError('Failed to prepare upload: ' + error.message);
        }
    }
    
    // Parse error message from HTML response
    function parseErrorMessageFromHTML(htmlText) {
        if (!htmlText || !htmlText.includes('Error:')) return null;
        
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            const errorElement = doc.querySelector('.error strong');
            if (errorElement && errorElement.nextElementSibling) {
                return errorElement.nextElementSibling.textContent;
            }
        } catch (e) {
            console.error('Error parsing error response:', e);
        }
        return null;
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
        // Hide any error message when showing progress
        const errorContainer = document.getElementById('errorContainer');
        if (errorContainer) {
            errorContainer.style.display = 'none';
        }

        // Apply transition for smoother animation
        elements.progressBar.style.transition = 'width 0.3s ease-in-out';
        
        // Update progress bar width if percent is provided
        if (percent !== null) {
            elements.progressBar.style.width = percent + '%';
        }

        // Clear any existing phrase rotation interval if we're setting new text
        // but not during encryption rotation
        if (text && !text.includes("Encrypting") && phrasesInterval) {
            clearInterval(phrasesInterval);
            phrasesInterval = null;
        }

        // Update text with custom message or percentage
        if (text) {
            elements.progressText.textContent = text;
        } else {
            // For regular progress, show fish phrases throughout
            const randomFishPhrase = getRandomFishPhrase();
            
            if (percent < 100) {
                // Start rotating phrases immediately
                elements.progressText.textContent = percent + "% - " + randomFishPhrase;
                
                if (!phrasesInterval) {
                    // Start rotating phrases every 5 seconds
                    phrasesInterval = setInterval(function() {
                        const currentPercent = parseInt(elements.progressBar.style.width) || percent;
                        const newPhrase = getRandomFishPhrase();
                        elements.progressText.textContent = currentPercent + "% - " + newPhrase;
                    }, 5000);
                }
            } else {
                elements.progressText.textContent = percent + '% - Complete!';
                
                // Stop phrase rotation at 100%
                if (phrasesInterval) {
                    clearInterval(phrasesInterval);
                    phrasesInterval = null;
                }
            }
        }

        // Update color based on state
        if (percent === 100) {
            elements.progressBar.style.backgroundColor = '#27ae60'; // Darker green for completion
        }
    }

    // Show error message in progress area
    function showError(message) {
        // First reset the UI to show the original state
        resetUploadUI();
        
        // Then show the error below the drop zone
        const errorContainer = document.getElementById('errorContainer');
        if (errorContainer) {
            // Use existing error container if it exists
            errorContainer.textContent = 'Error: ' + message;
            errorContainer.style.display = 'block';
        } else {
            // Create a new error container if it doesn't exist
            const newErrorContainer = document.createElement('div');
            newErrorContainer.id = 'errorContainer';
            newErrorContainer.className = 'error-message';
            newErrorContainer.textContent = 'Error: ' + message;
            newErrorContainer.style.cssText = 'display: block; margin: 15px auto; padding: 10px; background-color: #ffebee; border-left: 4px solid #e74c3c; border-radius: 4px; color: #e74c3c; text-align: left; max-width: 90%;';
            
            // Insert after the drop zone
            const parentElement = dropZone.parentNode;
            parentElement.insertBefore(newErrorContainer, dropZone.nextSibling);
        }
        
        // Hide the progress container
        elements.progressContainer.style.display = 'none';
    }
}

// Helper function to format file size
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    else return (bytes / 1073741824).toFixed(1) + ' GB';
}

// Update the preview with decrypted content
function updatePreview(objectURL, mimeType) {
    if (mimeType.startsWith('image/')) {
        const img = DOM.byId('previewImage');
        if (img) img.src = objectURL;
    } else if (mimeType.startsWith('video/')) {
        const source = DOM.byId('previewVideoSource');
        if (source) {
            source.src = objectURL;
            DOM.byId('previewVideo').load();
        }
    } else if (mimeType.startsWith('audio/')) {
        const source = DOM.byId('previewAudioSource');
        if (source) {
            source.src = objectURL;
            DOM.byId('previewAudio').load();
        }
    }
}
