/**
 * Upload page functionality
 */

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
        return getRandomPhrase(phrases.fish);
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
                            const dashIndex = currentText.indexOf("% -");
                            if (dashIndex >= 0) {
                                const newText = percent + currentText.substring(dashIndex);
                                elements.progressText.textContent = newText;
                            } else {
                                // Fallback if dash not found
                                elements.progressText.textContent = percent + "% - " + getRandomFishPhrase();
                            }
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

// Export functions
if (typeof module !== 'undefined') {
    module.exports = { initializeUploader };
} 