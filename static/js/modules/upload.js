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

    // Phrase rotation interval reference (managed by updateProgress now)
    let phrasesInterval = null;
    // State variables for initial upload progress animation (managed by updateProgress)
    let isUploadStarting = false;
    let startingProgressInterval = null;

    // State for progress text updates
    let lastProgressPercent = 0;
    let lastTimeRemainingText = null;
    let showPhraseNext = false; // Flag to alternate between time/status and phrase

    // Check if encryption is available in this browser
    const isEncryptionSupported = FileEncryption.isEncryptionSupported();

    // If encryption is not supported, disable the option
    if (!isEncryptionSupported && elements.encryptionEnabled) {
        elements.encryptionEnabled.checked = false;
        elements.encryptionEnabled.disabled = true;
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

    // Cache elements
    const elements = _cacheDOMElements();

    // Setup initial event handlers
    _setupEventHandlers(elements, handleFileSelection);

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

    // Setup UI elements for the upload state
    function _setupUIForUpload() {
        // Hide any previous error messages
        const errorContainer = document.getElementById('errorContainer');
        if (errorContainer) {
            errorContainer.style.display = 'none';
        }

        // Create a separate copy of the logo at the top (if not already existing)
        let uploadingLogo = document.querySelector('.uploading-logo');
        if (!uploadingLogo && elements.dropZoneLogo) {
            uploadingLogo = elements.dropZoneLogo.cloneNode(true);
            uploadingLogo.classList.add('uploading-logo');
            uploadingLogo.style.position = 'absolute';
            uploadingLogo.style.top = '50px'; // Adjust position as needed
            uploadingLogo.style.zIndex = '20';
            uploadingLogo.classList.add('uploading');
            dropZone.appendChild(uploadingLogo);
        } else if (uploadingLogo) {
            // Ensure existing cloned logo has the uploading class if prepareUpload is somehow called again
            if (!uploadingLogo.classList.contains('uploading')) {
                uploadingLogo.classList.add('uploading');
            }
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
    }

    // Prepare the upload form
    function prepareUpload(file) {
        // Setup UI elements for the upload state
        _setupUIForUpload();

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
            updateProgress(20, getRandomEncryptionPhrase(), 'encrypting');

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
        
        // --- Clear the starting progress interval --- 
        if (startingProgressInterval) {
            clearInterval(startingProgressInterval);
            startingProgressInterval = null;
        }
        isUploadStarting = false; // Reset flag

        // Hide progress container
        if (elements.progressContainer) {
            elements.progressContainer.style.display = 'none';
        }

        // Clear the selected file from the input
        if (fileInput) {
            fileInput.value = '';
        }
    }

    // --- ChunkedUploader Class ---
    class ChunkedUploader {
        // Constants
        static MAX_CHUNK_SIZE = 80 * 1024 * 1024; // 80MB absolute maximum chunk size
        static MIN_CHUNK_SIZE = 1 * 1024 * 1024;  // 1MB minimum chunk size
        static IDEAL_CHUNK_COUNT = 10;            // Aim for at least this many chunks for better progress reporting
        static MAX_RETRIES = 3;
        static MAX_SPEED_MEASUREMENTS = 5;
        static MAX_CONCURRENT_UPLOADS = 3; // Fewer concurrent uploads with larger chunks
        static FINALIZATION_START_PERCENT = 95;

        constructor(file, options) {
            this.file = file;
            this.options = {
                chunkUrl: '/upload/chunk',
                finalizeUrl: '/upload/finalize',
                getCsrfToken: (formData) => '', // Expects function that takes formData and returns token string
                getExpiry: () => '1h',
                getIsEncrypted: () => 'false',
                getSampleBase64: () => null,
                onProgress: (progress) => console.log('Progress:', progress),
                onSuccess: (result) => console.log('Success:', result),
                onError: (error) => console.error('Error:', error),
                ...options
            };

            this.fileSize = file.size;
            this.fileId = crypto.randomUUID();
            this.chunkSize = this._getOptimalChunkSize();
            this.totalChunks = this.fileSize > 0 ? Math.ceil(this.fileSize / this.chunkSize) : 0;
            this.bytesUploaded = 0;
            this.uploadStartTime = 0;
            this.lastProgressUpdate = 0;
            this.uploadComplete = false;
            this.speedMeasurements = [];
            this.activeUploads = 0;
            this.nextChunkIndex = 0;
            this.completedChunks = 0;
            this.finalizationInterval = null;
        }

        _getOptimalChunkSize() {
            const fileSize = this.fileSize;
            if (fileSize === 0) return ChunkedUploader.MIN_CHUNK_SIZE; // Default for empty file
            const chunkSizeForIdealCount = Math.ceil(fileSize / ChunkedUploader.IDEAL_CHUNK_COUNT);

            if (fileSize < 10 * 1024 * 1024) { // Less than 10MB
                return Math.min(
                    Math.max(ChunkedUploader.MIN_CHUNK_SIZE, chunkSizeForIdealCount),
                    Math.ceil(fileSize / 5) || ChunkedUploader.MIN_CHUNK_SIZE
                );
            }
            if (fileSize < 100 * 1024 * 1024) { // 10MB - 100MB
                return Math.min(
                    Math.max(ChunkedUploader.MIN_CHUNK_SIZE, chunkSizeForIdealCount),
                    10 * 1024 * 1024
                );
            }
            if (fileSize < 1024 * 1024 * 1024) { // 100MB - 1GB
                return Math.min(
                    Math.max(5 * 1024 * 1024, chunkSizeForIdealCount),
                    20 * 1024 * 1024
                );
            }
            return Math.min(
                Math.max(10 * 1024 * 1024, chunkSizeForIdealCount),
                ChunkedUploader.MAX_CHUNK_SIZE
            );
        }

        _updateProgress(chunkUploadedSize = 0) {
            this.bytesUploaded += chunkUploadedSize;
            this.bytesUploaded = Math.min(this.bytesUploaded, this.fileSize);
            const percent = this.fileSize > 0
                ? Math.floor((this.bytesUploaded / this.fileSize) * ChunkedUploader.FINALIZATION_START_PERCENT)
                : (this.uploadComplete ? ChunkedUploader.FINALIZATION_START_PERCENT : 0);
            const now = Date.now();
            let timeRemainingText = null;

            if ((now - this.lastProgressUpdate > 200 || chunkUploadedSize === 0) && this.fileSize > 0) {
                const elapsedSeconds = (now - this.uploadStartTime) / 1000;
                if (chunkUploadedSize > 0) {
                     const currentSpeed = chunkUploadedSize / ((now - this.lastProgressUpdate) / 1000);
                     if (currentSpeed > 0 && isFinite(currentSpeed)) {
                         this.speedMeasurements.push(currentSpeed);
                         if (this.speedMeasurements.length > ChunkedUploader.MAX_SPEED_MEASUREMENTS) {
                             this.speedMeasurements.shift();
                         }
                     }
                }
                const avgBytesPerSecond = this.speedMeasurements.length > 0
                    ? this.speedMeasurements.reduce((a, b) => a + b, 0) / this.speedMeasurements.length
                    : (this.bytesUploaded / elapsedSeconds) || 0;
                if (avgBytesPerSecond > 0 && this.bytesUploaded < this.fileSize) {
                    const bytesRemaining = this.fileSize - this.bytesUploaded;
                    const secondsRemaining = Math.ceil(bytesRemaining / avgBytesPerSecond);
                    if (elapsedSeconds > 2 && secondsRemaining > 0 && isFinite(secondsRemaining)) {
                        if (secondsRemaining < 60) { timeRemainingText = `${secondsRemaining} sec remaining`; }
                        else if (secondsRemaining < 3600) { const m = Math.ceil(secondsRemaining / 60); timeRemainingText = `${m} min remaining`; }
                        else { const h = Math.floor(secondsRemaining / 3600); const m = Math.ceil((secondsRemaining % 3600) / 60); timeRemainingText = `${h}h ${m}m remaining`; }
                    }
                }
                this.lastProgressUpdate = now;
            }
            this.options.onProgress({
                percent: Math.min(percent, ChunkedUploader.FINALIZATION_START_PERCENT),
                bytesUploaded: this.bytesUploaded,
                totalBytes: this.fileSize,
                timeRemainingText: timeRemainingText
            });
        }

        async _uploadChunk(chunkIndex, retryCount = 0) {
            const start = chunkIndex * this.chunkSize;
            const end = Math.min(start + this.chunkSize, this.fileSize);
            const chunk = this.file.slice(start, end);
            const chunkActualSize = end - start;
            const formData = new FormData();
            formData.append('file', chunk, this.file.name);
            formData.append('chunk_index', chunkIndex);
            formData.append('total_chunks', this.totalChunks);
            formData.append('file_id', this.fileId);
            formData.append('file_size', this.fileSize);
            formData.append('filename', this.file.name);
            formData.append('expiry', this.options.getExpiry());
            formData.append('encrypted', this.options.getIsEncrypted());
            const sampleBase64 = this.options.getSampleBase64();
            if (chunkIndex === 0 && sampleBase64) { formData.append('encrypted_sample', sampleBase64); }
            const csrfToken = this.options.getCsrfToken(formData);
            try {
                const response = await fetch(this.options.chunkUrl, {
                    method: 'POST', body: formData, headers: { 'X-CSRF-Token': csrfToken, 'X-Requested-With': 'XMLHttpRequest' }
                });
                if (!response.ok) {
                    let errorText = await response.text();
                    try { const jsonError = JSON.parse(errorText); if (jsonError && jsonError.error) { errorText = jsonError.error; } } catch (e) { /* Ignore */ }
                    throw new Error(`Server returned ${response.status}: ${errorText}`);
                }
                this._updateProgress(chunkActualSize);
                return true;
            } catch (error) {
                console.error(`Error uploading chunk ${chunkIndex} (attempt ${retryCount + 1}):`, error);
                const isRateLimit = error.message && error.message.includes('429');
                if (!isRateLimit && retryCount < ChunkedUploader.MAX_RETRIES) {
                    const delay = 1000 * (retryCount + 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this._uploadChunk(chunkIndex, retryCount + 1);
                }
                throw error;
            }
        }

        async _uploadChunkWithRateLimitRetry(chunkIndex, maxRateLimitRetries = ChunkedUploader.MAX_RETRIES + 2) {
            let retryCount = 0;
            while (true) {
                try { return await this._uploadChunk(chunkIndex); } catch (error) {
                    if (error.message && error.message.includes('429')) {
                        retryCount++;
                        if (retryCount >= maxRateLimitRetries) throw new Error(`Failed chunk ${chunkIndex} after ${maxRateLimitRetries} rate limit retries`);
                        const delay = Math.min(Math.pow(1.5, retryCount) * 1000, 15000);
                        console.warn(`Rate limit hit on chunk ${chunkIndex}. Retrying in ${delay / 1000}s... (${retryCount}/${maxRateLimitRetries})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    } else { throw error; }
                }
            }
        }

        async _finalizeUpload() {
            this.options.onProgress({ percent: ChunkedUploader.FINALIZATION_START_PERCENT, statusText: 'Finalizing upload...' });
            const finalizeData = new FormData();
            finalizeData.append('file_id', this.fileId);
            finalizeData.append('total_chunks', this.totalChunks);
            finalizeData.append('filename', this.file.name);
            finalizeData.append('file_size', this.fileSize);
            finalizeData.append('expiry', this.options.getExpiry());
            finalizeData.append('encrypted', this.options.getIsEncrypted());
            const csrfToken = this.options.getCsrfToken(finalizeData);
            let finalizationProgress = ChunkedUploader.FINALIZATION_START_PERCENT;
            if(this.finalizationInterval) clearInterval(this.finalizationInterval); // Clear previous just in case
            this.finalizationInterval = setInterval(() => {
                finalizationProgress += 0.5;
                if (finalizationProgress < 99) { this.options.onProgress({ percent: Math.floor(finalizationProgress), statusText: 'Finalizing...' }); }
                else { if (this.finalizationInterval) clearInterval(this.finalizationInterval); this.finalizationInterval = null; }
            }, 300);
            try {
                const finalizeResponse = await fetch(this.options.finalizeUrl, {
                    method: 'POST', body: finalizeData, headers: { 'X-CSRF-Token': csrfToken, 'X-Requested-With': 'XMLHttpRequest' }
                });
                if (this.finalizationInterval) clearInterval(this.finalizationInterval); this.finalizationInterval = null;
                if (!finalizeResponse.ok) {
                    let errorText = await finalizeResponse.text();
                    try { const jsonError = JSON.parse(errorText); if (jsonError && jsonError.error) { errorText = jsonError.error; } } catch (e) { /* Ignore */ }
                    throw new Error(`Failed to finalize upload: ${errorText}`);
                }
                const result = await finalizeResponse.json();
                this.uploadComplete = true;
                this.options.onProgress({ percent: 100, statusText: 'Complete!' });
                this.options.onSuccess(result);
            } catch (error) {
                if (this.finalizationInterval) clearInterval(this.finalizationInterval); this.finalizationInterval = null;
                console.error("Finalization failed:", error);
                this.uploadComplete = true;
                throw error;
            }
        }

        async start() {
            this.uploadStartTime = Date.now(); this.lastProgressUpdate = this.uploadStartTime;
            this.uploadComplete = false; this.bytesUploaded = 0; this.completedChunks = 0;
            this.nextChunkIndex = 0; this.activeUploads = 0; this.speedMeasurements = [];
            this._updateProgress(); // Initial 0%
            if (this.fileSize === 0 && this.totalChunks === 0) {
                console.log("File is empty, finalizing immediately.");
                return this._finalizeUpload().catch(err => { this.options.onError(err); throw err; });
            }
            if (this.totalChunks <= 0 && this.fileSize > 0) {
                const err = new Error(`Cannot process file: Size=${this.fileSize}, Chunks=${this.totalChunks}`);
                this.options.onError(err); throw err;
            }
            return new Promise((resolve, reject) => {
                const overallError = null;
                const checkCompletion = async () => {
                    if (this.completedChunks === this.totalChunks && !this.uploadComplete) {
                         try { await this._finalizeUpload(); resolve(); } catch (err) { reject(err); }
                    }
                };
                const uploadNextChunk = async () => {
                    if (this.nextChunkIndex >= this.totalChunks || this.uploadComplete) return;
                    const chunkIndexToUpload = this.nextChunkIndex++;
                    this.activeUploads++;
                    try {
                        await this._uploadChunkWithRateLimitRetry(chunkIndexToUpload);
                        if (this.uploadComplete) return; // Stop if failed during await
                        this.completedChunks++;
                        await checkCompletion();
                    } catch (error) {
                        if (!this.uploadComplete) { this.uploadComplete = true; reject(error); }
                    } finally {
                        this.activeUploads--;
                        if (!this.uploadComplete && this.activeUploads < ChunkedUploader.MAX_CONCURRENT_UPLOADS) {
                            setTimeout(uploadNextChunk, 5);
                        }
                    }
                };
                const initialUploads = Math.min(ChunkedUploader.MAX_CONCURRENT_UPLOADS, this.totalChunks);
                for (let i = 0; i < initialUploads; i++) { setTimeout(uploadNextChunk, i * 20); }
            }).catch(error => {
                 if (!this.uploadComplete) { this.uploadComplete = true; this.options.onError(error); }
                 console.error("Upload process failed:", error);
                 // Don't re-throw here, let the initial caller handle promise rejection if needed
            });
        }
    }
    // --- End ChunkedUploader Class ---

    // Handle encryption and upload
    async function encryptAndUpload(file) {
        let sampleInput = null;
        let uploader = null; // To potentially access uploader state if needed, though callbacks are preferred
        try {
            // Generate a random encryption key
            const encryptionKey = await FileEncryption.generateKey();

            // --- Start Encryption Phase Display ---
            updateProgress(null, getRandomEncryptionPhrase(), 'encrypting');

            await new Promise(resolve => setTimeout(resolve, 50));

            const originalSample = file.slice(0, 4096);

            try {
                // Encrypt sample and file
                const encryptedSample = await FileEncryption.encryptFile(originalSample, encryptionKey);
                const sampleArrayBuffer = await encryptedSample.arrayBuffer();
                const sampleBase64 = FileEncryption.arrayBufferToBase64(sampleArrayBuffer);
                const encryptedBlob = await FileEncryption.encryptFile(file, encryptionKey);

                // Create hidden input (still used by uploader)
                sampleInput = document.createElement('input');
                sampleInput.type = 'hidden';
                sampleInput.name = 'encrypted_sample';
                sampleInput.value = sampleBase64;
                elements.uploadForm.appendChild(sampleInput);

                const encryptedFile = new File([encryptedBlob], file.name, { type: file.type, lastModified: file.lastModified });

                // --- Transition to Upload Phase Display ---
                updateProgress(0, "Encryption complete! Starting upload...", 'uploading');
                await new Promise(resolve => setTimeout(resolve, 50));

                // Instantiate and start the uploader
                uploader = new ChunkedUploader(encryptedFile, {
                    getCsrfToken: ensureCsrfToken,
                    getExpiry: () => elements.formExpiryInput.value,
                    getIsEncrypted: () => 'true',
                    getSampleBase64: () => sampleBase64, // Provide the sample
                    onProgress: (progress) => {
                        // Pass the raw progress object to updateProgress
                        updateProgress(progress.percent, progress, 'uploading');
                    },
                    onSuccess: (result) => {
                        setTimeout(() => {
                            window.location.href = result.redirect_url + '#' + encryptionKey;
                        }, 500);
                         if (sampleInput && sampleInput.parentNode) { // Cleanup sample input on success
                             elements.uploadForm.removeChild(sampleInput);
                         }
                         // No need to call resetUploadUI on success, as we are redirecting
                    },
                    onError: (error) => {
                        showError('Upload failed: ' + error.message);
                         if (sampleInput && sampleInput.parentNode) { // Cleanup sample input on error
                             elements.uploadForm.removeChild(sampleInput);
                         }
                        resetUploadUI();
                    }
                });

                await uploader.start(); // Start and wait for completion or error

            } catch (encryptionError) {
                 // This catch block now primarily catches encryption errors
                 // Uploader errors are handled by its onError callback
                console.error('Encryption operation failed:', encryptionError);
                const errorMessage = encryptionError.message || 'An unknown encryption error occurred';
                updateProgress(null, `Encryption failed: ${errorMessage}`, 'encrypting');

                if (sampleInput && sampleInput.parentNode) {
                    elements.uploadForm.removeChild(sampleInput);
                }
                setTimeout(resetUploadUI, 5000);
            }
        } catch (keyGenError) { // Catch errors from key generation
            console.error('Encryption setup failed (key generation):', keyGenError);
            updateProgress(null, 'Encryption setup failed: ' + keyGenError.message, 'error');
            // sampleInput shouldn't exist here, but check just in case
             if (sampleInput && sampleInput.parentNode) {
                elements.uploadForm.removeChild(sampleInput);
            }
            setTimeout(resetUploadUI, 5000);
        }
        // No finally block needed here as cleanup is handled by callbacks or error handlers
    }

    // Process regular, unencrypted upload (Now uses ChunkedUploader)
    function processRegularUpload(file) {
        updateProgress(0, "Preparing upload...", 'uploading');

        setTimeout(() => {
            const uploader = new ChunkedUploader(file, {
                getCsrfToken: ensureCsrfToken,
                getExpiry: () => elements.formExpiryInput.value,
                getIsEncrypted: () => 'false', // Explicitly false
                onProgress: (progress) => {
                    // Pass the raw progress object to updateProgress
                    updateProgress(progress.percent, progress, 'uploading');
                },
                onSuccess: (result) => {
                    setTimeout(() => {
                        window.location.href = result.redirect_url;
                    }, 500);
                    // No need to call resetUploadUI on success
                },
                onError: (error) => {
                    showError('Upload failed: ' + error.message);
                    resetUploadUI();
                }
            });

            // Start the upload, handle potential immediate errors from start()
             uploader.start().catch(err => {
                 // This primarily catches errors during the *setup* of the upload promise
                 // or potentially finalization errors not caught internally
                 console.error("ChunkedUploader initiation or finalization failed:", err);
                 // Check if error already displayed by callback
                  const errorContainer = document.getElementById('errorContainer');
                  if (!errorContainer || errorContainer.style.display === 'none') {
                      showError('Upload failed unexpectedly: ' + err.message);
                  }
                 resetUploadUI();
             });

        }, 50); // End setTimeout
    }

    // Ensure CSRF token is included (remains in initializeUploader scope)
    function ensureCsrfToken(formData) { // Now accepts formData to set the token
        // Always get the most current token from the DOM
        const csrfTokenInput = document.getElementById('formCsrfToken');
        let csrfToken = '';
        
        if (csrfTokenInput && csrfTokenInput.value) {
            csrfToken = csrfTokenInput.value;
        } else {
            // As a fallback, try to parse it from the cookie
            const csrfCookie = document.cookie.split('; ').find(row => row.startsWith('csrf_token='));
            if (csrfCookie) {
                csrfToken = csrfCookie.split('=')[1];
            } else {
                console.error('No CSRF token found in form or cookie');
            }
        }
        
        // Always set the csrf token in the form data
        formData.set('csrf_token', csrfToken);
        return csrfToken;
    }

    // Update progress bar (Now uses helpers)
    function updateProgress(percent, data, phase) {
        // Hide any error message when showing progress
        const errorContainer = document.getElementById('errorContainer');
        if (errorContainer) {
            errorContainer.style.display = 'none';
        }

        // Determine the current phase SOLELY from the explicit phase argument
        let currentPhase = phase; // Use the provided phase directly
        
        // Store latest progress data if uploading
        if (currentPhase === 'uploading' && typeof data === 'object' && data !== null) {
            lastProgressPercent = data.percent !== undefined ? data.percent : percent; // Use percent from object if available
            // Prioritize statusText (like 'Finalizing...'), then timeRemainingText
            lastTimeRemainingText = data.statusText || data.timeRemainingText || null;
        } else {
             // If data is not a progress object (e.g., initial string, null, or different phase), reset stored time
             lastTimeRemainingText = null;
             if (percent !== null) lastProgressPercent = percent;
        }

        // Call helper functions
        _setVisualPhase(currentPhase);
        _updateProgressBarDisplay(percent, currentPhase);
        _updateProgressTextDisplay(percent, currentPhase, typeof data === 'string' ? data : null);
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
    }

    // --- Helper Functions ---
    function _cacheDOMElements() {
        return {
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
    }

    function _setupEventHandlers(elements, handleFileSelectionCallback) {
        if (elements.selectFileBtn) {
            elements.selectFileBtn.addEventListener('click', () => fileInput.click());
        }
        if (fileInput) {
            fileInput.addEventListener('change', handleFileSelectionCallback);
        }
        if (dropZone) {
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
                    handleFileSelectionCallback();
                }
            });
        }
    }

    // --- Progress Update Helper Functions ---

    // Sets CSS classes on body and logo for visual phase indication
    function _setVisualPhase(phase) {
        document.body.classList.remove('encrypting-active', 'uploading-active');
        const fishLogo = document.querySelector('.drop-zone-logo'); // Target the original logo
        const clonedLogo = document.querySelector('.uploading-logo'); // Target the cloned logo used during upload

        if (fishLogo) fishLogo.classList.remove('encrypting', 'uploading');
        if (clonedLogo) clonedLogo.classList.remove('encrypting', 'uploading');

        if (phase === 'encrypting' || phase === 'uploading') {
            document.body.classList.add(phase + '-active');
            // Apply animation class primarily to the cloned logo if it exists, else the original
            const logoToAnimate = clonedLogo || fishLogo;
            if (logoToAnimate) {
                logoToAnimate.classList.add(phase);
            }
        }
    }

    // Manages the progress bar display (width, animation, crawl)
    function _updateProgressBarDisplay(percent, phase) {
         // --- Clear the starting progress interval if phase changes or real progress arrives ---
         if (phase !== 'uploading' || (phase === 'uploading' && percent !== null && percent > 0)) {
              if (startingProgressInterval) {
                 clearInterval(startingProgressInterval);
                 startingProgressInterval = null;
                 isUploadStarting = false;
             }
         }

        if (phase === 'encrypting') {
            elements.progressBar.classList.add('indefinite');
            elements.progressBar.style.width = '100%';
            elements.progressBar.style.transition = 'none';
        } else {
            elements.progressBar.classList.remove('indefinite');
            elements.progressBar.style.transition = 'width 0.3s ease-in-out'; // Default transition

            if (percent !== null && percent >= 0 && percent <= 100) {
                 // Handle transition *from* starting crawl to real progress
                if (phase === 'uploading' && percent > 0 && isUploadStarting) {
                    isUploadStarting = false; // Stop crawl state
                    // Ensure smooth transition by potentially using a slightly faster animation
                    elements.progressBar.style.transition = 'width 0.1s ease-out';
                }
                elements.progressBar.style.width = percent + '%';

                 // Set completion color
                if (percent === 100) {
                     elements.progressBar.style.backgroundColor = '#27ae60'; // Darker green
                } else {
                     elements.progressBar.style.backgroundColor = '#4CAF50'; // Reset to default green
                }

            } else if (phase === 'uploading' && (percent === 0 || percent === null)) {
                // --- Handle the VERY start of the upload phase (Initial Crawl) ---
                if (!isUploadStarting) {
                    isUploadStarting = true;
                    elements.progressBar.style.transition = 'none';
                    elements.progressBar.style.width = '1%';
                    if (startingProgressInterval) clearInterval(startingProgressInterval); // Clear old one

                    startingProgressInterval = setInterval(() => {
                        if (!isUploadStarting) {
                            clearInterval(startingProgressInterval); startingProgressInterval = null; return;
                        }
                        let currentWidth = parseFloat(elements.progressBar.style.width) || 0;
                        if (currentWidth < 5) {
                            elements.progressBar.style.transition = 'width 0.1s linear';
                            elements.progressBar.style.width = (currentWidth + 0.2) + '%';
                        } else {
                            clearInterval(startingProgressInterval); startingProgressInterval = null;
                        }
                    }, 100);
                }
            }
        }
    }

    // Manages the progress text display and phrase rotation interval
    function _updateProgressTextDisplay(percent, phase, initialText = null) {
        // Clear existing phrase rotation interval
        if (phrasesInterval) {
            clearInterval(phrasesInterval);
            phrasesInterval = null;
        }

        // --- Handle Specific States (Non-rotating text) ---
        if (phase === 'encrypting') {
            elements.progressText.textContent = initialText || getRandomEncryptionPhrase();
            // Keep rotating encryption phrases (no status alternation needed)
            phrasesInterval = setInterval(() => {
                elements.progressText.textContent = getRandomEncryptionPhrase();
            }, 5000);
            return; // Don't proceed to upload rotation logic
        }

        if (percent === 100) {
             elements.progressText.textContent = initialText || '100% - Complete!';
             showPhraseNext = false; // Reset flag
             return; // Don't start interval for completed state
        }

        if (phase === 'uploading' && percent === 0 && initialText) {
            // Handle initial upload messages like "Preparing..." or "Encryption complete..."
             elements.progressText.textContent = initialText;
             showPhraseNext = false; // Reset flag, start with status next time
             // Don't start the interval quite yet, wait for actual progress > 0
             return;
        } else if (percent === null && initialText) {
            // Handle cases where percent might be null but we have text (e.g., initial encrypting call)
             elements.progressText.textContent = initialText;
             return;
        }

        // --- Handle Upload Phase Rotation --- 
        if (phase === 'uploading' && percent !== null && percent < 100) {
             // This function runs every interval tick
            const updateRotatingText = () => {
                 let textToShow = '';
                 // Use the stored progress percent
                 const displayPercent = Math.min(lastProgressPercent || 0, 99); 

                // Decide whether to show phrase or status/time
                if (showPhraseNext || !lastTimeRemainingText) {
                     textToShow = `${displayPercent}% - ${getRandomFishPhrase()}`;
                } else {
                     textToShow = `${displayPercent}% - ${lastTimeRemainingText}`;
                }

                elements.progressText.textContent = textToShow;
                showPhraseNext = !showPhraseNext; // Toggle for next tick
            };

             // Set initial text for this step before interval starts
             updateRotatingText(); 
             // Start the rotation interval
            phrasesInterval = setInterval(updateRotatingText, 3000); // Rotate every 3 seconds
        } else {
             // Fallback for unexpected states or non-upload phases without initialText
             elements.progressText.textContent = ' '; // Clear text
        }
    }

    // --- End Progress Update Helper Functions ---
    // --- End Helper Functions ---
}

// Export functions
if (typeof module !== 'undefined') {
    module.exports = { initializeUploader };
} 