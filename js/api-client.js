// js/api-client.js

import { API_BASE_URL } from './config.js';
import { supabase } from './supabase-client.js';

/**
 * Esegue una chiamata fetch sicura verso il backend, includendo automaticamente
 * il token di autenticazione di Supabase.
 * @param {string} url - L'endpoint dell'API da chiamare (es. '/api/registrazioni').
 * @param {object} options - Le opzioni standard della funzione fetch (method, body, etc.).
 * @returns {Promise<Response>} La risposta dalla fetch.
 */
export async function apiFetch(url, options = {}) {
    // Estraiamo la nostra nuova opzione. Di default, le chiamate sono private.
    const isPublic = options.isPublic || false;
    
    const headers = { ...options.headers };

    // Se la chiamata NON è pubblica, eseguiamo i controlli di sicurezza
    if (!isPublic) {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
            console.error("Sessione non valida o scaduta. Rilevato da apiFetch.");
            throw new Error("La tua sessione non è valida. Effettua nuovamente il login.");
        }
        headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const fullUrl = `${API_BASE_URL}${url}`;
    
    // Rimuoviamo la nostra opzione custom prima di fare la chiamata fetch
    delete options.isPublic;
    
    const response = await fetch(fullUrl, { ...options, headers });

    if (response.status === 401) {
        // Se il token scade, Supabase lo rinfresca in automatico.
        // Se anche il refresh fallisce, il prossimo getSession() darà errore.
        console.warn("Ricevuto 401 dal backend. Il token potrebbe essere scaduto.");
    }

    return response;
}