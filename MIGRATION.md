# 🔄 Migration Guide: From Source Install to Official Releases

## For Users Who Installed Before v1.0.0

If you previously installed this app by cloning the repository and running `npm install` + `npm start`, you need to migrate to the official release system to get automatic updates.

### 📋 **Migration Steps:**

1. **🛑 Stop the current app** (close it completely)

2. **📥 Download Official v1.0.1:**
   - Go to: https://github.com/moisalucian/office-or-home-office/releases/latest
   - Download `Office-or-Home-Office-v1.0.1.zip`
   - Extract it to a new folder (e.g., `C:\Programs\OfficeOrHome\`)

3. **📋 Transfer Settings (Optional):**
   - If you want to keep your settings, copy the settings file:
   - **From:** `%APPDATA%\office-or-homeoffice\` 
   - **To:** `%APPDATA%\Office or Home Office\`

4. **🚀 Run the Official App:**
   - Run `Office or Home Office.exe` from the extracted folder
   - The app will now auto-update from v1.0.1 → v1.0.2+ automatically!

5. **🗑️ Clean Up (Optional):**
   - Delete the old cloned repository folder
   - Remove any old shortcuts

### 🎯 **Why This Migration is Needed:**

- **Before v1.0.0:** You ran from source code (`npm start`)
- **From v1.0.1+:** You run compiled executables with auto-update
- The auto-update system only works with official releases, not source installs

### ✅ **Benefits After Migration:**

- **Automatic updates** - No more `git pull` + `npm install`
- **Proper Windows executable** with custom icon
- **Better performance** - Compiled vs dev server
- **Professional installation experience**
- **Auto-notifications** when new versions are available

### 🔧 **Troubleshooting:**

- **Can't find settings?** Don't worry, you can reconfigure the app quickly
- **Old shortcuts not working?** Create new ones pointing to the new `.exe` file
- **Multiple versions running?** Make sure to close the old source version first

---

**After migration, you'll get automatic update notifications and never need to manually update again!** 🎉
