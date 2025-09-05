#!/usr/bin/env node

/**
 * External Updater Script
 * 
 * This script runs OUTSIDE the main Electron process to avoid file lock issues.
 * It applies staged updates and then launches the updated app.
 */


const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// Logging to %TEMP%\update-log.txt
const logFile = path.join(os.tmpdir(), 'update-log.txt');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  try {
    fs.appendFileSync(logFile, line + '\n');
  } catch (err) {
    console.error('Failed to write to update-log.txt:', err);
  }
  console.log(line);
}

try {
  log('[Updater] External updater started');
} catch (err) {
  console.error('Failed to log updater start:', err);
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

async function applyStagedUpdate() {
  try {
    // Get the app data path (same logic as main app)
    const appDataPath = process.env.APPDATA || 
                       (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : 
                        process.env.HOME + "/.local/share");
    const userDataPath = path.join(appDataPath, 'office-or-homeoffice');
    const stagedUpdateFile = path.join(userDataPath, 'staged-update.json');
    const updaterInfoFile = path.join(userDataPath, 'updater-info.json');
    
    let stagedUpdateInfo = null;
    
    // Check for updater-info.json first (new format), then staged-update.json (old format)
    if (fs.existsSync(updaterInfoFile)) {
      log('[Updater] Reading updater info from updater-info.json');
      stagedUpdateInfo = JSON.parse(fs.readFileSync(updaterInfoFile, 'utf8'));
    } else if (fs.existsSync(stagedUpdateFile)) {
      log('[Updater] Reading staged update info from staged-update.json');
      stagedUpdateInfo = JSON.parse(fs.readFileSync(stagedUpdateFile, 'utf8'));
    } else {
      log('[Updater] No staged update or updater info found');
      return false;
    }
    
    const extractPath = stagedUpdateInfo.extractPath;
    
    if (!fs.existsSync(extractPath)) {
      log('[Updater] Staged update path does not exist: ' + extractPath);
      // Clean up both possible files
      try { if (fs.existsSync(stagedUpdateFile)) fs.unlinkSync(stagedUpdateFile); } catch (e) {}
      try { if (fs.existsSync(updaterInfoFile)) fs.unlinkSync(updaterInfoFile); } catch (e) {}
      return false;
    }
    
    log('[Updater] Applying staged update for version: ' + stagedUpdateInfo.version);
    
    // Use appPath from updater info if available, otherwise determine it
    let appPath = stagedUpdateInfo.appPath;
    if (!appPath) {
      if (process.pkg) {
        // Running as packaged executable - get directory containing the exe
        appPath = path.dirname(process.execPath);
      } else {
        // Running as Node script - get the project root
        appPath = path.resolve(__dirname, '..');
      }
    }
    
    log('[Updater] App path: ' + appPath);
    
    const resourcesSrc = path.join(extractPath, 'resources');
    const resourcesDest = path.join(appPath, 'resources');
    const localesSrc = path.join(extractPath, 'locales');
    const localesDest = path.join(appPath, 'locales');
    
    // Special handling for app.package -> app.asar
    const appPackagePath = path.join(resourcesSrc, 'app.package');
    const appAsarPath = path.join(resourcesDest, 'app.asar');
    const appAsarBackupPath = path.join(resourcesDest, 'app.asar.backup');
    
    if (fs.existsSync(appPackagePath)) {
    log('[Updater] Updating app.asar...');
      
      // Ensure destination directory exists
      if (!fs.existsSync(resourcesDest)) {
        fs.mkdirSync(resourcesDest, { recursive: true });
      }
      
      // Remove any existing backup
      try {
        if (fs.existsSync(appAsarBackupPath)) {
          fs.unlinkSync(appAsarBackupPath);
        }
      } catch (e) {
  log('[Updater] Could not remove old backup: ' + e.message);
      }
      
      // Rename current app.asar to backup (this releases the file lock)
      if (fs.existsSync(appAsarPath)) {
        try {
          fs.renameSync(appAsarPath, appAsarBackupPath);
          log('[Updater] Old app.asar renamed to backup');
        } catch (renameError) {
          log('[Updater] Failed to rename old app.asar: ' + renameError);
        }
      }
      
      // Copy new app.package as app.asar
      fs.copyFileSync(appPackagePath, appAsarPath);
  log('[Updater] New app.asar copied successfully');
      
      // Clean up backup file
      try {
        if (fs.existsSync(appAsarBackupPath)) {
          fs.unlinkSync(appAsarBackupPath);
          log('[Updater] Backup app.asar removed');
        }
      } catch (e) {
  log('[Updater] Could not remove backup: ' + e.message);
      }
    }
    
    // Copy other resources (excluding app.package)
    if (fs.existsSync(resourcesSrc)) {
      fs.readdirSync(resourcesSrc).forEach((item) => {
        if (item !== 'app.package') {
          const srcItem = path.join(resourcesSrc, item);
          const destItem = path.join(resourcesDest, item);
          copyRecursiveSync(srcItem, destItem);
        }
      });
  log('[Updater] Resources updated successfully');
    }
    
    if (fs.existsSync(localesSrc)) {
      copyRecursiveSync(localesSrc, localesDest);
  log('[Updater] Locales updated successfully');
    }
    
    // Clean up
    try { 
      fs.rmSync(extractPath, { recursive: true, force: true }); 
      log('[Updater] Cleaned up extraction path');
    } catch (e) {
      log('[Updater] Could not clean up extraction path: ' + e.message);
    }
    
    // Clean up both possible update files
    try { 
      if (fs.existsSync(stagedUpdateFile)) {
        fs.unlinkSync(stagedUpdateFile);
        log('[Updater] Removed staged-update.json file');
      }
    } catch (e) {
      log('[Updater] Could not remove staged-update.json: ' + e.message);
    }
    
    try { 
      if (fs.existsSync(updaterInfoFile)) {
        fs.unlinkSync(updaterInfoFile);
        log('[Updater] Removed updater-info.json file');
      }
    } catch (e) {
      log('[Updater] Could not remove updater-info.json: ' + e.message);
    }
    
    // Create update state for UI notification
    const updateStateFile = path.join(userDataPath, 'update-state.json');
    const updateState = {
      applied: true,
      success: true,
      version: stagedUpdateInfo.version,
      timestamp: Date.now()
    };
    fs.writeFileSync(updateStateFile, JSON.stringify(updateState));
  log('[Updater] Created update state file');
    
  log(`[Updater] Update to version ${stagedUpdateInfo.version} applied successfully`);
    return true;
    
  } catch (error) {
  log('[Updater] Failed to apply staged update: ' + error);
    return false;
  }
}

async function launchApp() {
  try {
    let appExecutable;
    
    if (process.pkg) {
      // Running as packaged - find the main app executable
      const appPath = path.dirname(process.execPath);
      appExecutable = path.join(appPath, 'Office or Home Office.exe');
      
      if (!fs.existsSync(appExecutable)) {
        // Fallback to looking for any .exe in the directory
        const files = fs.readdirSync(appPath);
        const exeFile = files.find(f => f.endsWith('.exe') && !f.includes('updater'));
        if (exeFile) {
          appExecutable = path.join(appPath, exeFile);
        }
      }
    } else {
      // Running as Node script - launch via npm start
      appExecutable = 'npm';
    }
    
  log('[Updater] Launching app: ' + appExecutable);
    
    if (process.pkg) {
      // Launch the exe directly
      spawn(appExecutable, [], { 
        detached: true, 
        stdio: 'ignore',
        cwd: path.dirname(appExecutable)
      });
    } else {
      // Launch via npm start
      spawn('npm', ['start'], { 
        detached: true, 
        stdio: 'ignore',
        cwd: path.resolve(__dirname, '..')
      });
    }
    
  log('[Updater] App launched successfully');
    
  } catch (error) {
  log('[Updater] Failed to launch app: ' + error);
  }
}

async function main() {
  log('[Updater] Starting update process...');
  // The batch script now waits for the main process to exit, so we just apply the update
  await applyStagedUpdate();
  log('[Updater] External updater completed');
  process.exit(0);
}

// Run the updater
main().catch(error => {
  log('[Updater] Fatal error: ' + error);
  process.exit(1);
});
