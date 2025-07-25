/**
 * Handles the logic for the artist submission form.
 */

function handleSpotifyLinkInput(event) {
    const artistNameInput = document.getElementById('artist-name');
    const url = event.target.value;
    const match = url.match(/artist\/([a-zA-Z0-9]+)/);

    if (match && artistNameInput) {
        // This is a simple placeholder; a real implementation would fetch the artist name
        // from the Spotify API using the extracted ID. For now, we just indicate it's found.
        // Note: A client-side API call here would require a token.
        // A server-side call would be better for privacy.
        console.log('Spotify Artist ID found:', match[1]);
    }
}

async function handleSubmission(event) {
    event.preventDefault();
    const form = event.target;
    const artistName = form.elements['artist-name'].value;
    const spotifyLink = form.elements['spotify-link'].value;
    const submitButton = form.querySelector('button[type="submit"]');

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    try {
        const response = await fetch('/api/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artistName, spotifyLink })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'An unknown error occurred.');
        }

        alert('Thank you! Your submission has been received and will be reviewed.');
        form.reset();

    } catch (error) {
        console.error('Submission error:', error);
        alert(`Submission failed: ${error.message}`);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Report';
    }
}

/**
 * Initializes the report form listeners.
 */
export function initReportForm() {
    const submissionForm = document.getElementById('submission-form');
    if (submissionForm) {
        submissionForm.addEventListener('submit', handleSubmission);
    }

    const spotifyLinkInput = document.getElementById('spotify-link');
    if (spotifyLinkInput) {
        spotifyLinkInput.addEventListener('input', handleSpotifyLinkInput);
    }
}
