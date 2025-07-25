// Centralized application state.
//
// Because this project is a single‑page application that manipulates
// various pieces of state (like the access token, whether monitoring
// is active, which artists have been blocked, etc.), it's helpful to
// keep those values in one place.  The `state` object can be imported
// and mutated by other modules.  This approach avoids passing a large
// number of variables around via function arguments and makes it
// obvious where to find the current application state.

export const state = {
  /**
   * The current Spotify access token.  If the user is not logged in
   * this will be null.  When a new token is obtained via the PKCE
   * flow, this property is updated and persisted in localStorage.
   */
  accessToken: null,

  /**
   * A set of blocked artist IDs.  When the list of all artists is
   * loaded from the backend the IDs are collected into this set so
   * checking whether a playing artist is forbidden is efficient.
   */
  blockedArtistIds: new Set(),

  /**
   * Whether the application is currently monitoring the user's
   * playback.  Toggling monitoring will start or stop polling the
   * Spotify API.
   */
  isMonitoring: false,

  /**
   * Holds the ID returned by setInterval when monitoring is active.
   * This ID is used to clear the interval when monitoring stops.
   */
  monitoringInterval: null,

  /**
   * The ID of the currently playing track.  Used to determine
   * whether a track has changed since the last poll so we don't
   * repeatedly skip the same track.
   */
  currentTrackId: null,

  /**
   * A timer ID used to debounce input events, such as when a user
   * pastes a Spotify URL into the report form.
   */
  debounceTimer: null,

  /**
   * A set of submission IDs the user has already voted for.  This
   * state is persisted in localStorage so votes remain disabled
   * across page reloads.
   */
  votedForIds: new Set(JSON.parse(localStorage.getItem('voted_for_ids') || '[]')),

  /**
   * Cache of all artists fetched from the backend.  This array is
   * used to implement client‑side searching without issuing
   * additional network requests on each keystroke.
   */
  allArtists: [],

  /**
   * The Spotify client ID supplied by the user.  This value is
   * retrieved from localStorage on load and updated when the user
   * saves a new client ID.
   */
  userClientId: localStorage.getItem('user_spotify_client_id') || null
};

/**
 * Updates the status message in the UI.
 * @param {string} message - The message to display.
 */
export function updateStatus(message) {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = `Status: ${message}`;
  }
  console.log(`Status update: ${message}`);
}