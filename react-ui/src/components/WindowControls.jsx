import './WindowControls.css';

function WindowControls() {
  return (
    <div className="window-controls">
      <button onClick={() => window.electronAPI.minimize()}>➖</button>
      <button onClick={() => window.electronAPI.maximize()}>🔲</button>
      <button onClick={() => window.electronAPI.close()} className="close">❌</button>
    </div>
  );
}

export default WindowControls;
