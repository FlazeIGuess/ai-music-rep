// Configuration constants for the application.
// These values centralize the various URIs and other settings used
// throughout the codebase so they can be easily adjusted without
// hunting through multiple files.

/**
 * Determine the correct Redirect URI based on the hostname.
 * For local development, it uses localhost. For the live site,
 * it uses the production URL.
 * @returns {string} The appropriate redirect URI.
 */
function getRedirectUri() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Always use localhost for local development to ensure consistency
        return `${window.location.protocol}//localhost:${window.location.port}/`;
    } else {
        // Use the production URL for the live site
        return 'https://ai-musician-list.tanzstoff.de/';
    }
}

export const REDIRECT_URI = getRedirectUri();
export const ADMIN_EMAIL = 'admin@example.com';

// All API calls are made relative to this base.  If the backend
// endpoint ever moves, you only need to update this value.
export const API_BASE = '/api';