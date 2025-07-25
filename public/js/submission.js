// Handling submission of new blocked artists via the report form.
//
// Users can submit artists they believe should be added to the
// watchlist.  This module takes care of sending the report to the
// backend, updating the status indicator and disabling the submit
// button for a cooldown period to prevent spam.

import { API_BASE } from './config.js';
import { updateStatus } from './utils.js';

/**
 * Handle the report form submission.  Prevent the default form
 * submission, send the payload to the server and provide
 * feedback to the user.  A cooldown timer disables the submit
 * button for 10 seconds after submission.
 *
 * @param {Event} evt The submit event
 */
export async function handleSubmission(evt) {
  evt.preventDefault();
  const form = evt.target;
  const submitButton = form.querySelector('button[type="submit"]');
  const name = document.getElementById('artist-name').value;
  const link = document.getElementById('spotify-link').value;
  updateStatus('Submitting report...', true);
  // Disable the button to prevent multiple submissions
  submitButton.disabled = true;
  const payload = { artistName: name, spotifyLink: link };
  console.log('Submitting to', API_BASE + '/submit', payload);
  try {
    const res = await fetch(API_BASE + '/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    console.log('Server responded:', res.status, res.statusText, text);
    const json = JSON.parse(text);
    if (!res.ok) throw new Error(json.message || 'Submission failed.');
    const successMessage = 'Thank you! Your submission has been received.';
    alert(successMessage);
    updateStatus(successMessage);
    form.reset();
  } catch (err) {
    console.error('Submission error:', err);
    alert(`Error: ${err.message}`);
    updateStatus(`Error: ${err.message}`);
  } finally {
    // Start a 10‑second cooldown
    let countdown = 10;
    submitButton.textContent = `Wait ${countdown}s`;
    const interval = setInterval(() => {
      countdown--;
      submitButton.textContent = `Wait ${countdown}s`;
      if (countdown <= 0) {
        clearInterval(interval);
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Report';
      }
    }, 1000);
  }
}