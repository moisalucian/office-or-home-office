# 🏢 Office or Home Office

**Office or Home Office** is a lightweight desktop app built with Electron and React, designed to help teams coordinate who will be working from the office or remotely.

## ✨ Features

- ✅ Easily indicate **if you're coming to the office tomorrow** via a popup notification.
- 🔔 Set **push notification reminders** at custom times and days of the week.
- 💾 Your response is saved to **Firebase**, so teammates can see who’s coming in each day.
- ⚙️ Optional **launch at startup**, toggleable via a checkbox in the interface.
- 🖥️ Runs in the **system tray**, quietly in the background.

## 🛠️ Setup

Before building the app, make sure to configure Firebase:

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
