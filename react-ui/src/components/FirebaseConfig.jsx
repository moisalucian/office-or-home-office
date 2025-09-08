import React, { useState, useEffect } from 'react';
import './FirebaseConfig.css';

const FirebaseConfig = ({ onConfigSaved, onClose, currentConfig = {} }) => {
  const [config, setConfig] = useState({
    apiKey: currentConfig.apiKey || '',
    authDomain: currentConfig.authDomain || '',
    databaseURL: currentConfig.databaseURL || '',
    projectId: currentConfig.projectId || '',
    storageBucket: currentConfig.storageBucket || '',
    messagingSenderId: currentConfig.messagingSenderId || '',
    appId: currentConfig.appId || '',
    measurementId: currentConfig.measurementId || ''
  });

  const [bulkConfig, setBulkConfig] = useState('');
  const [showBulkInput, setShowBulkInput] = useState(false);

  const handleInputChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBulkPaste = () => {
    try {
      const lines = bulkConfig.split('\n');
      const newConfig = { ...config };
      
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.includes('=')) {
          const [key, value] = trimmed.split('=');
          const cleanKey = key.trim().replace('VITE_FIREBASE_', '');
          const cleanValue = value.trim();
          
          switch (cleanKey) {
            case 'API_KEY':
              newConfig.apiKey = cleanValue;
              break;
            case 'AUTH_DOMAIN':
              newConfig.authDomain = cleanValue;
              break;
            case 'DATABASE_URL':
              newConfig.databaseURL = cleanValue;
              break;
            case 'PROJECT_ID':
              newConfig.projectId = cleanValue;
              break;
            case 'STORAGE_BUCKET':
              newConfig.storageBucket = cleanValue;
              break;
            case 'MESSAGING_SENDER_ID':
              newConfig.messagingSenderId = cleanValue;
              break;
            case 'APP_ID':
              newConfig.appId = cleanValue;
              break;
            case 'MEASUREMENT_ID':
              newConfig.measurementId = cleanValue;
              break;
          }
        }
      });
      
      setConfig(newConfig);
      setBulkConfig('');
      setShowBulkInput(false);
    } catch (error) {
      alert('Error parsing configuration. Please check the format.');
    }
  };

  const handleSave = () => {
    // Validate required fields
    const required = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    const missing = required.filter(field => !config[field].trim());
    
    if (missing.length > 0) {
      alert(`Please fill in the following required fields: ${missing.join(', ')}`);
      return;
    }

    onConfigSaved(config);
  };

  const isConfigValid = () => {
    const required = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    return required.every(field => config[field].trim());
  };

  return (
    <div className="firebase-config-overlay">
      <div className="firebase-config-modal">
        <div className="firebase-config-header">
          <h3>Firebase Configuration</h3>
          {onClose && (
            <button className="firebase-config-close" onClick={onClose}>×</button>
          )}
        </div>

        <div className="firebase-config-content">
          <div className="config-section">
            <div className="bulk-config-section">
              <button 
                className="bulk-toggle-btn"
                onClick={() => setShowBulkInput(!showBulkInput)}
              >
                {showBulkInput ? 'Switch to Individual Fields' : 'Paste All Configuration'}
              </button>
            </div>

            {showBulkInput ? (
              <div className="bulk-input-section">
                <label>Paste your Firebase configuration (one per line):</label>
                <textarea
                  value={bulkConfig}
                  onChange={(e) => setBulkConfig(e.target.value)}
                  placeholder={`VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdefghijklmnop
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX`}
                  rows={8}
                  className="bulk-config-textarea"
                />
                <button onClick={handleBulkPaste} className="bulk-apply-btn">
                  Apply Configuration
                </button>
              </div>
            ) : (
              <div className="individual-fields">
                <div className="config-field">
                  <label>API Key *</label>
                  <input
                    type="text"
                    value={config.apiKey}
                    onChange={(e) => handleInputChange('apiKey', e.target.value)}
                    placeholder="AIzaSy..."
                  />
                </div>

                <div className="config-field">
                  <label>Auth Domain *</label>
                  <input
                    type="text"
                    value={config.authDomain}
                    onChange={(e) => handleInputChange('authDomain', e.target.value)}
                    placeholder="your-project.firebaseapp.com"
                  />
                </div>

                <div className="config-field">
                  <label>Database URL *</label>
                  <input
                    type="text"
                    value={config.databaseURL}
                    onChange={(e) => handleInputChange('databaseURL', e.target.value)}
                    placeholder="https://your-project-default-rtdb.firebaseio.com"
                  />
                </div>

                <div className="config-field">
                  <label>Project ID *</label>
                  <input
                    type="text"
                    value={config.projectId}
                    onChange={(e) => handleInputChange('projectId', e.target.value)}
                    placeholder="your-project-id"
                  />
                </div>

                <div className="config-field">
                  <label>Storage Bucket *</label>
                  <input
                    type="text"
                    value={config.storageBucket}
                    onChange={(e) => handleInputChange('storageBucket', e.target.value)}
                    placeholder="your-project.appspot.com"
                  />
                </div>

                <div className="config-field">
                  <label>Messaging Sender ID *</label>
                  <input
                    type="text"
                    value={config.messagingSenderId}
                    onChange={(e) => handleInputChange('messagingSenderId', e.target.value)}
                    placeholder="123456789"
                  />
                </div>

                <div className="config-field">
                  <label>App ID *</label>
                  <input
                    type="text"
                    value={config.appId}
                    onChange={(e) => handleInputChange('appId', e.target.value)}
                    placeholder="1:123456789:web:abcdefghijklmnop"
                  />
                </div>

                <div className="config-field">
                  <label>Measurement ID (optional)</label>
                  <input
                    type="text"
                    value={config.measurementId}
                    onChange={(e) => handleInputChange('measurementId', e.target.value)}
                    placeholder="G-XXXXXXXXXX"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="firebase-config-actions">
            <button 
              onClick={handleSave}
              className={`save-btn ${isConfigValid() ? 'enabled' : 'disabled'}`}
              disabled={!isConfigValid()}
            >
              Save Configuration
            </button>
            {onClose && (
              <button onClick={onClose} className="cancel-btn">
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirebaseConfig;
