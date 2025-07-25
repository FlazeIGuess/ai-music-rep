// Loading and rendering artists from the backend.
//
// This module handles fetching the list of artists from the API,
// maintaining a cache for client‑side search and rendering the
// results into the DOM.  Search input is debounced at the call
// site so filtering happens on keystrokes without additional
// network requests.

import { API_BASE } from './config.js';
import { state } from './state.js';

/**
 * Fetch the list of artists from the backend, cache the result and
 * render the table.  If the request fails a message is displayed
 * instead of the table contents.
 */
export async function loadArtists() {
  try {
    console.log('Fetching artists from', API_BASE + '/artists');
    const response = await fetch(API_BASE + '/artists');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} – ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.artists) {
      throw new Error('Missing `artists` array in response JSON.');
    }
    // Cache the full list for client‑side search
    state.allArtists = data.artists;
    // Build a set of blocked IDs for quick lookup
    state.blockedArtistIds = new Set(state.allArtists.map(a => a.spotify_id));
    console.log('Blocked artist IDs loaded:', state.blockedArtistIds);
    renderArtists(state.allArtists);
  } catch (err) {
    console.error('Could not load artists:', err);
    const tableBody = document.querySelector('#artists-table tbody');
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="2">Could not load artist list. See console for details.</td></tr>';
    }
  }
}

/**
 * Render the provided list of artists into the table body.  The
 * artists with ID 0 are filtered out as these are used for
 * internal testing.
 *
 * @param {Array<{id:number,name:string,spotify_id:string}>} artists List of artists to render
 */
export function renderArtists(artists) {
  const tableBody = document.querySelector('#artists-table tbody');
  if (!tableBody) return;
  tableBody.innerHTML = '';
  // Filter out the test account
  const visibleArtists = artists.filter(artist => artist.id !== 0);
  if (visibleArtists.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="2">No matching artists found.</td></tr>';
    return;
  }
  visibleArtists.forEach(artist => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${artist.name}</td>
      <td><a href="https://open.spotify.com/artist/${artist.spotify_id}" target="_blank">View on Spotify</a></td>
    `;
    tableBody.appendChild(row);
  });
}

/**
 * Handle input in the search field by filtering the cached list of
 * artists.  Filtering is case‑insensitive and matches any part of
 * the artist's name.
 *
 * @param {Event} evt The input event
 */
export function handleSearch(evt) {
  const searchTerm = evt.target.value.toLowerCase();
  const filteredArtists = state.allArtists.filter(artist =>
    artist.name.toLowerCase().includes(searchTerm)
  );
  renderArtists(filteredArtists);
}