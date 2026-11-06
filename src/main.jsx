import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/bungee';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/700.css';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
