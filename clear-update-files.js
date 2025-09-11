const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

// This script clears all update-related files and temporary files for clean testing
function clearUpdateFiles(force = false) {
    try {
        const userDataPath = app.getPath('userData');
        const tempDir = os.tmpdir();
        
        // Check if there's an active update in progress
        const stagedUpdateFile = path.join(userDataPath, 'staged-update.json');
        const updateStateFile = path.join(userDataPath, 'update-state.json');
        
        if (!force) {
            // Don't cleanup if there's a staged update or recent update activity
            if (fs.existsSync(stagedUpdateFile)) {
                console.log('Skipping cleanup: staged update detected');
                return;
            }
            
            // Check if there was recent update activity (within last hour)
            if (fs.existsSync(updateStateFile)) {
                const stats = fs.statSync(updateStateFile);
                const oneHourAgo = Date.now() - (60 * 60 * 1000);
                if (stats.mtime.getTime() > oneHourAgo) {
                    console.log('Skipping cleanup: recent update activity detected');
                    return;
                }
            }
        }
        
        // Files in userData directory to clean (only if old enough)
        const userDataFiles = [
            'staged-update.json',
            'update-state.json'
        ];
        
        // Temporary files/directories to clean
        const tempFiles = [
            path.join(tempDir, 'update-log.txt'),
            path.join(tempDir, 'office-home-office-update')
        ];
        
        console.log('Running safe cleanup...');
        
        // Clean userData files only if they're older than 1 hour
        userDataFiles.forEach(fileName => {
            const filePath = path.join(userDataPath, fileName);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                const oneHourAgo = Date.now() - (60 * 60 * 1000);
                
                if (force || stats.mtime.getTime() < oneHourAgo) {
                    fs.unlinkSync(filePath);
                    console.log('Deleted old userData file:', fileName);
                } else {
                    console.log('Skipping recent userData file:', fileName);
                }
            }
        });
        
        // Clean temporary files (these are safer to clean)
        tempFiles.forEach(filePath => {
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    // Only clean extract directories older than 1 hour
                    const oneHourAgo = Date.now() - (60 * 60 * 1000);
                    if (force || stats.mtime.getTime() < oneHourAgo) {
                        fs.rmSync(filePath, { recursive: true, force: true });
                        console.log('Deleted old temp directory:', path.basename(filePath));
                    }
                } else {
                    // Clean log files older than 24 hours
                    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
                    if (force || stats.mtime.getTime() < oneDayAgo) {
                        fs.unlinkSync(filePath);
                        console.log('Deleted old temp file:', path.basename(filePath));
                    }
                }
            }
        });
        
        // Clean any leftover .download files older than 1 hour
        const downloadPattern = /\.download$/;
        try {
            const tempDirFiles = fs.readdirSync(tempDir);
            tempDirFiles.forEach(file => {
                if (downloadPattern.test(file)) {
                    const downloadFilePath = path.join(tempDir, file);
                    try {
                        const stats = fs.statSync(downloadFilePath);
                        const oneHourAgo = Date.now() - (60 * 60 * 1000);
                        if (force || stats.mtime.getTime() < oneHourAgo) {
                            fs.unlinkSync(downloadFilePath);
                            console.log('Deleted old download file:', file);
                        }
                    } catch (e) {
                        // File might be in use, skip it
                    }
                }
            });
        } catch (e) {
            console.log('Could not scan temp directory for download files:', e.message);
        }
        
        console.log('Safe cleanup completed successfully');
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

// Function to schedule periodic cleanup (called on app startup)
function schedulePeriodicCleanup() {
    try {
        // Run cleanup every 6 hours instead of 24 (more frequent but still safe)
        // This ensures cleanup happens when the computer is actually in use
        const cleanupInterval = 6 * 60 * 60 * 1000; // 6 hours
        
        setInterval(() => {
            console.log('Running scheduled cleanup...');
            clearUpdateFiles(false); // Never force during scheduled cleanup
        }, cleanupInterval);
        
        console.log('Scheduled periodic cleanup every 6 hours');
    } catch (error) {
        console.error('Error scheduling periodic cleanup:', error);
    }
}

module.exports = { clearUpdateFiles, schedulePeriodicCleanup };
