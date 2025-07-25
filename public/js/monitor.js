// Playback monitoring and track skipping.
//
// This module periodically polls the Spotify API to determine
// what the user is currently listening to.  If any of the
// artists on a track match the blocked list the track is
// automatically skipped.  The monitoring loop can be started
// or stopped by toggling a button in the UI.

import { state, updateStatus } from './state.js';
import { getValidAccessToken } from './auth.js';

let monitorInterval = null;
let lastTrackId = null;

/**
 * Start the playback monitoring loop. The current track is checked
 * immediately and then every five seconds. If any of the artists on
 * the track match the blocked list the track is automatically skipped.
 */
export function startMonitoring() {
  if (state.isMonitoring) return;
  state.isMonitoring = true;
  const btn = document.getElementById('toggle-monitoring');
  if (btn) {
    btn.innerHTML = '<i class="fas fa-stop"></i> Stop Monitoring';
    btn.classList.add('active');
  }
  updateStatus('Monitoring active...');
  checkPlayback(); // Initial check
  monitorInterval = setInterval(checkPlayback, 5000);
}

/**
 * Stop the playback monitoring loop. The current track will no
 * longer be checked and skipped automatically.
 */
export function stopMonitoring() {
  if (!state.isMonitoring) return;
  state.isMonitoring = false;
  clearInterval(monitorInterval);
  monitorInterval = null;
  const btn = document.getElementById('toggle-monitoring');
  if (btn) {
    btn.innerHTML = '<i class="fas fa-play"></i> Start Monitoring';
    btn.classList.remove('active');
  }
  updateStatus('Monitoring stopped.');
  const currentTrack = document.getElementById('current-track');
  if (currentTrack) currentTrack.textContent = 'None';
}

/**
 * Toggle the playback monitoring loop. If the loop is currently
 * running, it will be stopped. If it is not running, it will be
 * started.
 */
export function toggleMonitoring() {
  if (state.isMonitoring) {
    stopMonitoring();
  } else {
    startMonitoring();
  }
}

/**
 * Query Spotify for the currently playing track. If the track
 * contains any artists in the blocked list it is skipped. Token
 * expiration and access errors are handled gracefully.
 */
async function checkPlayback() {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    updateStatus('Authentication error. Please log in again.');
    stopMonitoring();
    return;
  }

  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (response.status === 204) {
      updateStatus('Player is idle.');
      const currentTrack = document.getElementById('current-track');
      if (currentTrack) currentTrack.textContent = 'Nothing is currently playing.';
      return;
    }

    if (!response.ok) {
      // Handle other errors like 401 Unauthorized, which getValidAccessToken should have caught, but as a fallback.
      throw new Error(`Spotify API Error: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data || !data.item) {
      updateStatus('Player is idle.');
      return;
    }

    const track = data.item;
    const artists = track.artists.map(a => ({ name: a.name, id: a.id }));
    const currentTrackDisplay = `${track.name} by ${artists.map(a => a.name).join(', ')}`;

    const currentTrackElem = document.getElementById('current-track');
    if (currentTrackElem) {
      currentTrackElem.textContent = currentTrackDisplay;
    }

    if (track.id !== lastTrackId) {
      lastTrackId = track.id;
      const isBlocked = artists.some(artist => state.blockedArtistIds.has(artist.id));

      if (isBlocked) {
        updateStatus(`Skipping track by blocked artist: ${artists.map(a => a.name).join(', ')}`);
        await skipTrack();
      } else {
        updateStatus(`Now playing: ${currentTrackDisplay}`);
      }
    }
  } catch (error) {
    console.error('Error checking playback:', error);
    updateStatus('Error connecting to Spotify. Retrying...');
    // Optional: implement more robust error handling, e.g., stop monitoring after several failed attempts.
  }
}

/**
 * Issue a command to skip the currently playing track. After
 * skipping, wait a moment and then recheck the current track.
 */
async function skipTrack() {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    updateStatus('Authentication error. Please log in again.');
    return;
  }
  try {
    await fetch('https://api.spotify.com/v1/me/player/next', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    // After skipping, immediately check what's playing next
    setTimeout(checkPlayback, 1000);
  } catch (error) {
    console.error('Error skipping track:', error);
  }
}