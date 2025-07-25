document.getElementById('admin-login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = event.target.username.value;
    const password = event.target.password.value;
    const statusElement = document.getElementById('login-status');
    statusElement.textContent = '';

    try {

        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Login failed.');
        }

        localStorage.setItem('admin_auth_token', result.token);
        window.location.href = '/admin.html';

    } catch (error) {
        statusElement.textContent = error.message;
    }
});