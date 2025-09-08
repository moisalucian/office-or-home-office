# 🏢 Office or Home Office

**Office or Home Office** is a lightweight desktop app built with Electron and React, designed to help teams coordinate who will be working from the office or remotely.

## 📥 **Quick Install (Recommended)**

**For most users:** Download the latest release directly:

1. Go to [**Releases**](https://github.com/moisalucian/office-or-home-office/releases/latest)
2. Download `Office-or-Home-Office-v[version].zip` 
3. Extract the ZIP file to any folder
4. Run `Office or Home Office.exe` from the extracted folder
5. Follow the Firebase setup wizard on first launch
6. For detailed setup instructions, see [**SETUP.md**](SETUP.md)

> **Need help setting up Firebase?** See [SETUP.md](SETUP.md) for step-by-step instructions.

---

## ✨ Features

- ✅ **Team Coordination**: See who's coming to the office tomorrow at a glance
- 🔔 **Smart Notifications**: Customizable reminders at your preferred times
- � **Real-time Sync**: Firebase integration for instant team updates
- ⚙️ **Startup Options**: Launch at startup with customizable tray behavior
- 🖥️ **System Tray**: Runs quietly in the background
- � **Auto-Updates**: Automatic update notifications and installation
- 🎨 **Themes**: Dark/Light/System theme support
- 🔊 **Notification Sounds**: Multiple sound options for alerts

---

## 🛠️ Development Setup

**Only for developers who want to build from source:**

See [**SETUP.md**](SETUP.md) - "For Developers" section for complete development setup instructions.

---

## 🚀 How It Works

1. **Set Your Status**: Choose from Office, Home, Away, Lunch, Meeting, or Vacation
2. **Team Visibility**: All team members see real-time status updates
3. **Smart Reminders**: Get notified to update your status at your preferred times
4. **Activity History**: Track team presence patterns over time

---

## � Configuration

The app uses Firebase Realtime Database for team synchronization. On first launch, you'll be prompted to configure your Firebase connection. Team admins can share configuration details with team members for easy setup.

---

## � Documentation

- [**SETUP.md**](SETUP.md) - Complete setup instructions for users and developers
- [**MIGRATION.md**](MIGRATION.md) - Migration guide for existing users

---

## 🤝 Contributing

1. Fork the repository
2. Follow the development setup in [SETUP.md](SETUP.md)
3. Create your feature branch
4. Submit a pull request

---

## 📄 License

This project is open source. See the LICENSE file for details.r Home Office

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
