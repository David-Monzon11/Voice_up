// Import Firebase services from config
import { db, auth } from './firebase-config.js';
import { ref, query, orderByChild, equalTo, onValue, off, get, remove } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

/**
 * Get all complaints for the current user
 * @param {Function} callback - Callback function that receives complaints array
 * @returns {Function} Unsubscribe function
 */
export function getUserComplaints(callback) {
    try {
        const userId = auth.currentUser.uid;
        const complaintsRef = ref(db, 'complaints');
        
        // Query complaints by user ID
        const userComplaintsQuery = query(
            complaintsRef,
            orderByChild('userId'),
            equalTo(userId)
        );
        
        // Listen for real-time updates
        onValue(userComplaintsQuery, (snapshot) => {
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
        return () => off(userComplaintsQuery);
    } catch (error) {
        console.error("Error getting user complaints:", error);
        callback([]);
        return () => {}; // Return empty unsubscribe function
    }
}

/**
 * Get complaint by ID
 * @param {string} complaintId - Complaint ID
 * @returns {Promise<Object>} Complaint data
 */
export async function getComplaintById(complaintId) {
    try {
        const complaintRef = ref(db, `complaints/${complaintId}`);
        const snapshot = await get(complaintRef);
        
        if (snapshot.exists()) {
            return {
                success: true,
                data: {
                    id: snapshot.key,
                    ...snapshot.val()
                }
            };
        } else {
            return {
                success: false,
                error: "Complaint not found"
            };
        }
    } catch (error) {
        console.error("Error getting complaint:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Delete complaint (user can only delete their own complaints)
 * @param {string} complaintId - Complaint ID
 * @returns {Promise<Object>} Result object
 */
export async function deleteComplaint(complaintId) {
    try {
        const user = auth.currentUser;
        if (!user) {
            return {
                success: false,
                error: "You must be logged in to delete a complaint"
            };
        }

        // Verify the complaint belongs to the user
        const complaintRef = ref(db, `complaints/${complaintId}`);
        const snapshot = await get(complaintRef);
        
        if (!snapshot.exists()) {
            return {
                success: false,
                error: "Complaint not found"
            };
        }

        const complaintData = snapshot.val();
        if (complaintData.userId !== user.uid) {
            return {
                success: false,
                error: "You can only delete your own complaints"
            };
        }

        // Delete the complaint
        await remove(complaintRef);
        
        return {
            success: true,
            message: "Complaint deleted successfully"
        };
    } catch (error) {
        console.error("Error deleting complaint:", error);
        return {
            success: false,
            error: error.message || "Failed to delete complaint"
        };
    }
}

