// js/api-client.js (Versione Finale)

import { API_BASE_URL } from './config.js';

export async function apiFetch(url, options = {}) {
    const headers = { ...options.headers };

    // Usa il "testimone" (la sessione) che la guardia ha già verificato e salvato.
    if (window.currentSession && window.currentSession.access_token) {
        headers['Authorization'] = `Bearer ${window.currentSession.access_token}`;
    } else {
        // Questo errore non dovrebbe mai accadere, ma è una sicurezza in più.
        throw new Error("Chiamata API fallita: la sessione non è stata inizializzata correttamente.");
    }

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const fullUrl = `${API_BASE_URL}${url}`;
    const response = await fetch(fullUrl, { ...options, headers });

    return response;
}