// js/api-client.js (Versione Definitiva)

import { API_BASE_URL } from './config.js';

export async function apiFetch(url, options = {}) {
    const headers = { ...options.headers };

    // Ora non chiediamo più la sessione, la leggiamo dalla variabile globale
    // che auth-guard.js ha preparato per noi.
    if (window.currentSession && window.currentSession.access_token) {
        headers['Authorization'] = `Bearer ${window.currentSession.access_token}`;
    } else {
        // Se per qualche motivo la sessione non c'è, lanciamo un errore.
        // Questo non dovrebbe succedere grazie alla guardia.
        throw new Error("Impossibile effettuare la chiamata API: sessione non trovata.");
    }

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const fullUrl = `${API_BASE_URL}${url}`;
    const response = await fetch(fullUrl, { ...options, headers });

    return response;
}