let consentedAppModule = null;

/**
 * Loads the main application logic that requires consent.
 */
async function loadConsentedApp() {
    if (consentedAppLoaded) return;
    consentedAppLoaded = true;
    console.log('%cConsent for "spotify-login" received. Loading main application logic...', 'color: #4CAF50; font-weight: bold;');
    try {
        // Dynamically import the app module and store it
        consentedAppModule = await import('/js/app.js');
        console.log('%cMain application module (app.js) loaded successfully.', 'color: #4CAF50;');

        if (consentedAppModule.initializeApp) {
            consentedAppModule.initializeApp();
            console.log('Consented app initialized.');
        } else {
            console.error('initializeApp function not found in app.js module.');
        }
    } catch (error) {
        console.error('Failed to load or initialize main application module after consent:', error);
    }
}

/**
 * This function is registered as a callback with ccm19.
 * It's called whenever the consent status is initialized or changed.
 */
function handleConsent() {
    console.log('[ccm19] handleConsent callback fired.');
    if (window.CCM && typeof window.CCM.areIntegrationsPermitted === 'function') {
        const isPermitted = window.CCM.areIntegrationsPermitted(['spotify-login']);
        console.log(`[ccm19] Is 'spotify-login' permitted? -> ${isPermitted}`);

        if (isPermitted) {
            loadConsentedApp();
        } else {
            console.log('[ccm19] Consent for "spotify-login" has been revoked or not given.');
            if (consentedAppModule && consentedAppModule.shutdownConsentedApp) {
                consentedAppModule.shutdownConsentedApp();
            }
            // Reset state in case the app was loaded before
            consentedAppLoaded = false;
            consentedAppModule = null;
        }
    } else {
        console.warn('[ccm19] handleConsent was called, but CCM object or required functions are not available.');
    }
}

/**
 * Main entry point.
 */
// ... (main function remains the same) ...
