// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

let app = null;
let database = null;
let auth = null;
let isInitialized = false;

// Firebase initialization function
export const initializeFirebase = async (customConfig = null) => {
  if (isInitialized && !customConfig) {
    return { app, database, auth };
  }

  let firebaseConfig = customConfig;

  // If no custom config provided, try to get from electron store or environment
  if (!firebaseConfig) {
    // Try to get config from electron store first (for built app)
    if (window.electronAPI && window.electronAPI.getFirebaseConfig) {
      try {
        firebaseConfig = await window.electronAPI.getFirebaseConfig();
      } catch (error) {
        console.log('No stored Firebase config found, using environment variables');
      }
    }

    // Fallback to environment variables (for development)
    if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
      firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
      };
    }
  }

  // Check if Firebase configuration is complete
  const isFirebaseConfigured = Object.values(firebaseConfig).filter(value => 
    value && value !== 'undefined' && !value.toString().includes('your_')
  ).length >= 7; // At least 7 required fields

  if (!isFirebaseConfigured) {
    console.error('Firebase configuration is incomplete.');
    throw new Error('FIREBASE_CONFIG_MISSING');
  }

  try {
    // If reinitializing, we don't need to recreate
    if (app && customConfig) {
      // For reinitialization with new config, we'll need to handle this differently
      console.log('Reinitializing Firebase with new config');
    }
    
    // Initialize Firebase
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
    auth = getAuth(app);
    
    isInitialized = true;
    
    return { app, database, auth };
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    throw error;
  }
};

// Export functions to get instances (will throw if not initialized)
export const getFirebaseApp = () => {
  if (!app) throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  return app;
};

export const getFirebaseDatabase = () => {
  if (!database) throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  return database;
};

export const getFirebaseAuth = () => {
  if (!auth) throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  return auth;
};

export const isFirebaseInitialized = () => isInitialized;

// Legacy exports for compatibility (will be deprecated)
export { database, auth };
