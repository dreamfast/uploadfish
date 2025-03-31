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
    // --- New state variables for initial upload progress ---
    let isUploadStarting = false;
    let startingProgressInterval = null;

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
    // These functions are now defined in phrases.js
    // function getRandomFishPhrase() {
    //     return getRandomPhrase(phrases.fish);
    // }
    //
    // function getRandomEncryptionPhrase() {
    //     return getRandomPhrase(phrases.encryption);
    // }

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
    }

    // Handle encryption and upload
    async function encryptAndUpload(file) {
        let sampleInput = null;
        try {
            // Generate a random encryption key
            const encryptionKey = await FileEncryption.generateKey();

            // --- Start Encryption Phase Display ---
            // Show indefinite progress bar and start rotating encryption phrases.
            // The updateProgress function now handles the interval internally.
            updateProgress(null, getRandomEncryptionPhrase(), 'encrypting');
            
            // Allow UI to update before heavy work
            await new Promise(resolve => setTimeout(resolve, 50)); 
            
            // First, create a 4KB sample from the original file for validation (quick operation)
            const originalSample = file.slice(0, 4096);
            // Optional: Update text briefly, but keep the 'encrypting' phase active
            // updateProgress(null, "Creating validation sample...", 'encrypting'); 
            
            try {
                // Encrypt the sample separately (also relatively quick)
                const encryptedSample = await FileEncryption.encryptFile(originalSample, encryptionKey);
                const sampleArrayBuffer = await encryptedSample.arrayBuffer();
                const sampleBase64 = FileEncryption.arrayBufferToBase64(sampleArrayBuffer);
                
                // Optional: Update text briefly
                // updateProgress(null, "Sample created! Encrypting main file...", 'encrypting');

                // --- Encrypt the MAIN file (This is the long part) ---
                const encryptedBlob = await FileEncryption.encryptFile(file, encryptionKey);

                // --- Prepare for Upload Phase ---
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

                // --- Transition to Upload Phase Display ---
                // Set progress bar to a starting percentage for upload and switch phrase rotation.
                updateProgress(0, "Encryption complete! Starting upload...", 'uploading'); // Start upload progress at 0%
                
                // Allow UI to update before starting upload
                await new Promise(resolve => setTimeout(resolve, 50)); 
                
                // Start the actual chunked upload process
                await sendChunkedUpload(encryptedFile, encryptionKey, sampleBase64);
                
            } catch (encryptionError) {
                console.error('Encryption operation failed:', encryptionError);
                // Display error using the progress UI
                updateProgress(null, 'Encryption failed: ' + encryptionError.message, 'error');
                // Reset UI after error display
                setTimeout(resetUploadUI, 5000);
            }
        } catch (error) {
            console.error('Encryption setup failed:', error);
             // Display error using the progress UI
             updateProgress(null, 'Encryption setup failed: ' + error.message, 'error');
             // Reset UI after error display
             setTimeout(resetUploadUI, 5000); 
        } finally {
            // Cleanup: sampleInput removal (if needed on failure) should be handled within catch blocks
            // Interval clearing is now handled by updateProgress
        }
    }

    // Process regular, unencrypted upload
    function processRegularUpload(file) {
        // Show initial progress feedback immediately
        updateProgress(0, "Preparing upload...", 'uploading');
        
        // Use chunked upload for better progress reporting
        // Add a slight delay to allow UI to update before starting
        setTimeout(() => {
           sendChunkedUpload(file);
        }, 50); 
    }

    // Constants for chunked upload
    const MAX_CHUNK_SIZE = 80 * 1024 * 1024; // 80MB absolute maximum chunk size
    const MIN_CHUNK_SIZE = 1 * 1024 * 1024;  // 1MB minimum chunk size
    const IDEAL_CHUNK_COUNT = 10;            // Aim for at least this many chunks for better progress reporting
    const MAX_RETRIES = 3;
    
    // Determine optimal chunk size based on file size
    function getOptimalChunkSize(fileSize) {
        // Always try to have at least IDEAL_CHUNK_COUNT chunks for a better progress experience
        const chunkSizeForIdealCount = Math.ceil(fileSize / IDEAL_CHUNK_COUNT);
        
        // Adjust based on file size categories
        if (fileSize < 10 * 1024 * 1024) { // Less than 10MB
            // For very small files, use smaller chunks but ensure at least 5 chunks
            return Math.min(
                Math.max(MIN_CHUNK_SIZE, chunkSizeForIdealCount),
                Math.ceil(fileSize / 5)
            );
        } 
        
        if (fileSize < 100 * 1024 * 1024) { // 10MB - 100MB
            // For small files, ensure at least IDEAL_CHUNK_COUNT chunks
            return Math.min(
                Math.max(MIN_CHUNK_SIZE, chunkSizeForIdealCount),
                10 * 1024 * 1024 // Cap at 10MB per chunk for small files
            );
        }
        
        if (fileSize < 1024 * 1024 * 1024) { // 100MB - 1GB
            // For medium files, aim for chunks of 5-20MB
            return Math.min(
                Math.max(5 * 1024 * 1024, chunkSizeForIdealCount),
                20 * 1024 * 1024
            );
        }
        
        // For large files (over 1GB), use larger chunks but ensure we don't exceed MAX_CHUNK_SIZE
        return Math.min(
            Math.max(10 * 1024 * 1024, fileSize / IDEAL_CHUNK_COUNT), 
            MAX_CHUNK_SIZE
        );
    }
    
    // Send the file in chunks
    async function sendChunkedUpload(file, encryptionKey = null, sampleBase64 = null) {
        // Prepare for chunked upload
        const fileSize = file.size;
        const fileId = crypto.randomUUID(); // Generate a unique ID for this upload
        const chunkSize = getOptimalChunkSize(fileSize); // Dynamic chunk size
        const totalChunks = Math.ceil(fileSize / chunkSize);
        let currentChunk = 0;
        let bytesUploaded = 0;
        let uploadStartTime = Date.now();
        let lastProgressUpdate = uploadStartTime;
        let uploadComplete = false;
        
        // For smoothing the time remaining estimate
        const speedMeasurements = [];
        const MAX_SPEED_MEASUREMENTS = 5;

        // Start phrase rotation for chunked upload
        updateProgress(0, "0% - " + getRandomFishPhrase());
        phrasesInterval = setInterval(function() {
            // Allocate 95% of progress bar for chunk uploads, 5% for finalization
            const percent = Math.floor((bytesUploaded / fileSize) * 95);
            elements.progressText.textContent = percent + "% - " + getRandomFishPhrase();
        }, 5000);
        
        // Helper function to upload a single chunk
        async function uploadChunk(chunkIndex, retryCount = 0) {
            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, fileSize);
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
                // Allocate 95% of progress bar for chunk uploads, 5% for finalization
                const percent = Math.floor((bytesUploaded / fileSize) * 95);
                
                const now = Date.now();
                if (now - lastProgressUpdate > 200) {
                    const elapsedSeconds = (now - uploadStartTime) / 1000;
                    const currentSpeed = (end - start) / ((now - lastProgressUpdate) / 1000);
                    
                    // Store speed measurements for smoothing
                    if (currentSpeed > 0 && isFinite(currentSpeed)) {
                        speedMeasurements.push(currentSpeed);
                        
                        // Keep only the most recent measurements
                        if (speedMeasurements.length > MAX_SPEED_MEASUREMENTS) {
                            speedMeasurements.shift();
                        }
                    }
                    
                    // Calculate average speed from measurements
                    const avgBytesPerSecond = speedMeasurements.length > 0 
                        ? speedMeasurements.reduce((a, b) => a + b, 0) / speedMeasurements.length 
                        : bytesUploaded / elapsedSeconds;
                    
                    // Calculate time remaining estimate
                    if (avgBytesPerSecond > 0 && bytesUploaded < fileSize) {
                        const bytesRemaining = fileSize - bytesUploaded;
                        const secondsRemaining = Math.ceil(bytesRemaining / avgBytesPerSecond);
                        
                        // Only show time remaining after a few seconds of upload
                        if (elapsedSeconds > 2 && secondsRemaining > 0) {
                            let timeRemainingText = '';
                            
                            if (secondsRemaining < 60) {
                                timeRemainingText = `${secondsRemaining} sec remaining`;
                            } else if (secondsRemaining < 3600) {
                                const minutes = Math.ceil(secondsRemaining / 60);
                                timeRemainingText = `${minutes} min remaining`;
                            } else {
                                const hours = Math.floor(secondsRemaining / 3600);
                                const minutes = Math.ceil((secondsRemaining % 3600) / 60);
                                timeRemainingText = `${hours}h ${minutes}m remaining`;
                            }
                            
                            // Update progress bar text with time remaining
                            elements.progressText.textContent = `${percent}% - ${timeRemainingText}`;
                        } else {
                            elements.progressText.textContent = percent + "% - " + getRandomFishPhrase();
                        }
                    }
                    
                    // Update progress bar
                    elements.progressBar.style.width = percent + '%';
                    
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
                    
                    // Update overall progress based on completed chunks
                    const totalProgress = Math.floor((completedChunks / totalChunks) * 95);
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
            // Show that we're finalizing the upload
            updateProgress(95, '95% - Finalizing upload...');
            
            const finalizeData = new FormData();
            finalizeData.append('file_id', fileId);
            finalizeData.append('total_chunks', totalChunks);
            finalizeData.append('filename', file.name);
            finalizeData.append('file_size', fileSize);
            finalizeData.append('expiry', elements.formExpiryInput.value);
            finalizeData.append('encrypted', elements.formEncryptedInput.value);
            
            // Add CSRF token
            const csrfToken = ensureCsrfToken(finalizeData);
            
            // Start finalization progress simulation
            let finalizationProgress = 95;
            const finalizationInterval = setInterval(() => {
                finalizationProgress += 0.5;
                if (finalizationProgress < 99) {
                    elements.progressBar.style.width = finalizationProgress + '%';
                    elements.progressText.textContent = Math.floor(finalizationProgress) + '% - Finalizing...';
                }
            }, 300);
            
            try {
                const finalizeResponse = await fetch('/upload/finalize', {
                    method: 'POST',
                    body: finalizeData,
                    headers: {
                        'X-CSRF-Token': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                
                // Clear the finalization animation
                clearInterval(finalizationInterval);
                
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
                // Clear the finalization animation if there was an error
                clearInterval(finalizationInterval);
                throw error; // Propagate the error to the outer catch block
            }
        } catch (error) {
            console.error('Upload failed:', error);
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
        const file = elements.formFileInput.files[0];
        // Always use chunked upload for all files
        return sendChunkedUpload(file, encryptionKey);
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
    function updateProgress(percent, text, phase) {
        // Hide any error message when showing progress
        const errorContainer = document.getElementById('errorContainer');
        if (errorContainer) {
            errorContainer.style.display = 'none';
        }

        // Determine the current phase based on the text or existing state
        let currentPhase = null;
        if (document.body.classList.contains('encrypting-active')) {
            currentPhase = 'encrypting';
        } else if (document.body.classList.contains('uploading-active')) {
            currentPhase = 'uploading';
        }

        // Explicitly set phase based on text if provided
        if (text) {
           if (text.includes('Encrypting') || text.includes('Sample') || text.includes('validation') || text.includes('Securing') || text.includes('invisible') || text.includes('Generating')) {
               currentPhase = 'encrypting';
           } else if (text.includes('Upload') || text.includes('Catching') || text.includes('%') || text.includes('Finalizing') || text.includes('fish')) {
               currentPhase = 'uploading';
           }
        }
        
        // Clear any existing phrase rotation interval FIRST
        if (phrasesInterval) {
            clearInterval(phrasesInterval);
            phrasesInterval = null;
        }
        // --- Clear the starting progress interval on phase change ---
        if (phase !== 'uploading' && startingProgressInterval) {
            clearInterval(startingProgressInterval);
            startingProgressInterval = null;
            isUploadStarting = false;
        }

        // Update body classes and fish logo animation based on determined phase
        document.body.classList.remove('encrypting-active', 'uploading-active');
        const fishLogo = document.querySelector('.drop-zone-logo'); // Ensure we target the correct logo instance
        if (fishLogo) {
           fishLogo.classList.remove('encrypting', 'uploading');
        }
        
        if (currentPhase) {
            document.body.classList.add(currentPhase + '-active');
            if (fishLogo) {
               fishLogo.classList.add(currentPhase);
            }
        }

        // Handle progress bar style (indefinite for encryption, percentage otherwise)
        if (currentPhase === 'encrypting') {
            elements.progressBar.classList.add('indefinite');
            elements.progressBar.style.width = '100%'; // Ensure indefinite bar spans full width
            elements.progressBar.style.transition = 'none'; // No transition for indefinite
        } else {
            elements.progressBar.classList.remove('indefinite');
            elements.progressBar.style.transition = 'width 0.3s ease-in-out';
            // Update progress bar width only if percent is provided and valid
            if (percent !== null && percent >= 0 && percent <= 100) {
                // --- Handle transition from starting crawl to real progress ---
                if (phase === 'uploading' && percent > 0 && isUploadStarting) {
                    if (startingProgressInterval) {
                        clearInterval(startingProgressInterval);
                        startingProgressInterval = null;
                    }
                    isUploadStarting = false;
                    // Ensure smooth transition by potentially using a slightly faster animation here
                    elements.progressBar.style.transition = 'width 0.1s ease-out'; 
                }
                elements.progressBar.style.width = percent + '%';
            } else if (phase === 'uploading' && (percent === 0 || percent === null)) {
                 // --- Handle the VERY start of the upload phase ---
                 if (!isUploadStarting) { // Only trigger this once at the start
                     isUploadStarting = true;
                     elements.progressBar.style.transition = 'none'; // No transition for initial jump
                     elements.progressBar.style.width = '1%'; // Initial small bump
                     
                     // Clear any old interval just in case
                     if (startingProgressInterval) clearInterval(startingProgressInterval);
                     
                     // Start the slow crawl
                     startingProgressInterval = setInterval(() => {
                         // Check flag again in case real progress arrived fast
                         if (!isUploadStarting) {
                              clearInterval(startingProgressInterval);
                              startingProgressInterval = null;
                              return;
                         }
                         let currentWidth = parseFloat(elements.progressBar.style.width) || 0;
                         if (currentWidth < 5) { // Cap at 5%
                             elements.progressBar.style.transition = 'width 0.1s linear'; // Smooth crawl
                             elements.progressBar.style.width = (currentWidth + 0.2) + '%'; 
                         } else { // Stop crawling if we reach the cap
                             clearInterval(startingProgressInterval);
                             startingProgressInterval = null;
                         }
                     }, 100); // Adjust interval time as needed
                 }
            }
        }

        // Set initial text content
        if (text) {
            elements.progressText.textContent = text;
        } else if (percent !== null) {
            // Default text if only percentage is provided
            elements.progressText.textContent = percent + '%';
        }

        // Start new phrase rotation interval based on the current phase (and not already complete)
        if (percent !== null && percent < 100) {
            if (currentPhase === 'encrypting') {
                // Immediately set an encryption phrase if text wasn't provided
                if (!text) elements.progressText.textContent = getRandomEncryptionPhrase();
                
                phrasesInterval = setInterval(() => {
                    elements.progressText.textContent = getRandomEncryptionPhrase();
                }, 5000);
            } else if (currentPhase === 'uploading') {
                // Immediately set an upload phrase if text wasn't provided
                const currentPercent = parseInt(elements.progressBar.style.width) || percent || 0;
                if (!text) elements.progressText.textContent = currentPercent + "% - " + getRandomFishPhrase();
                
                phrasesInterval = setInterval(() => {
                    // Re-read percent from style in case it updated without a text change
                    const updatedPercent = parseInt(elements.progressBar.style.width) || 0;
                    elements.progressText.textContent = updatedPercent + "% - " + getRandomFishPhrase();
                }, 5000);
            }
        } else if (percent === 100) {
             // Ensure completion text is set if not provided explicitly
             if (!text || !text.toLowerCase().includes('complete')) {
                 elements.progressText.textContent = '100% - Complete!';
             }
             elements.progressBar.style.backgroundColor = '#27ae60'; // Darker green for completion
        } else {
            // Handle cases where percent might be null but phase is set (e.g., initial call)
             if (currentPhase === 'encrypting' && !text) {
                 elements.progressText.textContent = getRandomEncryptionPhrase();
                 phrasesInterval = setInterval(() => {
                     elements.progressText.textContent = getRandomEncryptionPhrase();
                 }, 5000);
             } else if (currentPhase === 'uploading' && !text) {
                 elements.progressText.textContent = "0% - " + getRandomFishPhrase();
                 phrasesInterval = setInterval(() => {
                    const updatedPercent = parseInt(elements.progressBar.style.width) || 0;
                    elements.progressText.textContent = updatedPercent + "% - " + getRandomFishPhrase();
                 }, 5000);
             }
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