// Authentication and session management.
//
// This module handles everything related to obtaining and managing
// Spotify OAuth tokens.  It implements the PKCE flow, stores the
// resulting access token, updates the UI when the user logs in or
// out, and provides helpers to handle session expiration.

import { REDIRECT_URI, API_BASE } from './config.js';
import { state } from './state.js';
import { generateRandomString, generateCodeChallenge } from './pkce.js';
import { updateStatus } from './utils.js';

/**
 * Perform initial authentication checks on page load.  This function
 * inspects the current URL for an authorization code, exchanges it
 * for an access token if present, or loads any valid token from
 * localStorage.  When a token is obtained the onLoginSuccess
 * callback is invoked to update the UI accordingly.
 */
export async function handlePageLoad() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');

  if (code) {
    // The user has been redirected back from Spotify with an
    // authorization code.  Use the stored code verifier to exchange
    // this code for an access token.
    const codeVerifier = localStorage.getItem('code_verifier');
    if (!codeVerifier) {
      console.error('Code verifier not found in localStorage.');
      alert('Authentication error: Could not verify the request. Please try logging in again.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/exchange-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,
          code_verifier: codeVerifier,
          client_id: state.userClientId, // always use the user's client ID
          redirect_uri: REDIRECT_URI // Send the dynamic redirect_uri to the backend
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to exchange token.');
      }
      const { access_token, expires_in } = await response.json();
      state.accessToken = access_token;
      const expiryTime = Date.now() + expires_in * 1000;
      localStorage.setItem('spotify_access_token', state.accessToken);
      localStorage.setItem('spotify_token_expiry', expiryTime);
      localStorage.removeItem('code_verifier'); // clean up
      history.pushState('', document.title, window.location.pathname); // clean the URL
      console.log('New token received and stored via PKCE flow.');
      await onLoginSuccess();
      return;
    } catch (err) {
      console.error('Error exchanging token:', err);
      alert(`Authentication failed: ${err.message}`);
      return;
    }
  }

  // If we reach this branch, either there was no code or token
  // exchange failed.  See if a valid token is stored locally.
  const storedToken = localStorage.getItem('spotify_access_token');
  const tokenExpiry = localStorage.getItem('spotify_token_expiry');
  if (storedToken && tokenExpiry && Date.now() < tokenExpiry) {
    state.accessToken = storedToken;
    console.log('Found valid token in localStorage.');
    await onLoginSuccess();
  } else {
    console.log('No valid token found. User needs to connect.');
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_token_expiry');
  }
}

/**
 * Start the PKCE authorization flow by redirecting the user to
 * Spotify's authorization endpoint.  A cryptographically random
 * code verifier and its corresponding challenge are generated and
 * stored prior to the redirect.
 */
export async function redirectToSpotify() {
  if (!state.userClientId) {
    alert('Please save a valid Spotify Client ID first.');
    return;
  }
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const scope = 'user-read-playback-state user-modify-playback-state';
  localStorage.setItem('code_verifier', codeVerifier);
  const args = new URLSearchParams({
    response_type: 'code',
    client_id: state.userClientId,
    scope: scope,
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge
  });
  console.log('Redirecting to Spotify for PKCE flow...');
  window.location = 'https://accounts.spotify.com/authorize?' + args;
}

/**
 * Update the UI once the user has successfully logged in.  This
 * function hides the login box, shows the monitoring interface and
 * sets the status to indicate that the application is ready.
 */
export async function onLoginSuccess() {
  const browserBox = document.getElementById('browser-mode-box');
  const monitoringSection = document.getElementById('monitoring-section');
  if (browserBox) browserBox.style.display = 'none';
  if (monitoringSection) monitoringSection.style.display = 'block';
  updateStatus('Ready to start monitoring.');
}

/**
 * Provide the user with a personalized copy of the watcher script.
 * The script template is fetched from the server, the client ID
 * placeholder is replaced, and the resulting file is offered for
 * download.
 */
export async function downloadPersonalizedScript() {
  if (!state.userClientId) {
    alert('Please save your Client ID before downloading the script.');
    return;
  }
  try {
    // Add a cache‑busting query parameter so the user always gets
    // the latest version of the script.
    const response = await fetch(`watcher.py?v=${Date.now()}`);
    if (!response.ok) throw new Error('Could not load the script template.');
    let scriptContent = await response.text();
    scriptContent = scriptContent.replace('YOUR_32_CHARACTER_CLIENT_ID_HERE', state.userClientId);
    const blob = new Blob([scriptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'watcher.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error creating download script:', err);
    alert('An error occurred while preparing the download. Please try again.');
  }
}

/**
 * Log the user out by removing stored tokens, resetting state and
 * updating the UI back to the initial state.  Any active monitoring
 * interval is cleared.
 */
export function handleLogout() {
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_token_expiry');
  state.accessToken = null;
  state.isMonitoring = false;
  clearInterval(state.monitoringInterval);
  const browserBox = document.getElementById('browser-mode-box');
  const monitoringSection = document.getElementById('monitoring-section');
  if (browserBox) browserBox.style.display = 'block';
  if (monitoringSection) monitoringSection.style.display = 'none';
  updateStatus('Logged out.');
}

/**
 * Handle expired or revoked tokens by clearing stored credentials,
 * stopping monitoring and returning the UI to the login state.
 *
 * @param {string} [reason] Optional message explaining why the token
 *   expired.  A default message is used if none is provided.
 */
export function handleTokenExpiration(reason) {
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_token_expiry');
  state.accessToken = null;
  state.isMonitoring = false;
  clearInterval(state.monitoringInterval);
  const message = reason || 'Session expired. Please reconnect to Spotify.';
  updateStatus(message);
  const browserBox = document.getElementById('browser-mode-box');
  const monitoringSection = document.getElementById('monitoring-section');
  if (browserBox) browserBox.style.display = 'block';
  if (monitoringSection) monitoringSection.style.display = 'none';
  const btn = document.getElementById('toggle-monitoring');
  if (btn) {
    btn.textContent = 'Start Monitoring';
    btn.classList.remove('active');
  }
}