document.addEventListener('DOMContentLoaded', () => {
    // Check for auth token on page load
    const token = localStorage.getItem('admin_auth_token');
    if (!token) {
        // If no token, redirect to login page immediately
        window.location.href = '/admin-login.html';
        return;
    }

    // Cache for search functionality
    let allSubmissions = [];
    let allOfficialArtists = [];

    // If token exists, load the data
    loadSubmissions();
    loadOfficialArtists();

    // Setup logout button
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('admin_auth_token');
        window.location.href = '/admin-login.html';
    });

    // Setup search listeners
    document.getElementById('submission-search').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = allSubmissions.filter(s => s.name.toLowerCase().includes(searchTerm));
        renderSubmissions(filtered);
    });

    document.getElementById('official-artist-search').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = allOfficialArtists.filter(a => a.name.toLowerCase().includes(searchTerm));
        renderOfficialArtists(filtered);
    });
});

function renderSubmissions(submissions) {
    const submissionsListDiv = document.getElementById('submissions-list');
    if (submissions.length === 0) {
        submissionsListDiv.innerHTML = '<p>No matching submissions found.</p>';
        return;
    }
    submissionsListDiv.innerHTML = '';
    submissions.forEach(submission => {
        const card = document.createElement('div');
        card.className = 'submission-card';
        card.innerHTML = `
            <h4>${submission.name}</h4>
            <p><strong>Spotify ID:</strong> ${submission.spotify_id}</p>
            <p><a href="https://open.spotify.com/artist/${submission.spotify_id}" target="_blank">View on Spotify</a></p>
            <div class="actions">
                <button class="approve-btn" data-id="${submission.id}">Approve</button>
                <button class="reject-btn" data-id="${submission.id}">Reject</button>
            </div>
        `;
        submissionsListDiv.appendChild(card);
    });
    // Re-add event listeners after rendering
    document.querySelectorAll('.approve-btn').forEach(button => {
        button.addEventListener('click', () => handleManageSubmission(button.dataset.id, 'approve'));
    });
    document.querySelectorAll('.reject-btn').forEach(button => {
        button.addEventListener('click', () => handleManageSubmission(button.dataset.id, 'reject'));
    });
}

async function loadSubmissions() {
    const submissionsListDiv = document.getElementById('submissions-list');
    submissionsListDiv.innerHTML = '<p>Loading submissions...</p>';
    const token = localStorage.getItem('admin_auth_token');

    try {
        const response = await fetch('/api/submissions', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            // Token is invalid or expired, redirect to login
            localStorage.removeItem('admin_auth_token');
            window.location.href = '/admin-login.html';
            return;
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch submissions: ${response.statusText}`);
        }
        const data = await response.json();

        if (!data.submissions || data.submissions.length === 0) {
            submissionsListDiv.innerHTML = '<p>No pending submissions found.</p>';
            allSubmissions = [];
            return;
        }

        allSubmissions = data.submissions;
        renderSubmissions(allSubmissions);

    } catch (error) {
        console.error("Error loading submissions:", error);
        submissionsListDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
}

function renderOfficialArtists(artists) {
    const officialListDiv = document.getElementById('official-artists-list');
    if (artists.length === 0) {
        officialListDiv.innerHTML = '<p>No matching artists found.</p>';
        return;
    }
    officialListDiv.innerHTML = '';
    artists.forEach(artist => {
        const card = document.createElement('div');
        card.className = 'submission-card'; // Reuse existing style
        card.innerHTML = `
            <h4>${artist.name}</h4>
            <p><strong>Spotify ID:</strong> ${artist.spotify_id}</p>
            <div class="actions">
                <button class="delete-btn button-danger" data-id="${artist.id}">Delete Artist</button>
            </div>
        `;
        officialListDiv.appendChild(card);
    });
    // Re-add event listeners after rendering
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', () => handleDeleteArtist(button.dataset.id));
    });
}

async function loadOfficialArtists() {
    const officialListDiv = document.getElementById('official-artists-list');
    officialListDiv.innerHTML = '<p>Loading official list...</p>';
    const token = localStorage.getItem('admin_auth_token');

    try {
        const response = await fetch('/api/artists', { // No auth needed for GET, but good practice for admin panels
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error(`Failed to fetch artists: ${response.statusText}`);
        const data = await response.json();

        if (!data.artists || data.artists.length === 0) {
            officialListDiv.innerHTML = '<p>No artists on the official watchlist.</p>';
            allOfficialArtists = [];
            return;
        }

        allOfficialArtists = data.artists;
        renderOfficialArtists(allOfficialArtists);

    } catch (error) {
        console.error("Error loading official artists:", error);
        officialListDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
}


async function handleManageSubmission(submissionId, action) {
    const token = localStorage.getItem('admin_auth_token');
    if (!token) {
        window.location.href = '/admin-login.html';
        return;
    }

    try {
        const response = await fetch('/api/submissions/manage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ submissionId, action }),
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.message || 'Failed to manage submission.');
        }

        // Reload the submissions list to reflect the change
        loadSubmissions();
        if (action === 'approve') {
            loadOfficialArtists(); // Refresh official list if approved
        }

    } catch (error) {
        console.error(`Error trying to ${action} submission:`, error);
        alert(`Failed to ${action} submission: ${error.message}`);
    }
}

async function handleDeleteArtist(artistId) {
    if (!confirm('Are you sure you want to permanently delete this artist?')) {
        return;
    }

    const token = localStorage.getItem('admin_auth_token');
    if (!token) {
        window.location.href = '/admin-login.html';
        return;
    }

    try {
        const response = await fetch(`/api/artists/${artistId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.message || 'Failed to delete artist.');
        }

        // Reload both lists to be safe
        loadOfficialArtists();

    } catch (error) {
        console.error('Error deleting artist:', error);
        alert(`Failed to delete artist: ${error.message}`);
    }
}
