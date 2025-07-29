/**
 * Loads the "Song of the Day" from the backend and displays it.
 */
export async function loadDailySong() {
    const dailySongSection = document.getElementById('daily-song');
    if (!dailySongSection) return;

    // The API is on the same server, so we can use a relative path.
    const API_BASE_URL = '/api';

    try {
        const response = await fetch(`${API_BASE_URL}/daily-song`);
        if (!response.ok) {
            if (response.status === 404) {
                dailySongSection.innerHTML = '<h2><i class="fas fa-music"></i> Song of the Day</h2><p>The song of the day has not been selected yet. Check back later!</p>';
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return;
        }
        const song = await response.json();
        displayDailySong(song);
    } catch (error) {
        console.error('Error loading daily song:', error);
        dailySongSection.innerHTML = '<h2><i class="fas fa-music"></i> Song of the Day</h2><p>Could not load the song of the day.</p>';
    }
}

/**
 * Renders the daily song data into the DOM.
 * @param {object} song - The song data from the API.
 */
function displayDailySong(song) {
    const dailySongSection = document.getElementById('daily-song');
    if (!song || !song.spotify_url) {
        dailySongSection.innerHTML = '<h2><i class="fas fa-music"></i> Song of the Day</h2><p>Could not load the song of the day.</p>';
        return;
    }

    dailySongSection.innerHTML = `
        <div class="daily-song-container expanded">
            <h2><i class="fas fa-music"></i> Song of the Day</h2>
            <a href="${song.spotify_url}" target="_blank" rel="noopener noreferrer" class="daily-song-link">
                <div class="daily-song-content">
                    <img src="${song.image_url}" alt="Album art for ${song.song_name}" class="album-art">
                    <div class="song-details">
                        <h3>${song.song_name}</h3>
                        <p>${song.artist_name}</p>
                    </div>
                </div>
            </a>
        </div>
    `;

    // Function to update the display state based on scroll position
    function updateDailySongDisplayState() {
        // Only apply scroll behavior on mobile screens (max-width: 768px)
        if (window.matchMedia('(max-width: 768px)').matches) {
            const dailySongSection = document.getElementById('daily-song');
            if (!dailySongSection) return;

            // Determine scroll threshold (e.g., 100px from the top)
            const scrollThreshold = 100;

            if (window.scrollY > scrollThreshold) {
                dailySongSection.classList.remove('expanded');
                dailySongSection.classList.add('collapsed');
            } else {
                dailySongSection.classList.remove('collapsed');
                dailySongSection.classList.add('expanded');
            }
        } else {
            // Ensure it's always expanded on desktop if the window is resized
            const dailySongSection = document.getElementById('daily-song');
            if (dailySongSection) {
                dailySongSection.classList.remove('collapsed');
                dailySongSection.classList.add('expanded');
            }
        }
    }

    // Set initial state on page load
    updateDailySongDisplayState();

    // Add scroll event listener
    window.addEventListener('scroll', updateDailySongDisplayState);
}