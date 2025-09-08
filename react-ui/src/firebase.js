// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

let app = null;
let database = null;
let auth = null;
let isInitialized = false;

// Try to initialize Firebase immediately with env variables (for backward compatibility)
const envConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Check if env config is complete (for development)
const isEnvConfigComplete = Object.values(envConfig).filter(value => 
  value && value !== 'undefined' && !value.toString().includes('your_')
).length >= 7;

// Initialize immediately if env config is available
if (isEnvConfigComplete) {
  try {
    app = initializeApp(envConfig);
    database = getDatabase(app);
    auth = getAuth(app);
    isInitialized = true;
    console.log('Firebase initialized with environment variables');
  } catch (error) {
    console.error('Failed to initialize Firebase with env config:', error);
  }
}

// Firebase initialization function for runtime config
export const initializeFirebase = async (customConfig = null) => {
  if (isInitialized && !customConfig) {
    return { app, database, auth };
  }

  let firebaseConfig = customConfig;

  // If no custom config provided, try to get from electron store
  if (!firebaseConfig && window.electronAPI && window.electronAPI.getFirebaseConfig) {
    try {
      firebaseConfig = await window.electronAPI.getFirebaseConfig();
      console.log('Loaded Firebase config from storage');
    } catch (error) {
      console.log('No stored Firebase config found');
    }
  }

  // If still no config, we can't initialize
  if (!firebaseConfig) {
    throw new Error('FIREBASE_CONFIG_MISSING');
  }

  // Check if Firebase configuration is complete
  const isFirebaseConfigured = Object.values(firebaseConfig).filter(value => 
    value && value !== 'undefined' && !value.toString().includes('your_')
  ).length >= 7;

  if (!isFirebaseConfigured) {
    console.error('Firebase configuration is incomplete.');
    throw new Error('FIREBASE_CONFIG_MISSING');
  }

  try {
    // If reinitializing with new config
    if (app && customConfig) {
      console.log('Reinitializing Firebase with new config');
    }
    
    // Initialize Firebase
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
    auth = getAuth(app);
    
    isInitialized = true;
    console.log('Firebase initialized successfully');
    
    return { app, database, auth };
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    throw error;
  }
};

// Save Firebase configuration
export const saveFirebaseConfig = async (config) => {
  if (window.electronAPI && window.electronAPI.saveFirebaseConfig) {
    try {
      const result = await window.electronAPI.saveFirebaseConfig(config);
      if (result.success) {
        // Reinitialize Firebase with new config
        await initializeFirebase(config);
        return true;
      }
    } catch (error) {
      console.error('Failed to save Firebase config:', error);
    }
  }
  return false;
};

// Get current Firebase configuration
export const getFirebaseConfig = async () => {
  if (window.electronAPI && window.electronAPI.getFirebaseConfig) {
    try {
      return await window.electronAPI.getFirebaseConfig();
    } catch (error) {
      console.error('Failed to get Firebase config:', error);
    }
  }
  return null;
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

// Direct exports for backward compatibility (may be null if not initialized)
export { database, auth };
