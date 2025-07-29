import { state } from './state.js';

/**
 * Loads the Client ID from localStorage into the application's in-memory state.
 * This should be called once when the application initializes.
 */
export function initState() {
    state.userClientId = localStorage.getItem('user_spotify_client_id') || null;
}

/**
 * Saves a new Client ID to both localStorage and the in-memory state.
 * @param {string} clientId The 32-character Spotify Client ID.
 */
export function saveClientId(clientId) {
    state.userClientId = clientId;
    localStorage.setItem('user_spotify_client_id', clientId);
}

/**
 * Clears the Client ID from both localStorage and the in-memory state.
 */
export function clearClientId() {
    state.userClientId = null;
    localStorage.removeItem('user_spotify_client_id');
}