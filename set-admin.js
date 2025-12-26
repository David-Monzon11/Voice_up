// Utility script to set a user as admin
// Usage: This can be run in browser console after logging in, or integrated into admin panel

import { auth, db } from 'firebase-config.js';
import { ref, set, get } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

/**
 * Set a user as admin by their email or user ID
 * WARNING: This should only be run by a trusted administrator
 * 
 * @param {string} identifier - User email or user ID
 * @param {boolean} isEmail - True if identifier is an email, false if it's a user ID
 * @returns {Promise<Object>} Result object
 */
export async function setAdminByEmailOrId(identifier, isEmail = true) {
    try {
        let userId = identifier;
        
        // If identifier is an email, we need to find the user ID
        if (isEmail) {
            // Search for user by email in database
            const usersRef = ref(db, 'users');
            const snapshot = await get(usersRef);
            
            if (snapshot.exists()) {
                const users = snapshot.val();
                let found = false;
                
                // Search through all users
                for (const [uid, userData] of Object.entries(users)) {
                    if (userData.email === identifier) {
                        userId = uid;
                        found = true;
                        break;
                    }
                }
                
                if (!found) {
                    return {
                        success: false,
                        error: `User with email ${identifier} not found in database`
                    };
                }
            } else {
                return {
                    success: false,
                    error: "No users found in database"
                };
            }
        }
        
        // Update user role to admin
        const userRef = ref(db, `users/${userId}`);
        const userSnapshot = await get(userRef);
        
        if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            await set(userRef, {
                ...userData,
                role: 'admin',
                updatedAt: Date.now(),
                adminSetAt: Date.now()
            });
            
            return {
                success: true,
                message: `User ${userData.email || userId} has been set as admin`,
                userId: userId
            };
        } else {
            return {
                success: false,
                error: `User with ID ${userId} not found`
            };
        }
    } catch (error) {
        console.error("Error setting admin:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Set current logged-in user as admin
 * @returns {Promise<Object>} Result object
 */
export async function setCurrentUserAsAdmin() {
    try {
        const user = auth.currentUser;
        if (!user) {
            return {
                success: false,
                error: "No user is currently logged in"
            };
        }
        
        const userId = user.uid;
        const userRef = ref(db, `users/${userId}`);
        const userSnapshot = await get(userRef);
        
        if (userSnapshot.exists()) {
            // User exists, update role to admin
            const userData = userSnapshot.val();
            await set(userRef, {
                ...userData,
                role: 'admin',
                updatedAt: Date.now(),
                adminSetAt: Date.now()
            });
            
            return {
                success: true,
                message: `User ${userData.email || user.email || userId} has been set as admin`,
                userId: userId
            };
        } else {
            // User doesn't exist in database, create new admin user
            await set(userRef, {
                uid: userId,
                email: user.email || '',
                displayName: user.displayName || '',
                photoURL: user.photoURL || '',
                provider: 'google',
                role: 'admin',
                createdAt: Date.now(),
                lastLogin: Date.now(),
                adminSetAt: Date.now()
            });
            
            return {
                success: true,
                message: `Admin account created for ${user.email || userId}`,
                userId: userId
            };
        }
    } catch (error) {
        console.error("Error setting current user as admin:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Make functions available globally for browser console use
if (typeof window !== 'undefined') {
    window.setAdminByEmailOrId = setAdminByEmailOrId;
    window.setCurrentUserAsAdmin = setCurrentUserAsAdmin;
}

