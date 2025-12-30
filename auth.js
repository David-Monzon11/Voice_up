// Import Firebase services from config
import { auth, db } from './firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { ref, set, get } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// Force account picker to show (allows users to choose different accounts)
// This ensures users can always select which account to use
googleProvider.setCustomParameters({
    prompt: 'select_account',
    login_hint: '' // Clear any cached login hint
});

/**
 * Sign in with Google
 * @param {boolean} forceAccountSelection - Force account picker to show
 * @returns {Promise<Object>} User object with user data
 */
export async function signInWithGoogle(forceAccountSelection = true) {
    try {
        // Create a fresh provider instance to ensure account picker shows
        const provider = new GoogleAuthProvider();
        
        // Force account picker to show
        if (forceAccountSelection) {
            provider.setCustomParameters({
                prompt: 'select_account'
            });
        }
        
        // Sign in with Google popup
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Save user data to Realtime Database
        await saveUserToDatabase(user);
        
        // Wait a moment for database to save
        await new Promise(resolve => setTimeout(resolve, 300));
        
        return {
            success: true,
            user: user,
            message: "Successfully signed in with Google"
        };
    } catch (error) {
        console.error("Google sign-in error:", error);
        
        // If user cancelled, return a specific error
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
            return {
                success: false,
                error: "Sign in cancelled",
                code: error.code
            };
        }
        
        return {
            success: false,
            error: error.message,
            code: error.code
        };
    }
}

/**
 * Save user data to Realtime Database
 * @param {Object} user - Firebase user object
 */
async function saveUserToDatabase(user) {
    try {
        const userRef = ref(db, `users/${user.uid}`);
        
        // Check if user already exists
        const snapshot = await get(userRef);
        
        if (!snapshot.exists()) {
            // User doesn't exist, create new user record
            await set(userRef, {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || '',
                photoURL: user.photoURL || '',
                provider: 'google',
                createdAt: Date.now(),
                lastLogin: Date.now(),
                role: 'user' // Default role, can be changed by admin
            });
            console.log("New user created in database");
        } else {
            // User exists, update last login time
            const userData = snapshot.val();
            await set(userRef, {
                ...userData,
                lastLogin: Date.now(),
                email: user.email,
                displayName: user.displayName || userData.displayName,
                photoURL: user.photoURL || userData.photoURL
            });
            console.log("User login time updated");
        }
    } catch (error) {
        console.error("Error saving user to database:", error);
        // Don't throw - let auth succeed even if DB write fails
        // The error will be logged but won't break the authentication flow
        // This prevents database issues from blocking authentication
    }
}

/**
 * Sign out current user
 * @returns {Promise<Object>} Result object
 */
export async function logoutUser() {
    try {
        await signOut(auth);
        return {
            success: true,
            message: "Successfully signed out"
        };
    } catch (error) {
        console.error("Logout error:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get current authenticated user
 * @returns {Object|null} Current user object or null
 */
export function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Listen to authentication state changes
 * @param {Function} callback - Callback function that receives user object
 * @returns {Function} Unsubscribe function
 */
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, (user) => {
        callback(user);
    });
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if user is authenticated
 */
export function isAuthenticated() {
    return auth.currentUser !== null;
}

/**
 * Get user data from database
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User data from database
 */
export async function getUserData(userId) {
    try {
        const userRef = ref(db, `users/${userId}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            return {
                success: true,
                data: snapshot.val()
            };
        } else {
            return {
                success: false,
                error: "User not found"
            };
        }
    } catch (error) {
        console.error("Error getting user data:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Update user profile (displayName/username)
 * @param {string} userId - User ID
 * @param {Object} updates - Object with fields to update (displayName, etc.)
 * @returns {Promise<Object>} Result object
 */
export async function updateUserProfile(userId, updates) {
    try {
        const user = auth.currentUser;
        if (!user || user.uid !== userId) {
            return {
                success: false,
                error: "Unauthorized: You can only update your own profile"
            };
        }

        const userRef = ref(db, `users/${userId}`);
        const snapshot = await get(userRef);
        
        if (!snapshot.exists()) {
            return {
                success: false,
                error: "User not found"
            };
        }

        const userData = snapshot.val();
        const updatedData = {
            ...userData,
            ...updates,
            updatedAt: Date.now()
        };

        await set(userRef, updatedData);

        // Update Firebase Auth displayName if provided
        if (updates.displayName && user.updateProfile) {
            try {
                await user.updateProfile({
                    displayName: updates.displayName
                });
            } catch (authError) {
                console.warn("Could not update Firebase Auth displayName:", authError);
                // Continue even if Auth update fails - DB update succeeded
            }
        }

        return {
            success: true,
            message: "Profile updated successfully",
            data: updatedData
        };
    } catch (error) {
        console.error("Error updating user profile:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Sign in with Google for Admin
 * @param {boolean} forceAccountSelection - Force account picker to show
 * @returns {Promise<Object>} User object with user data and role
 */
export async function signInWithGoogleAdmin(forceAccountSelection = true) {
    try {
        // Create a fresh provider instance to ensure account picker shows
        const provider = new GoogleAuthProvider();
        
        // Force account picker to show
        if (forceAccountSelection) {
            provider.setCustomParameters({
                prompt: 'select_account'
            });
        }
        
        // Sign in with Google popup
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Try to save user data to Realtime Database (don't fail if this fails)
        try {
            await saveUserToDatabase(user);
            // Wait a moment for database to save
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (dbError) {
            console.warn("Database save failed (non-critical):", dbError);
            // Continue even if database save fails - auth was successful
        }
        
        // Get user data to check role (with retry)
        let userDataResult = await getUserData(user.uid);
        
        // Retry once if first attempt fails (database might still be syncing)
        if (!userDataResult.success) {
            await new Promise(resolve => setTimeout(resolve, 500));
            userDataResult = await getUserData(user.uid);
        }
        
        if (userDataResult.success) {
            const userData = userDataResult.data;
            const isAdmin = userData.role === 'admin';
            
            return {
                success: true,
                user: user,
                userData: userData,
                isAdmin: isAdmin,
                message: isAdmin ? "Admin signed in successfully" : "User signed in successfully"
            };
        }
        
        return {
            success: true,
            user: user,
            isAdmin: false,
            message: "Successfully signed in with Google"
        };
    } catch (error) {
        console.error("Google admin sign-in error:", error);
        
        // Handle specific error codes
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
            return {
                success: false,
                error: "Sign in cancelled",
                code: error.code
            };
        }
        
        if (error.code === 'auth/popup-blocked') {
            return {
                success: false,
                error: "Popup was blocked. Please allow popups for this site and try again.",
                code: error.code
            };
        }
        
        if (error.code === 'auth/network-request-failed') {
            return {
                success: false,
                error: "Network error. Please check your internet connection and try again.",
                code: error.code
            };
        }
        
        if (error.code === 'auth/internal-error') {
            return {
                success: false,
                error: "Authentication service error. Please try again in a moment. If the problem persists, check your Firebase project settings.",
                code: error.code
            };
        }
        
        // Generic error message
        return {
            success: false,
            error: error.message || "An unexpected error occurred. Please try again.",
            code: error.code || 'unknown'
        };
    }
}

/**
 * Check if current user is admin
 * @returns {Promise<boolean>} True if user is admin
 */
export async function isAdmin() {
    try {
        const user = auth.currentUser;
        if (!user) {
            return false;
        }
        
        const userDataResult = await getUserData(user.uid);
        if (userDataResult.success) {
            return userDataResult.data.role === 'admin';
        }
        return false;
    } catch (error) {
        console.error("Error checking admin status:", error);
        return false;
    }
}

/**
 * Check if user is admin by userId
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} True if user is admin
 */
export async function isUserAdmin(userId) {
    try {
        const userDataResult = await getUserData(userId);
        if (userDataResult.success) {
            return userDataResult.data.role === 'admin';
        }
        return false;
    } catch (error) {
        console.error("Error checking admin status:", error);
        return false;
    }
}

/**
 * Get current user's role
 * @returns {Promise<string>} User role ('admin' or 'user')
 */
export async function getUserRole() {
    try {
        const user = auth.currentUser;
        if (!user) {
            return null;
        }
        
        const userDataResult = await getUserData(user.uid);
        if (userDataResult.success) {
            return userDataResult.data.role || 'user';
        }
        return 'user';
    } catch (error) {
        console.error("Error getting user role:", error);
        return 'user';
    }
}

/**
 * Set user role (admin only function)
 * @param {string} userId - User ID to update
 * @param {string} role - Role to set ('admin' or 'user')
 * @returns {Promise<Object>} Result object
 */
export async function setUserRole(userId, role) {
    try {
        // Check if current user is admin
        const currentUserIsAdmin = await isAdmin();
        if (!currentUserIsAdmin) {
            return {
                success: false,
                error: "Only admins can set user roles"
            };
        }
        
        // Validate role
        if (role !== 'admin' && role !== 'user') {
            return {
                success: false,
                error: "Invalid role. Must be 'admin' or 'user'"
            };
        }
        
        const userRef = ref(db, `users/${userId}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            const userData = snapshot.val();
            await set(userRef, {
                ...userData,
                role: role,
                updatedAt: Date.now()
            });
            
            return {
                success: true,
                message: `User role updated to ${role}`
            };
        } else {
            return {
                success: false,
                error: "User not found"
            };
        }
    } catch (error) {
        console.error("Error setting user role:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

