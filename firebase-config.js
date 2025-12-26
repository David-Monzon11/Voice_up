// frontend/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDlcuw58e6J0FJL2BG_QUZZKidK_QW8rJY",
  authDomain: "ireport-ph.firebaseapp.com",
  databaseURL: "https://ireport-ph-default-rtdb.firebaseio.com",
  projectId: "ireport-ph",
  storageBucket: "ireport-ph.firebasestorage.app",
  messagingSenderId: "386614368685",
  appId: "1:386614368685:web:731095ea49b6ca49e2e924",
  measurementId: "G-QNLMDTCS9B"
};

export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);

export { firebaseConfig };
