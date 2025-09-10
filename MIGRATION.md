# Migration Guide: 2.0.0

## What Changed in 2.0.0?

- **Update & Restart Flow:**
  - The update mechanism is now fully detached from the CMD window. Updates are applied via a batch script and external updater.js, ensuring the app restarts cleanly and CMD windows close automatically.
  - The app always relaunches and shows the main window after an update, regardless of tray settings.
  - Legacy direct update logic has been removed for reliability.

- **Breaking Changes:**
  - If you have custom scripts or automation around the update process, review the new flow.
  - The update state file and batch script logic have changed. See CHANGELOG.md for details.

- **Other Improvements:**
  - Theme-based icons, improved notification sounds, and more robust error handling.

## How to Migrate

- **End Users:**
  - Just update to the latest version. The app will handle migration automatically.

- **Developers:**
  - Remove any custom update scripts that relied on the old direct update logic.
  - Review the new update and restart flow in `electron/main.js` and `electron/updater.js`.

---

See CHANGELOG.md for a full list of changes.
