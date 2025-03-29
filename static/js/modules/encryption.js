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
        if (!base64) {
            console.error('Empty base64 string provided');
            throw new Error('Invalid encryption key: Empty key provided');
        }

        if (typeof base64 !== 'string') {
            console.error('Non-string provided to base64ToArrayBuffer');
            throw new Error('Invalid encryption key: Key must be a string');
        }

        // Trim any whitespace that might have been introduced
        base64 = base64.trim();

        // Restore standard base64 for atob
        base64 = base64.replace(/-/g, '+').replace(/_/g, '/');

        // Add padding if needed
        while (base64.length % 4 !== 0) {
            base64 += '=';
        }

        // Validate base64 string format
        const base64Regex = /^[A-Za-z0-9+/=]+$/;
        if (!base64Regex.test(base64)) {
            console.error('Invalid characters in base64 string');
            throw new Error('Invalid encryption key: Contains invalid characters');
        }

        try {
            const binary = atob(base64);

            // Check if we got a reasonable key length (should be 32 bytes for AES-256)
            if (binary.length !== 32) {
                console.warn(`Unusual key length: ${binary.length} bytes (expected 32 bytes for AES-256)`);
                // Continue anyway since some keys might be different lengths
            }

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

// Export FileEncryption for use in other modules
if (typeof module !== 'undefined') {
    module.exports = FileEncryption;
} 