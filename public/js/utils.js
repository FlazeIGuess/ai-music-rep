// Utility helpers for UI interactions.
//
// The application has a small set of helper functions that don't
// logically belong to any one feature area.  Keeping them here
// prevents circular dependencies and centralizes common patterns,
// such as updating the status text shown to the user.

/**
 * Update the status message displayed in the application.  If a
 * loading indicator should be shown, set the appropriate CSS class.
 *
 * @param {string} msg The text to display
 * @param {boolean} [loading=false] Whether to add the 'loading' class
 */
export function updateStatus(msg, loading = false) {
  const el = document.getElementById('status');
  if (!el) return;
  el.innerHTML = msg;
  el.className = loading ? 'loading' : '';
}