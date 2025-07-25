// Entry point for the application.
//
// This module wires together all of the individual feature modules
// and sets up event listeners.  It is responsible for performing
// initial UI configuration, loading initial data and handling the
// saving of the user's Spotify Client ID.  On DOMContentLoaded
// it calls the initialization routine to kick things off.

import { redirectToSpotify, handlePageLoad, downloadPersonalizedScript, handleLogout } from './auth.js';
/**
 * Initializes functionalities that require user consent (e.g., for localStorage).
 * This is called by the loader.js after the user gives consent and the script is loaded.
 */
export function initializeApp() {
  console.log("Initializing consented application functionalities (login)...");

  // Enable the setup form now that consent is given
  const clientIdInput = document.getElementById('user-client-id');
  const saveBtn = document.getElementById('save-client-id-btn');
  const consentNotice = document.getElementById('consent-notice-setup');

  if (clientIdInput) clientIdInput.disabled = false;
  if (saveBtn) saveBtn.disabled = false;
  if (consentNotice) consentNotice.style.display = 'none';


  // --- SETUP LISTENERS FOR CONSENT-REQUIRING FEATURES ---
  const connectBtn = document.getElementById('connect-spotify');
  if (connectBtn) connectBtn.addEventListener('click', redirectToSpotify);

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  const downloadBtn = document.getElementById('download-script-btn');
  if (downloadBtn) downloadBtn.addEventListener('click', downloadPersonalizedScript);

  const saveClientBtn = document.getElementById('save-client-id-btn');
  if (saveClientBtn) saveClientBtn.addEventListener('click', saveClientId);

  const clearClientBtn = document.getElementById('clear-client-id-btn');
  if (clearClientBtn) clearClientBtn.addEventListener('click', clearClientId);

  // --- DYNAMIC CLIENT ID HANDLING ---
  const userClientId = localStorage.getItem('user_spotify_client_id') || null;
  if (userClientId) {
    if (clientIdInput) {
      clientIdInput.value = userClientId;
    }
    // If an ID is already stored, immediately show the connection view
    document.querySelector('.setup-guide').style.display = 'none';
    document.getElementById('connection-container').style.display = 'block';
    document.getElementById('connect-spotify').disabled = false;
    document.getElementById('download-script-btn').disabled = false;
  }

  // Handle Spotify redirect and check login status
  handlePageLoad();
}

function saveClientId() {
  const input = document.getElementById('user-client-id');
  const newClientId = input.value.trim();
  if (newClientId && newClientId.length === 32) {
    localStorage.setItem('user_spotify_client_id', newClientId);
    alert('Client ID saved! You can now use the Auto Skipper.');

    // Update UI correctly after saving
    document.getElementById('connect-spotify').disabled = false;
    document.getElementById('download-script-btn').disabled = false;
    document.querySelector('.setup-guide').style.display = 'none';
    document.getElementById('connection-container').style.display = 'block';

  } else {
    alert('Please enter a valid 32-character Spotify Client ID.');
    input.style.borderColor = 'var(--danger-color)';
  }
}

function clearClientId() {
  if (confirm('Are you sure you want to clear your saved Client ID?')) {
    localStorage.removeItem('user_spotify_client_id');

    const input = document.getElementById('user-client-id');
    if (input) {
      input.value = '';
      input.style.borderColor = '#444';
    }
    document.getElementById('connect-spotify').disabled = true;
    document.getElementById('download-script-btn').disabled = true;

    // Show the setup guide again and hide the connection container
    document.querySelector('.setup-guide').style.display = 'block';
    document.getElementById('connection-container').style.display = 'none';
  }
}

/**
 * Resets and disables all UI elements that require consent.
 * This is called by the loader when consent is revoked.
 */
export async function shutdownConsentedApp() {
  console.log("Consent revoked. Shutting down consented app functionalities...");

  // Dynamically import here to avoid circular dependencies
  const { stopMonitoring } = await import('./monitor.js');
  stopMonitoring();

  // Reset UI to its initial, pre-consent state
  const clientIdInput = document.getElementById('user-client-id');
  const saveBtn = document.getElementById('save-client-id-btn');
  const consentNotice = document.getElementById('consent-notice-setup');
  const connectionContainer = document.getElementById('connection-container');
  const monitoringSection = document.getElementById('monitoring-section');

  if (clientIdInput) clientIdInput.disabled = true;
  if (saveBtn) saveBtn.disabled = true;
  if (consentNotice) consentNotice.style.display = 'block';
  if (connectionContainer) connectionContainer.style.display = 'none';
  if (monitoringSection) monitoringSection.style.display = 'none';

  // We don't clear the Client ID from localStorage,
  // so it's still there if the user re-enables consent.
}


// Initialize the consent-based parts of the app as soon as this script is loaded by ccm19.
initializeApp();