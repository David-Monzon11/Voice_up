// Import Firebase services from config
import { db, auth } from './firebase-config.js';
import { ref, onValue, off, update, remove } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";
import { get } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

/**
 * Get all complaints (admin only)
 * @param {Function} callback - Callback function that receives complaints array
 * @returns {Function} Unsubscribe function
 */
export function getAllComplaints(callback) {
    try {
        const complaintsRef = ref(db, 'complaints');
        
        // Listen for all complaints in real-time
        onValue(complaintsRef, (snapshot) => {
            const complaints = [];
            snapshot.forEach((childSnapshot) => {
                complaints.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            // Sort by creation date (newest first)
            complaints.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            callback(complaints);
        });
        
        // Return function to unsubscribe
        return () => off(complaintsRef);
    } catch (error) {
        console.error("Error getting all complaints:", error);
        callback([]);
        return () => {}; // Return empty unsubscribe function
    }
}

/**
 * Update complaint status (admin only)
 * @param {string} complaintId - Complaint ID
 * @param {string} newStatus - New status (pending, in_progress, resolved, rejected)
 * @param {string} adminNotes - Optional admin notes
 * @returns {Promise<Object>} Result object
 */
export async function updateComplaintStatus(complaintId, newStatus, adminNotes = null) {
    try {
        const complaintRef = ref(db, `complaints/${complaintId}`);
        
        const updates = {
            status: newStatus,
            updatedAt: Date.now()
        };
        
        if (adminNotes) {
            updates.adminNotes = adminNotes;
        }
        
        await update(complaintRef, updates);
        
        return {
            success: true,
            message: "Complaint status updated successfully"
        };
    } catch (error) {
        console.error("Error updating complaint status:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Delete complaint (admin only)
 * @param {string} complaintId - Complaint ID
 * @returns {Promise<Object>} Result object
 */
export async function deleteComplaint(complaintId) {
    try {
        const complaintRef = ref(db, `complaints/${complaintId}`);
        await remove(complaintRef);
        
        return {
            success: true,
            message: "Complaint deleted successfully"
        };
    } catch (error) {
        console.error("Error deleting complaint:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get all users (admin only)
 * @param {Function} callback - Callback function that receives users array
 * @returns {Function} Unsubscribe function
 */
export function getAllUsers(callback) {
    try {
        const usersRef = ref(db, 'users');
        
        // Listen for all users in real-time
        onValue(usersRef, (snapshot) => {
            const users = [];
            snapshot.forEach((childSnapshot) => {
                users.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            callback(users);
        });
        
        // Return function to unsubscribe
        return () => off(usersRef);
    } catch (error) {
        console.error("Error getting all users:", error);
        callback([]);
        return () => {}; // Return empty unsubscribe function
    }
}

