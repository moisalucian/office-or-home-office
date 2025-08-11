import { useState } from "react";
import "./styles.css";

function App() {
  const [message, setMessage] = useState("Application is working!");

  return (
    <div className="container">
      <h1>Office or Home Office</h1>
      <p>{message}</p>
      <button onClick={() => setMessage("Button clicked!")}>
        Test Button
      </button>
    </div>
  );
}

export default App;
