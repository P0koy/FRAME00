import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Enhancements from './Enhancements.jsx';

createRoot(document.getElementById('root')).render(
  <>
    <App />
    <Enhancements />
  </>
);
