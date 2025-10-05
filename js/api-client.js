// js/api-client.js (Versione Definitiva e Corretta)

import { API_BASE_URL } from './config.js';
import { supabase } from './supabase-client.js';

export async function apiFetch(url, options = {}) {
    // Chiediamo a Supabase la sessione PIU' RECENTE disponibile, un attimo prima della chiamata.
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    // Se, anche chiedendo ora, non c'è una sessione valida, allora l'utente non è loggato.
    if (sessionError || !session) {
        console.error("apiFetch: Tentativo di chiamata API senza una sessione valida.");
        // Reindirizziamo al login per sicurezza
        window.location.replace('login.html');
        throw new Error("Sessione non valida o scaduta.");
    }

    const headers = { ...options.headers };
    headers['Authorization'] = `Bearer ${session.access_token}`;

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const fullUrl = `${API_BASE_URL}${url}`;
    const response = await fetch(fullUrl, { ...options, headers });

    return response;
}