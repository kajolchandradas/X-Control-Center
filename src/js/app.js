import { Auth } from './auth.js';
import { Dashboard } from './dashboard.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize dashboard views
    await Dashboard.init();
    // Initialize authentication check
    await Auth.init();
  } catch (err) {
    console.error('Fatal initialization error:', err);
  }
});
