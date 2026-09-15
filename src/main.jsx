import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import StableEnhancements from './StableEnhancements.jsx';
import AdminPosterBridge from './AdminPosterBridge.jsx';
import { runReviewEnhancements } from './reviewEnhancements.js';
import './stableFixes.css';
import './reviewFix.css';
import './clean.js';

function ReviewEnhancementBridge(){
  useEffect(() => {
    runReviewEnhancements();
    let timer;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(runReviewEnhancements, 120);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const poll = window.setInterval(runReviewEnhancements, 2500);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      clearInterval(poll);
    };
  }, []);
  return null;
}

createRoot(document.getElementById('root')).render(
  <>
    <App />
    <StableEnhancements />
    <AdminPosterBridge />
    <ReviewEnhancementBridge />
  </>
);
