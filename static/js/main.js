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
                throw new Error(`Encrypted data is invalid (size: ${encryptedData ? encryptedData.byteLength : 'undefined'} bytes)`);
            }

            // Convert the base64 key back to an array buffer
            const keyData = this.base64ToArrayBuffer(base64Key);

            // Extract the IV from the beginning of the data (first 12 bytes)
            const iv = new Uint8Array(encryptedData.slice(0, 12));

            // Extract the encrypted content (everything after the IV)
            const encryptedContent = new Uint8Array(encryptedData.slice(12));
            
            // Log the data we're working with
            if (encryptedContent.length < 1) {
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

        // Validate key format first
        if (encryptionKey && validateEncryptionKeyFormat(encryptionKey)) {
            // Format looks valid, but we won't load preview for encrypted files
            document.getElementById('encryptionError').style.display = 'none';

            // Show the download section instead
            const downloadSection = document.getElementById('fileActions');
            if (downloadSection) {
                downloadSection.style.display = 'flex';
            }
            // Insert this message before the download button
        } else {
            // Invalid key format
            document.getElementById('encryptionError').style.display = 'block';
            document.getElementById('encryptionError').textContent = 'Invalid encryption key format. The link may be incomplete or incorrect.';
            hideDownloadOptions();
        }

        // Update download button to include the key in the URL
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn && encryptionKey) {
            const currentHref = downloadBtn.getAttribute('href');
            downloadBtn.setAttribute('href', currentHref + '#' + encryptionKey);

            // For direct downloads, we need to handle it with JS
            downloadBtn.addEventListener('click', function (e) {
                e.preventDefault();
                handleEncryptedDownload(encryptionKey, fileURL, mimeType, filename);
            });
        }
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
    // Hide download button and copy link button, but keep the "Upload Another File" button
    const downloadBtn = document.getElementById('downloadBtn');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const downloadTip = document.getElementById('downloadTip');

    if (downloadBtn) downloadBtn.style.display = 'none';
    if (copyLinkBtn) copyLinkBtn.style.display = 'none';
    if (downloadTip) downloadTip.style.display = 'none';
}

// Hide decryption progress display
function hideDecryptionProgress() {
    const progressContainer = document.getElementById('decryptionProgress');
    if (progressContainer) {
        progressContainer.style.display = 'none';
        progressContainer.classList.remove('displayed');
    }
}

// Show decryption progress 
function showDecryptionProgress(message) {
    const progressContainer = document.getElementById('decryptionProgress');
    const progressText = document.getElementById('decryptionProgressText');
    
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
        // First validate the key format
        if (!validateEncryptionKeyFormat(key)) {
            throw new Error('Invalid encryption key format');
        }

        // Hide any error message
        const errorContainer = document.getElementById('encryptionError');
        if (errorContainer) {
            errorContainer.style.display = 'none';
        }

        // Set initial progress bar appearance
        const progressBar = document.getElementById('decryptionProgressBar');
        if (progressBar) {
            progressBar.style.width = '100%';
        }
        
        // Show progress with initial message
        showDecryptionProgress('Preparing download...');

        // Flag to track if we should try full download
        let shouldTryFullDownload = false;

        // Try the full download directly for fresh uploads
        // The URL fragment (key) in the address bar indicates this is likely a fresh upload
        if (window.location.hash && window.location.hash.substring(1) === key) {
            showDecryptionProgress('Downloading file...');
            await proceedWithEncryptedDownload(key, fileURL, mimeType, filename);
            return;
        }

        // Try to get just the first few KB to validate the key
        try {
            // Use fetch with range header to get just the first 4KB
            const validateResponse = await fetch(fileURL, {
                headers: {
                    'Range': 'bytes=0-4095'  // First 4KB should include the IV (12 bytes) + some encrypted data
                },
                // Ensure credentials aren't sent to avoid CORS preflight
                credentials: 'omit',
                // Allow CORS
                mode: 'cors'
            });
            
            // Check if range request was successful
            if (validateResponse.status === 206) {  // 206 Partial Content
                
                // Get content length to see if the full file is small
                const contentLength = validateResponse.headers.get('content-length');
                const contentRange = validateResponse.headers.get('content-range');
                
                // If content range indicates this is a small file (< 8KB), just download the whole thing
                if (contentRange && contentRange.includes('/') &&
                    parseInt(contentRange.split('/')[1]) < 8192) {
                    shouldTryFullDownload = true;
                    return;
                }
                
                // Get the sample data
                const sampleData = await validateResponse.arrayBuffer();
                
                // Check if sample data is large enough to contain IV (12 bytes) plus some data
                if (sampleData.byteLength < 20) {
                    shouldTryFullDownload = true;
                    return;
                }
                
                try {
                    // Try to decrypt the sample
                    await FileEncryption.decryptFile(sampleData, key, mimeType);
                    
                    // If we get here, decryption succeeded, so the key is valid
                    showDecryptionProgress('Key validated, downloading file...');
                    
                    // Proceed with full file download
                    await proceedWithEncryptedDownload(key, fileURL, mimeType, filename);
                    return;
                } catch (validationError) {
                    // If validation failed, but this is a fresh upload (URL has the key in fragment),
                    // we'll still try the full download as it might be a false negative
                    if (window.location.hash && window.location.hash.substring(1) === key) {
                        shouldTryFullDownload = true;
                    } else {
                        throw new Error('Invalid decryption key. The file cannot be decrypted with this key.');
                    }
                }
            } else {
                // Range request not supported or not configured on server
                shouldTryFullDownload = true;  // Only try full download if range request wasn't supported
            }
        } catch (rangeError) {
            // If there was an error with the range request (could be CORS, server config, etc.)
            if (rangeError.message.includes('Invalid decryption key') && 
                !(window.location.hash && window.location.hash.substring(1) === key)) {
                // This is from our validation, so propagate the error
                // But skip this check for fresh uploads
                throw rangeError;
            }
            shouldTryFullDownload = true;  // Only try full download if range request failed completely
        }

        // If we should try full download (only if range request wasn't supported or failed completely)
        if (shouldTryFullDownload) {
            // Proceed with downloading the full file
            showDecryptionProgress('Downloading file...');
            await proceedWithEncryptedDownload(key, fileURL, mimeType, filename);
        } else {
            // If we got here without shouldTryFullDownload being true, something unusual happened
            throw new Error('Key validation process failed');
        }
    } catch (error) {
        console.error('Download preparation failed:', error);
        
        // Clear progress display and show error
        hideDecryptionProgress();
        
        // Show error message
        const errorContainer = document.getElementById('encryptionError');
        if (errorContainer) {
            errorContainer.style.display = 'block';
            errorContainer.textContent = error.message || 'Failed to prepare download';
        }
        
        hideDownloadOptions();
    }
}

// Proceed with encrypted download after key validation
async function proceedWithEncryptedDownload(key, fileURL, mimeType, filename) {
    try {
        // Show decryption progress
        showDecryptionProgress('Downloading file...');

        // Fetch the encrypted file
        const response = await fetch(fileURL, {
            // Ensure credentials aren't sent to avoid CORS preflight
            credentials: 'omit',
            // Allow CORS
            mode: 'cors'
        });
        if (!response.ok) {
            throw new Error('Failed to fetch file');
        }

        // Get the encrypted data
        const encryptedData = await response.arrayBuffer();

        // Check if we have a valid size
        if (encryptedData.byteLength < 20) {
            console.error('Downloaded data is too small to be a valid encrypted file');
            throw new Error('Downloaded data appears to be invalid (too small)');
        }

        showDecryptionProgress('Decrypting...');

        try {
            // Decrypt the file
            const decryptedBlob = await FileEncryption.decryptFile(encryptedData, key, mimeType);

            // Trigger download
            showDecryptionProgress('Download starting...');

            const a = document.createElement('a');
            a.href = URL.createObjectURL(decryptedBlob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Hide progress after a short delay
            setTimeout(() => {
                hideDecryptionProgress();
            }, 1500);
        } catch (decryptError) {
            console.error('Decryption failed:', decryptError);
            hideDecryptionProgress();
            
            const errorContainer = document.getElementById('encryptionError');
            if (errorContainer) {
                errorContainer.style.display = 'block';
                errorContainer.textContent = 'Decryption failed: ' + decryptError.message;
            }
            
            hideDownloadOptions();
        }
    } catch (error) {
        console.error('Download failed:', error);
        hideDecryptionProgress();
        
        const errorContainer = document.getElementById('encryptionError');
        if (errorContainer) {
            errorContainer.style.display = 'block';
            errorContainer.textContent = 'Download failed: ' + error.message;
        }
        
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
    const dropZoneContent = document.querySelector('.drop-zone-content');
    const dropZoneLogo = document.querySelector('.drop-zone-logo');
    let phrasesInterval; // For storing the interval that rotates phrases

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
        console.log("New fish phrase index: " + randomIndex);
        return "90% - " + fishProcessingPhrases[randomIndex];
    }

    // Get random encryption phrase
    function getRandomEncryptionPhrase() {
        let randomIndex = Math.floor(Math.random() * encryptionPhrases.length);
        console.log("New encryption phrase index: " + randomIndex);
        return encryptionPhrases[randomIndex];
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
        // Hide any previous error messages
        const errorContainer = document.getElementById('errorContainer');
        if (errorContainer) {
            errorContainer.style.display = 'none';
        }
        
        // Create a separate copy of the logo at the top
        let uploadingLogo = document.querySelector('.uploading-logo');
        if (!uploadingLogo && dropZoneLogo) {
            uploadingLogo = dropZoneLogo.cloneNode(true);
            uploadingLogo.classList.add('uploading-logo');
            uploadingLogo.style.position = 'absolute';
            uploadingLogo.style.top = '50px';
            uploadingLogo.style.zIndex = '20';
            uploadingLogo.classList.add('uploading');
            dropZone.appendChild(uploadingLogo);
        }
        
        // Hide the select file button
        if (selectFileBtn) {
            selectFileBtn.style.display = 'none';
        }
        
        // Hide drop zone content
        if (dropZoneContent) {
            dropZoneContent.style.opacity = '0';
            dropZoneContent.style.pointerEvents = 'none';
            dropZoneContent.style.position = 'absolute';
        }
        
        // Show and position progress container inside drop zone
        progressContainer.style.display = 'block';
        if (!dropZone.contains(progressContainer)) {
            dropZone.appendChild(progressContainer);
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
        if (selectFileBtn) {
            selectFileBtn.style.display = '';
        }
        
        // Remove uploading-active class from body to stop bubble animation
        document.body.classList.remove('uploading-active');
        
        // Show drop zone content again
        if (dropZoneContent) {
            dropZoneContent.style.opacity = '1';
            dropZoneContent.style.pointerEvents = 'auto';
            dropZoneContent.style.position = '';
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
                console.log("Encryption phrase rotation fired");
                updateProgress(null, getRandomEncryptionPhrase());
            }, 5000);

            // Encrypt the file
            const encryptedBlob = await FileEncryption.encryptFile(file, encryptionKey);

            // Clear the encryption phrases interval
            if (phrasesInterval) {
                clearInterval(phrasesInterval);
                phrasesInterval = null;
            }

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
        formFileInput.files = dataTransfer.files;

        // Send the upload request
        sendUploadRequest();
    }

    // Send the upload request with progress tracking
    async function sendUploadRequest(encryptionKey = null) {
        try {
            const formData = new FormData(uploadForm);
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
            const fileSize = formFileInput.files[0].size;
            let lastLoaded = 0;
            let uploadComplete = false;
            
            // Start progress tracking interval
            const progressTracker = setInterval(() => {
                if (!uploadComplete) {
                    // If at 90%, show fish phrases
                    if (lastLoaded >= fileSize * 0.9) {
                        if (!phrasesInterval) {
                            console.log("Upload at 90%, showing fish phrase");
                            updateProgress(90, getRandomFishPhrase());
                            
                            // Start rotating phrases every 5 seconds
                            phrasesInterval = setInterval(function() {
                                console.log("Rotation timer fired");
                                progressText.textContent = getRandomFishPhrase();
                            }, 5000);
                        }
                    }
                }
            }, 500);
            
            try {
                // Track upload progress using a ReadableStream
                const reader = formFileInput.files[0].stream().getReader();
                let receivedLength = 0;
                
                // Read the file stream
                const streamProgress = async () => {
                    while (true) {
                        const { done, value } = await reader.read();
                        
                        if (done) {
                            break;
                        }
                        
                        receivedLength += value.length;
                        lastLoaded = receivedLength;
                        const percent = Math.min(Math.round((receivedLength / fileSize) * 90), 89);
                        updateProgress(percent);
                    }
                };
                
                // Start progress tracking in the background
                streamProgress().catch(error => {
                    console.warn("Progress tracking encountered an issue:", error);
                    // This shouldn't stop the main upload
                });
                
                // Send the actual upload request
                const response = await fetch('/upload', {
                    method: 'POST',
                    body: formData,
                    signal: signal,
                    // Include credentials (cookies) for CSRF validation
                    credentials: 'same-origin'
                });
                
                // Upload is complete at this point
                uploadComplete = true;
                clearInterval(progressTracker);
                
                // Clear the timeout since request completed
                clearTimeout(timeoutId);
                
                // Handle response
                if (response.ok) {
                    // Success handling
                    updateProgress(100, '100% - Complete!');
                    
                    // Add a small delay before redirect to show the completion
                    setTimeout(() => {
                        // Redirect with encryption key if needed
                        if (encryptionKey) {
                            const redirectUrl = response.url || '/';
                            window.location.href = redirectUrl + '#' + encryptionKey;
                        } else {
                            window.location.href = response.url || '/';
                        }
                    }, 500);
                } else {
                    // Error handling - parse error from response
                    const responseText = await response.text();
                    const errorMessage = parseErrorMessageFromHTML(responseText) || 
                                        `Upload failed! Server returned status ${response.status}`;
                    showError(errorMessage);
                }
            } catch (error) {
                clearInterval(progressTracker);
                clearTimeout(timeoutId);
                
                if (error.name === 'AbortError') {
                    // Already handled by the timeout callback
                    return;
                }
                
                console.error('Fetch error:', error);
                showError('Network error during upload. Please check your connection and try again.');
            }
            
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
        progressBar.style.transition = 'width 0.3s ease-in-out';
        
        // Update progress bar width if percent is provided
        if (percent !== null) {
            progressBar.style.width = percent + '%';
        }

        // Clear any existing phrase rotation interval if we're setting new text
        // but not during encryption rotation
        if (text && !text.includes("Encrypting") && phrasesInterval) {
            clearInterval(phrasesInterval);
            phrasesInterval = null;
        }

        // Update text with custom message or percentage
        if (text) {
            progressText.textContent = text;
        } else {
            // For regular progress, update with clear message
            if (percent < 90) {
                progressText.textContent = percent + '% - Uploading...';
            } else if (percent >= 90 && percent < 100) {
                // Start rotating phrases at 90%
                progressText.textContent = getRandomFishPhrase();
                
                // Start rotating phrases every 5 seconds
                phrasesInterval = setInterval(function() {
                    progressText.textContent = getRandomFishPhrase();
                    console.log("Fish phrase rotated: " + progressText.textContent); // Debug line
                }, 5000);
            } else {
                progressText.textContent = percent + '% - Complete!';
                
                // Stop phrase rotation at 100%
                if (phrasesInterval) {
                    clearInterval(phrasesInterval);
                    phrasesInterval = null;
                }
            }
        }

        // Update color based on state
        if (percent === 100) {
            progressBar.style.backgroundColor = '#27ae60'; // Darker green for completion
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
        progressContainer.style.display = 'none';
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
