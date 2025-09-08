import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseInitialized } from './firebase.js';

// Global authentication state
let isAuthenticated = false;
let authPromise = null;

// Initialize anonymous authentication
export const initializeAuth = () => {
  // Return existing promise if already in progress
  if (authPromise) {
    return authPromise;
  }

  // Check if Firebase is initialized
  if (!isFirebaseInitialized()) {
    return Promise.reject(new Error('Firebase not initialized'));
  }

  const auth = getFirebaseAuth();

  authPromise = new Promise((resolve, reject) => {
    // Check if user is already signed in
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe(); // Stop listening after first check
      
      if (user) {
        // User is already signed in
        isAuthenticated = true;
        console.log('User already authenticated:', user.uid);
        resolve(user);
      } else {
        // User is not signed in, sign in anonymously
        try {
          console.log('Signing in anonymously...');
          const userCredential = await signInAnonymously(auth);
          isAuthenticated = true;
          console.log('Anonymous sign-in successful:', userCredential.user.uid);
          resolve(userCredential.user);
        } catch (error) {
          console.error('Anonymous sign-in failed:', error);
          isAuthenticated = false;
          reject(error);
        }
      }
    });
  });

  return authPromise;
};

// Check if user is authenticated
export const getAuthStatus = () => {
  return isAuthenticated;
};

// Get current user
export const getCurrentUser = () => {
  if (!isFirebaseInitialized()) {
    return null;
  }
  const auth = getFirebaseAuth();
  return auth.currentUser;
};

// Wait for authentication to complete
export const waitForAuth = () => {
  if (authPromise) {
    return authPromise;
  }
  return initializeAuth();
};
