# 🏢 Office or Home Office

**Office or Home Office** is a lightweight desktop app built with Electron and React, designed to help teams coordinate who will be working from the office or remotely.

## 📥 **Quick Install (Recommended)**

**For most users:** Download the latest release directly:

1. Go to [**Releases**](https://github.com/moisalucian/office-or-home-office/releases/latest)
2. Download `Office-or-Home-Office-v[version].zip`
3. Extract and run `Office or Home Office.exe`
4. Enjoy automatic updates! 🎉

> **Migrating from source install?** See [MIGRATION.md](MIGRATION.md) for upgrade steps.

---

## ✨ Features

- ✅ Easily indicate **if you're coming to the office tomorrow** via a popup notification
- 🔔 Set **push notification reminders** at custom times and days of the week
- 💾 Your response is saved to **Firebase**, so teammates can see who's coming in each day
- ⚙️ Optional **launch at startup**, toggleable via a checkbox in the interface
- 🖥️ Runs in the **system tray**, quietly in the background
- 🔄 **Auto-update system** - Get notified when new versions are available

---

## 🛠️ Development Setup

**Only for developers who want to build from source:**r Home Office

**Office or Home Office** is a lightweight desktop app built with Electron and React, designed to help teams coordinate who will be working from the office or remotely.

## ✨ Features

- ✅ Easily indicate **if you're coming to the office tomorrow** via a popup notification.
- 🔔 Set **push notification reminders** at custom times and days of the week.
- 💾 Your response is saved to **Firebase**, so teammates can see who’s coming in each day.
- ⚙️ Optional **launch at startup**, toggleable via a checkbox in the interface.
- 🖥️ Runs in the **system tray**, quietly in the background.

## 🛠️ Setup

Follow these steps to set up and build the app:

1. **Configure environment variables:**
   ```bash
   # Under react-ui folder ename the .env.example file to .env
   mv .env.example .env
   ```

2. **Set up Firebase configuration:**
   ```js
   // File: react-ui/src/firebase.js
   // Replace with your own Firebase config object
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_DOMAIN",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_BUCKET",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```

3. **Configure Firebase Authentication and Security Rules:**
   
   **a) Enable Anonymous Authentication:**
   - Go to Firebase Console → Authentication → Sign-in method
   - Enable "Anonymous" authentication
   
   **b) Update Database Security Rules:**
   - Go to Firebase Console → Realtime Database → Rules
   - Replace the rules with:
   ```json
   {
     "rules": {
       ".read": "auth != null",
       ".write": "auth != null"
     }
   }
   ```
   - Click "Publish" to save the rules

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Build the application:**
   ```bash
   npm run build
   ```

5. **Find your executable:**
   After building, you'll find `Office or Home Office.exe` in the `dist/win-packed/` directory.
