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
            // Original phrases
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
            "Navigating the data waters...",
            "Charting the nautical upload...",
            "Scouting for fish servers...",
            "Measuring your catch...",
            "Deploying the data trawler...",
            "Loading the fishing boat...",
            "Calculating fish density...",
            "Checking the sonar...",
            "Navigating through seaweed...",
            "Avoiding the Kraken...",
            "Polishing the sea glass...",
            "Consulting the fish oracle...",
            "Analyzing the fish DNA...",
            "Deploying underwater drones...",
            "Tagging your data fish...",
            "Mapping the migration route...",
            "Looking through the fish eye lens...",
            "Preparing the fish tank...",
            "Cleaning the aquarium...",
            "Adjusting the water salinity...",
            "Calculating spawn rates...",
            "Checking for digital plankton...",
            "Scanning for data reefs...",
            "Translating fish language...",
            "Tuning into whale songs...",
            "Setting sail for data island...",
            "Watching for data tsunamis...",
            "Surfing the binary waves...",
            "Riding the upload current...",
            "Talking to the wise old trout...",
            "Preparing the digital fish food...",
            "Capturing rare data species...",
            "Studying marine file biology...",
            "Visiting Davy Jones' server locker...",
            "Calculating the perfect cast...",
            "Aligning with the lunar tide...",
            "Checking your fishing license...",
            "Analyzing fish behavior patterns...",
            "Calibrating the fish sonar...",
            "Crossing the digital Bermuda Triangle...",
            "Measuring the upload knots...",
            "Recording underwater file sounds...",
            "Tracing fish migration patterns...",
            "Deploying smart fishing buoys...",
            "Adjusting to underwater pressure...",
            "Capturing data with gentle nets...",
            "Negotiating with the server mermaids...",
            "Paying the ferry man...",
            "Searching for the lost city of Data-lantis...",
            "Listening to the conch shell...",
            "Decoding messages in bottles...",
            "Sending data via carrier seagull...",
            "Fighting the mighty data squid...",
            "Sailing through the binary fog...",
            "Ringing the digital ship bell...",
            "Singing sea shanties to your files...",
            "Interpreting cloud formations at sea...",
            "Setting up digital fishing tournaments...",
            "Registering with the Coast Guard...",
            "Scanning for friendly dolphins...",
            "Using data as chum...",
            "Scanning the horizon for pirate servers...",
            "Whistling to the narwhals...",
            "Tuning the underwater radio...",
            "Taming wild data marlin...",
            "Feeding the binary sea lions...",
            "Interpreting seahorse Morse code...",
            "Redirecting the Gulf Stream...",
            "Discovering the ancient scroll of TCP/IP...",
            "Consulting the oracle fish...",
            "Dancing with digital sea turtles...",
            "Watching for bioluminescent data packets...",
            "Measuring salinity of the data lake...",
            "Sending the data submarine deeper...",
            "Searching for the perfect shell...",
            "Counting data barnacles...",
            "Harvesting digital seaweed...",
            "Deflecting the water pressure...",
            "Chatting with wise sea turtles...",
            "Polishing the trident of Neptune...",
            "Breaking through the digital ice caps...",
            "Aligning with marine magnetism...",
            "Filtering the digital plankton...",
            "Balancing on digital waves...",
            "Adjusting to the tidal algorithm...",
            "Consulting the ancient mariner...",
            "Measuring the depth of your data pool...",
            "Syncing with the lunar tide cycle...",
            "Adjusting the sail for data winds...",
            "Photographing rare data fish...",
            "Catching sunlight on digital scales...",
            "Reading the water's memory...",
            "Consulting the nautical charts...",
            "Testing water for data nutrients...",
            "Identifying exotic file species...",
            "Launching echo location...",
            "Calibrating the digital sextant...",
            "Watching for aurora borealis reflections...",
            "Preparing the data fishing journal...",
            "Calculating perfect diving depth...",
            "Consulting with wise old sea captains...",
            "Measuring file buoyancy...",
            "Checking the ship's clock...",
            "Watching for digital high tide...",
            "Scanning the beach for rare file shells...",
            "Consulting the barnacle oracle...",
            "Training digital dolphins...",
            "Watching for passing data icebergs...",
            "Calling to the digital sirens...",
            "Negotiating with the server pirates...",
            "Checking for data sea monsters..."
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
            "Protecting with underwater shields...",
            "Sealing your data in a clam shell...",
            "Encoding with mermaid magic...",
            "Generating Poseidon's password...",
            "Creating Davy Jones' lock...",
            "Installing sea urchin firewalls...",
            "Wrapping files in kelp encryption...",
            "Deploying pufferfish protection...",
            "Activating nautical ciphers...",
            "Hardening your pearl...",
            "Securing with salt water hashing...",
            "Applying barnacle authentication...",
            "Encoding with shark tooth patterns...",
            "Locking in the Marianas Trench...",
            "Disguising as common seaweed...",
            "Camouflaging in coral patterns...",
            "Engaging kraken guard protocols...",
            "Requesting mermaid verification...",
            "Deploying ink cloud obfuscation...",
            "Generating tidal encryption keys...",
            "Applying deep sea pressure locks...",
            "Installing reef access controls...",
            "Setting up seahorse sentries...",
            "Activating whale song authentication...",
            "Deploying electric eel protection...",
            "Enabling starfish verification...",
            "Setting up shell-based access control...",
            "Wrapping in water-tight cryptography...",
            "Hiding in the digital shipwreck...",
            "Spinning nautical encryption webs...",
            "Engraving data on underwater stones...",
            "Creating cryptographic coral barriers...",
            "Deploying anglerfish decoys...",
            "Locking with abyssal pressure...",
            "Encoding with bioluminescent patterns...",
            "Encrypting with sea turtle shell patterns...",
            "Securing with oceanic algorithmic currents...",
            "Applying nautical steganography...",
            "Hiding data in whale songs...",
            "Encrypting with tidal rhythms...",
            "Securing with deep sea volcanic vents...",
            "Encoding with fish scale patterns...",
            "Applying jellyfish sting authentication...",
            "Setting up nautical multi-factor security...",
            "Deploying digital sand dollar tokens...",
            "Generating certificates from sea glass...",
            "Implementing bubble encryption...",
            "Building fortifications of digital coral...",
            "Encrypting with underwater cave systems...",
            "Securing with deep sea pressure locks...",
            "Implementing nautical VPN tunnels...",
            "Creating hermit crab encryption shells...",
            "Deploying sea anemone firewalls...",
            "Generating maelstrom encryption keys...",
            "Encrypting with maritime fog...",
            "Securing with oceanic depth layers...",
            "Setting up shark patrol perimeters...",
            "Implementing aquatic zero-trust security...",
            "Creating digital tide pool vaults...",
            "Applying submarine stealth technology..."
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
        let sampleInput = null;
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
            
            // Update progress for sample encryption
            updateProgress(30, "Creating validation sample...");
            
            try {
                // Encrypt the sample separately for validation
                const encryptedSample = await FileEncryption.encryptFile(originalSample, encryptionKey);
                const sampleArrayBuffer = await encryptedSample.arrayBuffer();
                
                // Convert sample to base64 for storage
                const sampleBase64 = FileEncryption.arrayBufferToBase64(sampleArrayBuffer);
                
                // Update progress for main file encryption
                updateProgress(40, "Sample created! Encrypting main file...");

                // Encrypt the main file
                const encryptedBlob = await FileEncryption.encryptFile(file, encryptionKey);

                // Add the encrypted sample to a hidden form field
                sampleInput = document.createElement('input');
                sampleInput.type = 'hidden';
                sampleInput.name = 'encrypted_sample';
                sampleInput.value = sampleBase64;
                elements.uploadForm.appendChild(sampleInput);

                // Create a File object from the encrypted blob
                const encryptedFile = new File([encryptedBlob], file.name, {
                    type: file.type,
                    lastModified: file.lastModified
                });

                // Check if we should use chunked upload
                if (encryptedFile.size > 10 * 1024 * 1024) { // Use chunked upload for files over 10MB
                    updateProgress(70, "File encryption complete! Starting chunked upload...");
                    
                    // Add the encrypted sample to the chunked upload instead of form
                    await sendChunkedUpload(encryptedFile, encryptionKey, sampleBase64);
                } else {
                    // For smaller files, use regular upload
                    // Copy the encrypted file to the form's file input
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(encryptedFile);
                    elements.formFileInput.files = dataTransfer.files;

                    // Update progress
                    updateProgress(70, "File encryption complete! Preparing upload...");

                    // Send the upload request
                    await sendUploadRequest(encryptionKey);
                }
            } catch (encryptionError) {
                console.error('Encryption operation failed:', encryptionError);
                throw new Error('Failed to encrypt file: ' + encryptionError.message);
            }
        } catch (error) {
            console.error('Encryption process failed:', error);
            showError('Encryption failed: ' + error.message);
            
            // Clean up if encryption fails
            if (sampleInput && sampleInput.parentNode) {
                sampleInput.parentNode.removeChild(sampleInput);
            }
        } finally {
            // Always clear the encryption phrases interval
            if (phrasesInterval) {
                clearInterval(phrasesInterval);
                phrasesInterval = null;
            }
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

    // Constants for chunked upload
    const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks for faster uploads on local/fast networks
    const MAX_RETRIES = 3;
    
    // Send the file in chunks
    async function sendChunkedUpload(file, encryptionKey = null, sampleBase64 = null) {
        // Prepare for chunked upload
        const fileSize = file.size;
        const fileId = crypto.randomUUID(); // Generate a unique ID for this upload
        const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
        let currentChunk = 0;
        let bytesUploaded = 0;
        let uploadStartTime = Date.now();
        let lastProgressUpdate = uploadStartTime;
        let uploadComplete = false;
        
        // Start phrase rotation for chunked upload
        updateProgress(0, "0% - " + getRandomFishPhrase());
        phrasesInterval = setInterval(function() {
            const percent = Math.min(Math.round((bytesUploaded / fileSize) * 100), 99);
            elements.progressText.textContent = percent + "% - " + getRandomFishPhrase();
        }, 5000);
        
        // Helper function to upload a single chunk
        async function uploadChunk(chunkIndex, retryCount = 0) {
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, fileSize);
            const chunk = file.slice(start, end);
            
            const formData = new FormData();
            
            // Add chunk metadata
            formData.append('file', chunk, file.name);
            formData.append('chunk_index', chunkIndex);
            formData.append('total_chunks', totalChunks);
            formData.append('file_id', fileId);
            formData.append('file_size', fileSize);
            formData.append('filename', file.name);
            formData.append('expiry', elements.formExpiryInput.value);
            formData.append('encrypted', elements.formEncryptedInput.value);
            
            // If this is the first chunk and we have an encrypted sample, include it
            if (chunkIndex === 0 && sampleBase64) {
                formData.append('encrypted_sample', sampleBase64);
            }
            
            // Add CSRF token
            const csrfToken = ensureCsrfToken(formData);
            
            try {
                // Upload the chunk
                const response = await fetch('/upload/chunk', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-CSRF-Token': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${await response.text()}`);
                }
                
                // Update progress
                bytesUploaded += (end - start);
                const percent = Math.min(Math.round((bytesUploaded / fileSize) * 100), 99);
                
                const now = Date.now();
                if (now - lastProgressUpdate > 200) {
                    const elapsedSeconds = (now - uploadStartTime) / 1000;
                    const bytesPerSecond = bytesUploaded / elapsedSeconds;
                    
                    if (now - uploadStartTime > 5000) {
                    }
                    
                    // Update progress bar
                    elements.progressBar.style.width = percent + '%';
                    
                    // Update percentage in the phrase
                    const currentText = elements.progressText.textContent;
                    const dashIndex = currentText.indexOf("% -");
                    if (dashIndex >= 0) {
                        const newText = percent + currentText.substring(dashIndex);
                        elements.progressText.textContent = newText;
                    } else {
                        elements.progressText.textContent = percent + "% - " + getRandomFishPhrase();
                    }
                    
                    lastProgressUpdate = now;
                }
                
                return true;
            } catch (error) {
                console.error(`Error uploading chunk ${chunkIndex}:`, error);
                
                // Special handling for rate limit errors
                const isRateLimit = error.message && error.message.includes('429');
                
                // Retry logic with different backoff strategies
                if (retryCount < MAX_RETRIES) {
                    let delay;
                    
                    if (isRateLimit) {
                        // Much longer delay for rate limit errors (4s, 8s, 16s)
                        delay = Math.pow(2, retryCount + 2) * 1000;
                    } else {
                        // Standard delay for other errors
                        delay = 1000 * (retryCount + 1);
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return uploadChunk(chunkIndex, retryCount + 1);
                }
                
                throw error;
            }
        }
        
        try {
            // Upload chunks in parallel for maximum speed
            const MAX_CONCURRENT_UPLOADS = 5; // Fewer concurrent uploads with larger chunks
            let activeUploads = 0;
            let nextChunkIndex = 0;
            let completedChunks = 0;
            
            // Create a function to upload the next chunk in queue
            const uploadNextChunk = async () => {
                if (nextChunkIndex >= totalChunks) {
                    return; // No more chunks to upload
                }
                
                const chunkIndex = nextChunkIndex++;
                activeUploads++;
                
                try {
                    // Use the special rate limit handler instead of direct uploadChunk
                    await uploadChunkWithRateLimitRetry(chunkIndex);
                    completedChunks++;
                    
                    // Update overall progress
                    const totalProgress = Math.min(Math.round((completedChunks / totalChunks) * 100), 99);
                    elements.progressBar.style.width = totalProgress + '%';
                } catch (error) {
                    console.error(`Failed to upload chunk ${chunkIndex} after all retries:`, error);
                    throw error; // Re-throw to be caught by outer try/catch
                } finally {
                    activeUploads--;
                    // Start another upload if there are more chunks
                    if (!uploadComplete) {
                        // Immediately start next chunk for maximum throughput on localhost
                        setTimeout(() => {
                            uploadNextChunk();
                        }, 50); // Minimal delay for local/fast networks
                    }
                }
            };
            
            // Special handling for rate limit errors
            async function uploadChunkWithRateLimitRetry(chunkIndex, maxRetries = MAX_RETRIES + 2) {
                let retryCount = 0;
                
                while (retryCount < maxRetries) {
                    try {
                        return await uploadChunk(chunkIndex);
                    } catch (error) {
                        // If this is a rate limit error, use a longer backoff
                        if (error.message && error.message.includes('429')) {
                            retryCount++;
                            
                            // Use exponentially increasing delays for rate limit errors
                            const delay = Math.min(Math.pow(1.5, retryCount) * 1000, 15000); // Cap at 15 seconds
                            
                            
                            // Wait for the cooldown period
                            await new Promise(resolve => setTimeout(resolve, delay));
                        } else {
                            // For other errors, don't retry, just propagate the error
                            throw error;
                        }
                    }
                }
                
                // If we get here, we've exceeded max retries
                throw new Error(`Failed to upload chunk ${chunkIndex} after ${maxRetries} rate limit retries`);
            }
            
            // Start multiple uploads in parallel
            const initialUploads = Math.min(MAX_CONCURRENT_UPLOADS, totalChunks);
            for (let i = 0; i < initialUploads; i++) {
                setTimeout(() => {
                    uploadNextChunk();
                }, i * 100); // Stagger the initial uploads by 100ms each
            }
            
            // Wait for all chunks to complete
            while (completedChunks < totalChunks && !uploadComplete) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // If any chunk failed, the error would have been thrown
            
            // All chunks uploaded, finalize the upload
            const finalizeData = new FormData();
            finalizeData.append('file_id', fileId);
            finalizeData.append('total_chunks', totalChunks);
            finalizeData.append('filename', file.name);
            finalizeData.append('file_size', fileSize);
            finalizeData.append('expiry', elements.formExpiryInput.value);
            finalizeData.append('encrypted', elements.formEncryptedInput.value);
            
            // Add CSRF token
            const csrfToken = ensureCsrfToken(finalizeData);
            
            const finalizeResponse = await fetch('/upload/finalize', {
                method: 'POST',
                body: finalizeData,
                headers: {
                    'X-CSRF-Token': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            if (!finalizeResponse.ok) {
                throw new Error(`Failed to finalize upload: ${await finalizeResponse.text()}`);
            }
            
            const result = await finalizeResponse.json();
            
            // Success! Show completion and redirect
            uploadComplete = true;
            updateProgress(100, '100% - Complete!');
            
            // Add a small delay before redirect to show the completion
            setTimeout(() => {
                // Redirect with encryption key if needed
                if (encryptionKey) {
                    window.location.href = result.redirect_url + '#' + encryptionKey;
                } else {
                    window.location.href = result.redirect_url;
                }
            }, 500);
            
        } catch (error) {
            console.error('Chunked upload failed:', error);
            showError('Upload failed: ' + error.message);
        } finally {
            // Clear the phrase rotation interval
            if (phrasesInterval) {
                clearInterval(phrasesInterval);
                phrasesInterval = null;
            }
        }
    }

    // Send the upload request with progress tracking
    async function sendUploadRequest(encryptionKey = null) {
        // Check if we should use chunked upload
        const file = elements.formFileInput.files[0];
        if (file && file.size > 10 * 1024 * 1024) { // Use chunked upload for files over 10MB
            return sendChunkedUpload(file, encryptionKey);
        }
        
        let xhr = null;
        let timeoutId = null;
        
        try {
            // Validate form data
            if (!elements.formFileInput.files || !elements.formFileInput.files.length) {
                throw new Error('No file selected for upload');
            }
            
            const formData = new FormData(elements.uploadForm);
            ensureCsrfToken(formData);
            
            // Create controller for aborting fetch request on timeout
            const controller = new AbortController();
            const signal = controller.signal;
            
            // Set timeout to 1 hour (3600000ms) for very large uploads
            timeoutId = setTimeout(() => {
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
            xhr = new XMLHttpRequest();
            xhr.open('POST', '/upload', true);
            xhr.timeout = 3600000; // 1 hour timeout
            
            // Set up proper CSRF token
            const csrfToken = document.getElementById('formCsrfToken')?.value;
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
                        const elapsedSeconds = (now - uploadStartTime) / 1000;
                        const bytesPerSecond = bytesUploaded / elapsedSeconds;
                        
                        // Log upload speed for debugging
                        if (now - uploadStartTime > 5000) { // After 5 seconds, show speed
                        }
                        
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
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                
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
                    console.error('Upload error:', errorMessage);
                    showError(errorMessage);
                }
            };
            
            // Handle network errors
            xhr.onerror = function() {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
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
            
            // Clean up any pending requests or timeouts
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            if (xhr && xhr.readyState !== 4) {
                xhr.abort();
            }
            
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