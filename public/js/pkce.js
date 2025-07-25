// Helpers for the PKCE (Proof Key for Code Exchange) OAuth flow.
//
// Spotify's authorization code flow with PKCE requires generation
// of a cryptographically random code verifier and a derived code
// challenge.  These helpers encapsulate that logic so the
// authentication module remains focused on high‑level user flow.

/**
 * Generate a random string of the given length using
 * alphanumeric characters.  This string is used as the
 * code verifier in the PKCE flow.
 *
 * @param {number} length The desired length of the string
 * @returns {string} A random string
 */
export function generateRandomString(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Compute a code challenge for the given code verifier.  The
 * challenge is the Base64URL‑encoded SHA‑256 hash of the verifier.
 *
 * @param {string} codeVerifier The code verifier
 * @returns {Promise<string>} A promise resolving to the code challenge
 */
export async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}