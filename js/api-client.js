// js/api-client.js (Versione Definitiva)
import { API_BASE_URL } from './config.js';

export async function apiFetch(url, options = {}) {
    const headers = { ...options.headers };

    // Usa la sessione che la guardia ha già verificato. Niente più controlli qui.
    if (window.currentSession && window.currentSession.access_token) {
        headers['Authorization'] = `Bearer ${window.currentSession.access_token}`;
    } else {
        throw new Error("Chiamata API fallita: la sessione non è stata inizializzata correttamente da auth-guard.");
    }

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const fullUrl = `${API_BASE_URL}${url}`;
    const response = await fetch(fullUrl, { ...options, headers });

    // Se otteniamo un 401, significa che il token è davvero scaduto.
    // L'utente verrà reindirizzato al login al prossimo caricamento pagina.
    if (response.status === 401) {
        console.error("Il backend ha restituito 401. Il token potrebbe essere definitivamente scaduto.");
    }
    
    return response;
}