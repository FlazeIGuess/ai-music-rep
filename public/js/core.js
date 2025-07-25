import { loadArtists, handleSearch } from './artists.js';
import { loadDailySong } from './daily-song.js';
import { initReportForm } from './report.js';

/**
 * Initializes core functionalities that do not require user consent.
 * This includes loading the artist list, the daily song, and setting up search.
 */
function initCore() {
    console.log("Initializing core functionalities (artist list, daily song)...");

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    } else {
        console.warn('Search input not found.');
    }

    loadArtists();
    loadDailySong();
    initReportForm(); // Initialize the report form
}

// Ensure the DOM is fully loaded before trying to access elements.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCore);
} else {
    // DOM is already ready, call immediately.
    initCore();
}
