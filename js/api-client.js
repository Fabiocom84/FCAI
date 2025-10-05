// js/api-client.js (Versione Finale Completa)

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
 * Controlla che esista il nostro token personalizzato e lo invia.
 */
export async function apiFetch(url, options = {}) {
    const headers = { ...options.headers };

    const token = localStorage.getItem('session_token');
    if (token) {
        // Ora usiamo l'header standard 'Authorization'
        headers['Authorization'] = `Bearer ${token}`;
    } else {
        // Se non c'è il token, reindirizza al login
        console.error("apiFetch: Token di sessione personalizzato non trovato. Reindirizzo al login.");
        window.location.replace('login.html');
        throw new Error("Token di sessione personalizzato non trovato.");
    }

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const fullUrl = `${API_BASE_URL}${url}`;
    const response = await fetch(fullUrl, { ...options, headers });

    if (response.status === 401) {
        console.error("Il backend ha restituito 401. Il token personalizzato potrebbe essere scaduto o non valido.");
        // In caso di token non valido, cancelliamo quello vecchio e forziamo un nuovo login
        localStorage.removeItem('custom_session_token');
        window.location.replace('login.html');
    }
    
    return response;
}