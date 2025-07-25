// Authentication and session management.
//
// This module handles everything related to obtaining and managing
// Spotify OAuth tokens.  It implements the PKCE flow, stores the
// resulting access token, updates the UI when the user logs in or
// out, and provides helpers to handle session expiration.

import { state, updateStatus } from './state.js';
import { startMonitoring, stopMonitoring } from './monitor.js';

// --- PKCE HELPER FUNCTIONS ---

// Generates a secure random string for the code verifier
function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Hashes the code verifier using SHA256
async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

// Base64-encodes the hashed code verifier
function base64encode(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// --- AUTHENTICATION FLOW ---

// 1. Redirects the user to Spotify's authorization page
async function redirectToSpotify() {
  const clientId = localStorage.getItem('user_spotify_client_id');
  if (!clientId) {
    alert('Please save your Spotify Client ID first.');
    return;
  }

  const codeVerifier = generateRandomString(64);
  localStorage.setItem('pkce_code_verifier', codeVerifier);

  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64encode(hashed);

  const redirectUri = window.location.origin + window.location.pathname;

  const scope = 'user-read-playback-state user-modify-playback-state';
  const authUrl = new URL("https://accounts.spotify.com/authorize");

  const params = {
    response_type: 'code',
    client_id: clientId,
    scope,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: redirectUri,
  };

  authUrl.search = new URLSearchParams(params).toString();
  window.location.href = authUrl.toString();
}

// 2. Handles the redirect back from Spotify
async function handleRedirect() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (code) {
    // Remove the code from the URL so it doesn't get used again
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    history.pushState({}, document.title, url.toString());

    await getAccessToken(code);
  }
}

// 3. Exchanges the authorization code for an access token (client-side)
async function getAccessToken(code) {
  const clientId = localStorage.getItem('user_spotify_client_id');
  const codeVerifier = localStorage.getItem('pkce_code_verifier');
  const redirectUri = window.location.origin + window.location.pathname;

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP status ${response.status}`);
    }

    const data = await response.json();
    storeTokens(data);
    onLoginSuccess();

  } catch (error) {
    console.error('Error getting access token:', error);
    alert('Failed to get access token. Please try logging in again.');
    handleLogout();
  }
}

// --- TOKEN MANAGEMENT ---

function storeTokens(data) {
  const now = new Date();
  const expiresIn = data.expires_in * 1000; // convert to milliseconds
  const expiryTime = now.getTime() + expiresIn;

  localStorage.setItem('spotify_access_token', data.access_token);
  localStorage.setItem('spotify_refresh_token', data.refresh_token);
  localStorage.setItem('spotify_token_expiry', expiryTime);
}

async function refreshToken() {
  const clientId = localStorage.getItem('user_spotify_client_id');
  const refreshToken = localStorage.getItem('spotify_refresh_token');

  if (!refreshToken) {
    console.log("No refresh token available.");
    handleLogout();
    return null;
  }

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP status ${response.status}`);
    }

    const data = await response.json();
    storeTokens(data);
    return data.access_token;

  } catch (error) {
    console.error('Error refreshing token:', error);
    handleLogout(); // Log out if refresh fails
    return null;
  }
}

async function getValidAccessToken() {
  const expiryTime = localStorage.getItem('spotify_token_expiry');
  const now = new Date().getTime();

  if (!expiryTime || now > parseInt(expiryTime, 10)) {
    console.log("Token expired, refreshing...");
    return await refreshToken();
  }

  return localStorage.getItem('spotify_access_token');
}

// --- UI & STATE LOGIC ---

function handleLogout() {
  // Clear all Spotify-related local storage
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_refresh_token');
  localStorage.removeItem('spotify_token_expiry');
  localStorage.removeItem('pkce_code_verifier');

  stopMonitoring();
  state.isMonitoring = false;
  state.isLoggedIn = false;

  // Reset UI
  document.getElementById('monitoring-section').style.display = 'none';
  document.getElementById('auto-skipper-content').style.display = 'block';
  updateStatus('Logged out.');
}

function onLoginSuccess() {
  state.isLoggedIn = true;
  document.getElementById('auto-skipper-content').style.display = 'none';
  document.getElementById('monitoring-section').style.display = 'block';
  updateStatus('Ready to start monitoring.');
}

function handlePageLoad() {
  const accessToken = localStorage.getItem('spotify_access_token');
  if (accessToken) {
    onLoginSuccess();
  }
  handleRedirect();
}

// --- DESKTOP SCRIPT (No changes needed here) ---
function downloadPersonalizedScript() {
  // ... (This function can remain as is)
}

export { redirectToSpotify, handlePageLoad, downloadPersonalizedScript, handleLogout, getValidAccessToken };