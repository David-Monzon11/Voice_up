// Import Firebase services from config
import { db, auth, storage } from './firebase-config.js';
import { USE_CLOUDINARY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET, CLOUDINARY_FOLDER } from './media-config.js';
import { ref, push, set, update } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-storage.js";

/**
 * Submit a new complaint
 * @param {Object} complaintData - Complaint data object
 * @param {File} file - Optional file to upload (image/video)
 * @returns {Promise<Object>} Result object
 */
export async function submitComplaint(complaintData, file = null) {
    try {
        const user = auth.currentUser;
        if (!user) {
            return {
                success: false,
                error: "You must be logged in to submit a complaint"
            };
        }

        // Validate required fields
        if (!complaintData.title || !complaintData.description || !complaintData.category || !complaintData.location) {
            return {
                success: false,
                error: "Please fill in all required fields"
            };
        }

        // If a file will be uploaded, precompute a stable storage path to avoid mismatch
        let plannedStoragePath = null;
        let inlineImage = null;
        if (!USE_CLOUDINARY) {
            if (file && file.name) {
                const nameParts = file.name.split('.');
                const fileExtension = nameParts.length > 1 ? nameParts.pop() : 'bin';
                plannedStoragePath = `complaints/${user.uid}/${Date.now()}.${fileExtension}`;
            }
        }

        // If image, prepare a compressed base64 preview for fast inline display (kept small)
        if (file && typeof file.type === 'string' && file.type.startsWith('image/')) {
            try {
                inlineImage = await encodeImageToDataUrl(file, { maxWidth: 900, maxHeight: 900, quality: 0.72, maxBytes: 350_000 });
            } catch (e) {
                console.warn('Failed to generate inlineImage preview:', e?.message || e);
            }
        }

        // Prepare complaint data
        const complaint = {
            userId: user.uid,
            title: complaintData.title.trim(),
            description: complaintData.description.trim(),
            category: complaintData.category,
            location: complaintData.location.trim(),
            priority: complaintData.priority || 'medium',
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            fileURL: null,
            storagePath: plannedStoragePath, // helps dashboard recover URL if needed
            inlineImage: inlineImage || null,
            adminNotes: null,
            assignedTo: null
        };

        // Save complaint to database FIRST (fast operation)
        const startTime = Date.now();
        const complaintsRef = ref(db, 'complaints');
        const newComplaintRef = push(complaintsRef);
        
        console.log('⏱️ Starting database write...');
        await set(newComplaintRef, complaint);
        const dbWriteTime = Date.now() - startTime;
        console.log(`✅ Database write completed in ${dbWriteTime}ms`);

        // Upload file in background if provided (non-blocking for better UX)
        console.log('🔍 Checking file parameter:', file);
        console.log('🔍 File type:', typeof file);
        console.log('🔍 File is null?', file === null);
        console.log('🔍 File is undefined?', file === undefined);
        
        if (file) {
            console.log('📤 File provided for upload:', file.name, file.size, 'bytes', 'Type:', file.type);
            console.log('📤 Starting upload for complaint (background):', newComplaintRef.key, 'path:', plannedStoragePath);
            // Fire-and-forget upload to avoid blocking navigation; errors are logged
            uploadFileAsync(newComplaintRef.key, file, user.uid, plannedStoragePath)
                .then((uploadedURL) => {
                    console.log('✅✅✅ File upload completed and saved for complaint:', newComplaintRef.key, 'URL:', uploadedURL);
                })
                .catch((error) => {
                    console.error("❌❌❌ File upload FAILED for complaint:", newComplaintRef.key);
                    console.error("❌ Error type:", error.constructor.name);
                    console.error("❌ Error message:", error.message);
                    console.error("❌ Error code:", error.code);
                    console.error("❌ Full error:", error);
                    if (error.code === 'storage/unauthorized') {
                        console.error("🔒 SOLUTION: Go to Firebase Console → Storage → Rules and allow authenticated uploads");
                    } else if (error.message.includes('network') || error.message.includes('connection')) {
                        console.error("🌐 SOLUTION: Check internet connection and Firebase Storage is enabled");
                    }
                });
        } else {
            console.log('⚠️ No file provided for complaint:', newComplaintRef.key);
            console.log('⚠️ File value:', file);
        }

        const totalTime = Date.now() - startTime;
        console.log(`⏱️ Total submission time: ${totalTime}ms`);

        return {
            success: true,
            message: "Complaint submitted successfully!",
            complaintId: newComplaintRef.key
        };
    } catch (error) {
        console.error("Error submitting complaint:", error);
        return {
            success: false,
            error: error.message || "Failed to submit complaint. Please try again."
        };
    }
}

/**
 * Upload file asynchronously and update complaint with file URL
 * @param {string} complaintId - Complaint ID
 * @param {File} file - File to upload
 * @param {string} userId - User ID
 */
async function uploadFileAsync(complaintId, file, userId, storagePathOverride = null) {
    try {
        console.log('🚀 Starting file upload for complaint:', complaintId);
        console.log('📄 File details:', {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
        });

        if (USE_CLOUDINARY) {
            console.log('☁️ Using Cloudinary unsigned upload');
            if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
                throw new Error('Cloudinary config missing. Set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET in media-config.js');
            }
            const cloudURL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
            if (CLOUDINARY_FOLDER) formData.append('folder', `${CLOUDINARY_FOLDER}/${userId}`);
            // Optional: client hints
            formData.append('context', `complaintId=${complaintId}`);

            const uploadStartTime = Date.now();
            const response = await fetch(cloudURL, { method: 'POST', body: formData });
            const uploadTime = Date.now() - uploadStartTime;
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Cloudinary upload failed: ${response.status} ${errText}`);
            }
            const data = await response.json();
            console.log(`✅ Cloudinary uploaded in ${uploadTime}ms`, data);

            const downloadURL = data.secure_url;
            const publicId = data.public_id;

            const complaintRef = ref(db, `complaints/${complaintId}`);
            await update(complaintRef, {
                fileURL: downloadURL,
                storagePath: publicId,
                provider: 'cloudinary',
                updatedAt: Date.now()
            });
            console.log('✅✅✅ Complaint updated with Cloudinary URL:', downloadURL);
            return downloadURL;
        } else {
            // Firebase Storage path
            // Verify storage is initialized
            if (!storage) {
                throw new Error('Firebase Storage is not initialized');
            }
            console.log('✅ Storage initialized:', storage.app.name);
            
            const fileExtension = file.name.split('.').pop();
            const fileName = storagePathOverride || `complaints/${userId}/${Date.now()}.${fileExtension}`;
            console.log('📁 Storage path:', fileName);
            
            const fileRef = storageRef(storage, fileName);
            console.log('📤 Starting uploadBytes...');
            
            const uploadStartTime = Date.now();
            await uploadBytes(fileRef, file, { contentType: file.type || 'application/octet-stream' });
            const uploadTime = Date.now() - uploadStartTime;
            console.log(`✅ File bytes uploaded in ${uploadTime}ms`);
            
            console.log('🔗 Getting download URL...');
            const urlStartTime = Date.now();
            const downloadURL = await getDownloadURL(fileRef);
            const urlTime = Date.now() - urlStartTime;
            console.log(`✅ Download URL obtained in ${urlTime}ms:`, downloadURL);
            
            // Update complaint with file URL
            const complaintRef = ref(db, `complaints/${complaintId}`);
            console.log('💾 Updating complaint with fileURL...');
            
            await update(complaintRef, {
                fileURL: downloadURL,
                updatedAt: Date.now()
            });
            
            console.log('✅✅✅ File upload COMPLETE! Complaint updated with fileURL:', downloadURL);
            return downloadURL; // Return URL for promise chain
        }
    } catch (fileError) {
        console.error("❌❌❌ CRITICAL: File upload FAILED!");
        console.error("❌ Error type:", fileError.constructor.name);
        console.error("❌ Error message:", fileError.message);
        console.error("❌ Error code:", fileError.code);
        console.error("❌ Error stack:", fileError.stack);
        console.error("❌ Full error object:", fileError);
        
        // Check for specific error types
        if (fileError.code === 'storage/unauthorized') {
            console.error("🔒 STORAGE RULES ERROR: Check Firebase Storage rules!");
        } else if (fileError.code === 'storage/canceled') {
            console.error("🚫 Upload was canceled");
        } else if (fileError.message.includes('network') || fileError.message.includes('connection')) {
            console.error("🌐 NETWORK ERROR: Check internet connection and Firebase Storage access");
        }
        
        // Re-throw so we can see the error in the console
        throw fileError; // This will be caught by the caller
    }
}


/**
 * Encode an image File to a compressed Data URL.
 * Attempts to respect maxBytes by iteratively lowering quality.
 * Returns a string like "data:image/jpeg;base64,..."
 */
async function encodeImageToDataUrl(file, options = {}) {
    const {
        maxWidth = 1024,
        maxHeight = 1024,
        quality = 0.8,
        maxBytes = 400_000 // ~400KB cap
    } = options;

    // Read file to Image
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    // Draw into canvas for resize/compress
    const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = dataUrl;
    });

    const ratio = Math.min(1, maxWidth / img.width, maxHeight / img.height);
    const targetW = Math.max(1, Math.floor(img.width * ratio));
    const targetH = Math.max(1, Math.floor(img.height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Prefer JPEG for better compression
    let q = quality;
    let out = canvas.toDataURL('image/jpeg', q);
    // Shrink quality until within size budget or minimum quality reached
    while (out.length * 0.75 > maxBytes && q > 0.4) {
        q -= 0.08;
        out = canvas.toDataURL('image/jpeg', q);
    }
    return out;
}
