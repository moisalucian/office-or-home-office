# Changelog

## 2.0.0 (2025-09-10)

### Major Breaking Changes
- Completely overhauled update and restart mechanism for reliability and seamless user experience
- Batch script and updater.js logic now fully detached from CMD window (no more persistent CMD)
- App always relaunches and shows window after update, regardless of tray settings
- Removed legacy direct update logic and simplified update flow
- Added Firebase setup dialog and ability to edit Firebase config from Settings
- Introduced basic authentication layer for Firebase operations (not visible to user, but required for backend)

### New Features & Enhancements
- Activity Log window that stores up to 7 days of activity
- Theme-based icon system with dynamic switching (light/dark/system)
- Window state-based icon sizing (windowed/maximized)
- Improved notification sound selection and theme support
- More robust error handling and update logging
- Improved tray and startup logic
- Full English support for the entire app
- New Settings panel with options to change:
	- Notification sound
	- Theme selection (Dark/Light/Windows)
	- Default launch option (windowed/maximized)
	- Launch at startup / Launch in tray
	- Edit Firebase Config

### Bug Fixes
- Fixed persistent CMD window after update (now closes automatically)
- Fixed app not relaunching after update in some scenarios
- Fixed update state and notification bugs
- Fixed issues with app icon not displaying correctly in some cases

### Cleanup
- Removed obsolete temp files and legacy update code
- General codebase cleanup and documentation improvements

---

See README.md and SETUP.md for full usage and setup instructions.
