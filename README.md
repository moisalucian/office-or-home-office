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
- 🔥 **Real-time Sync**: Firebase integration for instant team updates
- ⚙️ **Startup Options**: Launch at startup with customizable tray behavior
- 🖥️ **System Tray**: Runs quietly in the background
- 🔄 **Auto-Updates**: Automatic update notifications and installation
- 🎨 **Themes**: Dark/Light/System theme support
- 🔊 **Notification Sounds**: Multiple sound options for alerts (default: Three Note Doorbell)

---

## 🛠️ Development Setup

**Only for developers who want to build from source:**

See [**SETUP.md**](SETUP.md) - "For Developers" section for complete development setup instructions.

---

## 🚀 How It Works

1. **First Launch**: Configure Firebase connection through the built-in setup wizard
2. **Set Your Status**: Choose from Office, Home, Away, Lunch, Meeting, or Vacation
3. **Team Visibility**: All team members see real-time status updates
4. **Smart Reminders**: Get notified to update your status at your preferred times (default: Three Note Doorbell sound)
5. **Activity History**: Track team presence patterns over time

---

## 🔧 Configuration

The app uses Firebase Realtime Database for team synchronization. On first launch, you'll see a Firebase configuration dialog where you can enter your team's Firebase settings. The configuration is stored securely in your app's user data directory.

**Key Features:**
- **Smart Configuration UI**: Easy-to-use dialog with change tracking
- **No Manual File Editing**: All configuration is handled through the interface
- **Secure Storage**: Configuration stored in your system's user data directory
- **Team Sharing**: Team admins can easily share configuration details with team members

---

## 📚 Documentation

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

This project is open source. See the LICENSE file for details.
