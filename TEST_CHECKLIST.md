# Test Checklist for Version 1.0.220

## Primary Issues Fixed

### 1. Windows Restart Hanging Issue ✅
- **Test**: Start the app, then restart Windows
- **Expected**: Windows should restart quickly without hanging
- **Technical**: Added proper shutdown event handlers in main.js

### 2. Firebase Configuration UI 📋
- **Test**: Open the app for the first time (no Firebase config)
- **Expected**: Should show Firebase configuration dialog
- **Test Steps**:
  1. App should show loading screen briefly
  2. Then show Firebase config dialog with fields:
     - API Key
     - Auth Domain  
     - Database URL
     - Project ID
     - Storage Bucket
     - Messaging Sender ID
     - App ID
  3. Try bulk paste functionality with Firebase config object
  4. Save configuration
  5. App should continue to main interface

### 3. Settings Firebase Config Edit 📋
- **Test**: After Firebase is configured, go to Settings → Edit Firebase Config
- **Expected**: Should open Firebase config dialog without crashing
- **Previous Issue**: App used to crash/disappear when clicking this button

## Additional Testing

### App Startup Flow
1. **Cold Start**: Launch app when no config exists
2. **Normal Start**: Launch app with existing Firebase config
3. **Settings Access**: Test opening/closing settings
4. **Tray Functionality**: Test minimize to tray and restore

### Firebase Integration
1. **Config Validation**: Try invalid Firebase configs
2. **Database Connection**: Verify Firebase connects after config
3. **Error Handling**: Test with invalid credentials

### Window Management
1. **Minimize/Maximize**: Test window controls
2. **Close to Tray**: Test close behavior
3. **System Tray**: Test tray icon and right-click menu

## Files Changed

- `electron/main.js`: Added shutdown event handlers
- `react-ui/src/firebase.js`: Runtime Firebase configuration
- `react-ui/src/App.jsx`: Firebase config dialog integration
- `react-ui/src/components/FirebaseConfig.jsx`: New config component
- `react-ui/src/components/FirebaseConfig.css`: Config dialog styles
- `react-ui/src/components/Settings.css`: Firebase config button styles

## Critical Test: Firebase Config Dialog

**Most Important Test**: 
1. Open Settings
2. Click "Edit Firebase Config" 
3. **Verify app doesn't crash/disappear**
4. **Verify dialog opens properly**
5. Test saving new configuration
6. Verify app continues working

This was the main issue you reported - the app crashing when clicking the Firebase config button.
