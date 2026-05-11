import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App
      firebaseUser={null}
      userProfile={{role:"admin",alias:"Bruno"}}
      onLogout={()=>{}}
      firebaseAreas={null}
      firebasePatients={null}
      syncStatus=""
      onUpdatePatient={null}
      onAddPatient={null}
      onRemovePatient={null}
      onUpdateAreas={null}
      onAddArea={null}
      onRemoveArea={null}
      onReloadData={null}
    />
  </React.StrictMode>
);
