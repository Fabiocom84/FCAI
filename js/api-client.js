// js/api-client.js (Versione Finale Definitiva)

import { API_BASE_URL } from './config.js';

/**
 * Funzione per le chiamate API PUBBLICHE (es. login).
 * Non controlla la sessione e non invia token.
 */
export async function publicApiFetch(url, options = {}) {
    const headers = { ...options.headers };

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const fullUrl = `${API_BASE_URL}${url}`;
    const response = await fetch(fullUrl, { ...options, headers });

    return response;
}


/**
 * Funzione per le chiamate API PRIVATE (autenticate).
 * Controlla che esista una sessione e invia il token.
 */
export async function apiFetch(url, options = {}) {
    const headers = { ...options.headers };

    if (window.currentSession && window.currentSession.access_token) {
        headers['Authorization'] = `Bearer ${window.currentSession.access_token}`;
    } else {
        throw new Error("Chiamata API fallita: la sessione non è stata inizializzata correttamente.");
    }

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const fullUrl = `${API_BASE_URL}${url}`;
    const response = await fetch(fullUrl, { ...options, headers });

    return response;
}