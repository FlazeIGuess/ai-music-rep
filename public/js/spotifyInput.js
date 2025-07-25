// Auto‑fill artist names from Spotify links.
//
// When a user enters a Spotify artist URL into the report form
// this module extracts the artist ID, queries Spotify for the
// artist's name using the current access token and populates
// the name field.  A debounce timer avoids spamming the API.

import { state } from './state.js';
import { updateStatus } from './utils.js';

/**
 * Handle input into the Spotify link field.  After a short delay
 * extract the artist ID and fetch the artist's name from Spotify.
 *
 * @param {Event} e The input event
 */
export function handleSpotifyLinkInput(e) {
  // Clear any pending requests to prevent overlapping API calls
  clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(async () => {
    const match = e.target.value.match(/artist\/([a-zA-Z0-9]+)/);
    if (!match) return;
    if (!state.accessToken) {
      updateStatus('Connect to Spotify to fetch artist names.');
      return;
    }
    updateStatus('Fetching artist info...', true);
    try {
      const res = await fetch(`https://api.spotify.com/v1/artists/${match[1]}`, {
        headers: { Authorization: `Bearer ${state.accessToken}` }
      });
      if (!res.ok) throw new Error('Could not fetch artist.');
      const data = await res.json();
      const nameInput = document.getElementById('artist-name');
      if (nameInput) nameInput.value = data.name;
      updateStatus(`Artist "${data.name}" found!`);
    } catch (err) {
      console.error(err);
      updateStatus(err.message);
      const nameInput = document.getElementById('artist-name');
      if (nameInput) nameInput.value = '';
    }
  }, 500);
}