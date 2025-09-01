async function extractAndInstallUpdate(filePath, winRef) {
  console.log('[Electron] extractAndInstallUpdate function called with filePath:', filePath);
  
  // Check file size first
  try {
    const stats = fs.statSync(filePath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`[Electron] Update file size: ${fileSizeInMB} MB`);
  } catch (err) {
    console.error('[Electron] Could not read update file stats:', err);
  }
  
  return new Promise((resolve, reject) => {
    const extractPath = path.join(os.tmpdir(), 'office-home-office-update');
    // Clean up previous extraction
    try { if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true }); } catch (e) {}

    if (path.extname(filePath) === '.exe') {
      if (winRef && winRef.webContents) {
        winRef.webContents.send('update-install-progress', { phase: 'installing', percent: 10, message: 'Running installer...' });
      }
      exec(`"${filePath}" /S`, (error) => {
        if (error) {
          if (winRef && winRef.webContents) {
            winRef.webContents.send('update-install-progress', { phase: 'error', percent: 100, message: `Installer failed: ${error.message}` });
          }
          reject(error);
        } else {
          if (winRef && winRef.webContents) {
            winRef.webContents.send('update-install-progress', { phase: 'installing', percent: 100, message: 'Install complete.' });
          }
          resolve();
        }
      });
    } else if (path.extname(filePath) === '.zip') {
      // Use AdmZip for immediate extraction
      console.log('[Electron] Starting ZIP extraction with AdmZip:', filePath);
      
      if (winRef && winRef.webContents) {
        winRef.webContents.send('update-install-progress', { phase: 'installing', percent: 10, message: 'Extracting update...' });
      }
      
      try {
        const AdmZip = require('adm-zip');
        console.log('[Electron] Creating AdmZip instance...');
        const zip = new AdmZip(filePath);
        
        if (winRef && winRef.webContents) {
          winRef.webContents.send('update-install-progress', { phase: 'installing', percent: 20, message: 'Reading ZIP file...' });
        }
        
        console.log('[Electron] Extracting all files to:', extractPath);
        zip.extractAllTo(extractPath, true);
        
        console.log('[Electron] ZIP extraction completed successfully');
        if (winRef && winRef.webContents) {
          winRef.webContents.send('update-install-progress', { phase: 'installing', percent: 70, message: 'Extraction completed!' });
        }
        
        // Continue with app.asar verification and file copying...
        const appAsarPath = path.join(extractPath, 'resources', 'app.asar');
        if (!fs.existsSync(appAsarPath)) {
          console.error('app.asar missing after extraction:', appAsarPath);
          if (winRef && winRef.webContents) {
            winRef.webContents.send('update-install-progress', { phase: 'error', percent: 100, message: `app.asar missing after extraction: ${appAsarPath}` });
          }
          reject(new Error(`app.asar missing after extraction: ${appAsarPath}`));
          return;
        }
        
        console.log('app.asar found after extraction:', appAsarPath);
        
        // Copy the extracted app.asar to the application directory
        const appDir = path.dirname(process.execPath);
        const targetAppAsarPath = path.join(appDir, 'resources', 'app.asar');
        
        if (winRef && winRef.webContents) {
          winRef.webContents.send('update-install-progress', { phase: 'installing', percent: 90, message: 'Installing update...' });
        }
        
        // Copy app.asar
        try {
          fs.copyFileSync(appAsarPath, targetAppAsarPath);
          console.log('[Electron] Successfully copied app.asar to:', targetAppAsarPath);
        } catch (copyError) {
          console.error('[Electron] Failed to copy app.asar:', copyError);
          if (winRef && winRef.webContents) {
            winRef.webContents.send('update-install-progress', { phase: 'error', percent: 100, message: `Failed to copy app.asar: ${copyError.message}` });
          }
          reject(copyError);
          return;
        }
        
        // Clean up extraction folder
        try { fs.rmSync(extractPath, { recursive: true, force: true }); } catch (e) {}

        if (winRef && winRef.webContents) {
          winRef.webContents.send('update-install-progress', { phase: 'ready', percent: 100, message: 'Update installed! Please restart.' });
        }
        resolve();
        
      } catch (zipError) {
        console.error('[Electron] ZIP extraction failed:', zipError);
        if (winRef && winRef.webContents) {
          winRef.webContents.send('update-install-progress', { phase: 'error', percent: 20, message: `ZIP extraction failed: ${zipError.message}` });
        }
        reject(zipError);
      }
    } else {
      if (winRef && winRef.webContents) {
        winRef.webContents.send('update-install-progress', { phase: 'error', percent: 100, message: 'Unsupported file format' });
      }
      reject(new Error('Unsupported file format'));
    }
  });
}
