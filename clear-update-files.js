const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// This script clears all update-related files for clean testing
function clearUpdateFiles() {
    try {
        const userDataPath = app.getPath('userData');
        const files = [
            'staged-update.json',
            'update-state.json'
        ];
        
        console.log('Clearing update files from:', userDataPath);
        
        files.forEach(fileName => {
            const filePath = path.join(userDataPath, fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('Deleted:', fileName);
            } else {
                console.log('Not found:', fileName);
            }
        });
        
        console.log('Update files cleared successfully');
    } catch (error) {
        console.error('Error clearing update files:', error);
    }
}

module.exports = clearUpdateFiles;
