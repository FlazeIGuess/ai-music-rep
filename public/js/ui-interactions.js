document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('toggle-social-links');
    const socialLinksContainer = document.getElementById('social-links');

    if (toggleButton && socialLinksContainer) {
        toggleButton.addEventListener('click', () => {
            socialLinksContainer.classList.toggle('collapsed');
        });
    }
});
