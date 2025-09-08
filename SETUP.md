# Office or Home Office - Setup Instructions

## For End Users (Quick Setup)

### 1. Download and Extract
1. Download the latest `Office-or-Home-Office-v[version].zip` from the [Releases page](https://github.com/moisalucian/office-or-home-office/releases)
2. Extract the ZIP file to any folder on your computer
3. Navigate to the extracted folder and run `Office or Home Office.exe`

### 2. Firebase Configuration
The app requires a Firebase Realtime Database to sync status between team members.

#### Option A: Team Member Setup (Recommended)
If your team already has a Firebase project set up:
1. Get the Firebase configuration from your team admin (see format below)
2. Run the app - it will automatically show a configuration dialog on first startup
3. Paste the configuration provided by your team admin
4. Click "Save Configuration"

**Firebase Configuration Format:**
```
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com  
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdefghijklmnop
```

#### Option B: Create New Firebase Project (Team Admin)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter project name (e.g., "your-company-status")
4. Disable Google Analytics (not needed)
5. Create project

**Setting up Firebase Database:**
1. In Firebase Console, go to "Realtime Database"
2. Click "Create Database"
3. Choose your location (closest to your team)
4. Start in **test mode** for now

**Getting Firebase Configuration:**
1. In Firebase Console, go to Project Settings (gear icon)
2. Scroll down to "Your apps" section
3. Click "Add app" → Web app (</>) 
4. Give it a name (e.g., "Office Status App")
5. Copy the config values and share them with your team in the format shown above

### 3. Security Rules (Important for Team Admins!)
For team usage, update your Firebase Realtime Database rules:

```json
{
  "rules": {
    "statuses": {
      ".read": true,
      ".write": true
    }
  }
}
```

**Note:** These rules allow anyone with the database URL to read/write. For production use, implement proper authentication rules.

### 4. Changing Configuration Later
- Open the app and go to Settings (gear icon)
- Click "Firebase Configuration" 
- Edit your configuration as needed
- Click "Save Configuration"

---

## For Developers

### Prerequisites
- Node.js 18+ 
- Git
- Firebase account

### 1. Clone and Install
```bash
git clone https://github.com/moisalucian/office-or-home-office.git
cd office-or-home-office
npm install
cd react-ui
npm install
```

### 2. Firebase Setup
1. Create a Firebase project (see user instructions above)
2. Copy `react-ui/.env.example` to `react-ui/.env`
3. Fill in your Firebase configuration in `react-ui/.env`:

```bash
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdefghijklmnop
```

### 3. Development
```bash
# Start development server (both React and Electron)
npm start

# Build for production
npm run build-react    # Build React UI
npm run copy-react     # Copy to electron folder  
npm run build          # Build Electron app
```

### 4. Building Releases
```bash
# Build everything
npm run build-react && npm run copy-react && npx electron-builder

# The output will be in the dist/ folder
```

---

## Firebase Database Structure

The app uses this simple structure:
```json
{
  "statuses": {
    "UserName": {
      "status": "office|home|away|lunch|meeting|vacation",
      "timestamp": 1634567890123,
      "name": "UserName"
    }
  }
}
```

---

## Troubleshooting

### App won't start / Firebase errors
- Check your Firebase configuration in the `.env` file
- Verify your Firebase project has Realtime Database enabled
- Make sure your database rules allow read/write access

### Build issues
- Make sure you have Node.js 18+ installed
- Delete `node_modules` and run `npm install` again
- Check that you've run `npm install` in both root and `react-ui` folders

### Performance issues
- The app runs in the system tray - check your tray area
- If Windows takes long to restart, try closing the app manually before restarting

---

## Support

For issues, questions, or feature requests, please create an issue on the [GitHub repository](https://github.com/moisalucian/office-or-home-office/issues).
