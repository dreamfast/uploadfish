# UploadFish Changes

## Changes

- The non js upload, we need to limit to 99mb as cloudflare has a limit on upload. The js chunked upload gets around this.

## New Features

- We want to add new tabs onto index.html. The new tabs are 'History' and 'Text'.
 - Text will have a multi line input box, and will upload as a generated text file. When this file is previewed, the text must be displayed in the browser after it is downloaded and decrypted.
 - 'History' will keep track of the users uploads with localStorage. It must consider the expiry time also, when fetching from localStorage we need to filter out any expired uploads. The Hitory tab will show each files information, such as name and size, encyption status and a link to their preview page. 
 - The new history and text tabs also must match the same styling and layout as other areas of the application and must also look good on the mobile view.
- A new expiry time option 'When Viewed'.
 - This will be available for both Text and file uploads.
 - When a file is viewed by another user, it will be removed. Lets do this removal action in the go end point that downloads the file. Keep these actions and changes in Go as much as possible.
 - If the file is viewed by the same person who uploaded it, it cannot be removed.
 - Need UI changes to explain after the file is downloaded, it will no longer be available.

### Hashing check on uploaded chunks

With each chunk that is uploaded, can we do a hashing check to ensure validity of the file. I like Blake3 but unsure if that is easy in vanilla js. The idea is the hash will be uploaded with the chunk, and then also verified on the server side. If the hash is not good, we will reattempt the chunk upload.

### Chunked upload resume?

How difficult would it be to keep track of an uploaded file in localStorage, so if for some reason the browser is closed, and they return and upload the same file, it can pick up from where it left off? Just need to explain if this is possible and if it is, how complex it would be. I can confirm to proceed with the changes if it's straight forward. If we do have a file that can be resumed, we can display a message to the user to upload again the same file to resume it.

## UI Overhaul

After the above changes are added and confirmed working, we want to review and do an overhaul of the UI to improve it. Lets talk about how this may be improved first before making any changes.