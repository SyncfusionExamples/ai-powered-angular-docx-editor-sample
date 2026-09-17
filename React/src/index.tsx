import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerLicense } from "@syncfusion/ej2-base";
// Registering Syncfusion license key
registerLicense('Replace your generated license key here');

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
