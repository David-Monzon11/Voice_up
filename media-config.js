// Cloudinary media configuration (free tier alternative to Firebase Storage)
// 1) Create a Cloudinary account (free)
// 2) In Cloudinary Console → Settings → Upload → Upload presets → Add unsigned preset
// 3) Put your cloud name and the unsigned preset name below

export const USE_CLOUDINARY = true; // set to true to enable Cloudinary uploads

// REQUIRED: replace with your actual Cloudinary cloud name (from Dashboard)
export const CLOUDINARY_CLOUD_NAME = "YOUR_CLOUD_NAME";

// REQUIRED: replace with your unsigned upload preset name
export const CLOUDINARY_UPLOAD_PRESET = "YOUR_UNSIGNED_PRESET";

// Optional: folder to organize uploads
export const CLOUDINARY_FOLDER = "ireportph/complaints";

// Note:
// - With unsigned uploads, anyone using your site can upload to your account. Keep preset restricted:
//   • Signing mode: Unsigned
//   • Allowed formats: images/videos you accept (e.g., jpg, png, mp4)
//   • Maximum file size: e.g., 10 MB
//   • Folder: set to CLOUDINARY_FOLDER above, or override in code


