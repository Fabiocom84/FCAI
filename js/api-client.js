// js/api-client.js

import { API_BASE_URL } from './config.js';

export async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('session_token');

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers
    };

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    // --- RETRY LOGIC (NUOVO) ---
    // Tentiamo la richiesta fino a 3 volte se fallisce per problemi di rete (non 4xx o 500 applicativi)
    // O se ritorna 502/503/504 (errori gateway/timeout)
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        attempt++;
        try {
            const response = await fetch(url, config);

            // --- GESTIONE DISCONNESSIONE FORZATA ---
            if (response.status === 401 || response.status === 403) {
                console.warn("Sessione non valida o accesso revocato. Eseguo Logout.");
                localStorage.clear();
                window.location.replace('login.html');
                throw new Error("Accesso revocato");
            }

            // Se è un errore server temporaneo (500, 502, 503, 504), lanciamo eccezione per fare retry
            if ([500, 502, 503, 504].includes(response.status)) {
                throw new Error(`Server Error ${response.status}`);
            }

            return response; // Successo o altri codici (es. 404, 500 app logic)

        } catch (error) {
            if (error.message === "Accesso revocato") {
                return new Promise(() => { });
            }

            // Se abbiamo raggiunto i tentativi massimi, rilanciamo l'errore
            if (attempt >= MAX_RETRIES) {
                console.error(`API Fetch failed after ${MAX_RETRIES} attempts:`, error);
                throw error;
            }

            // Backoff esponenziale: aspetta 500ms, 1000ms, ...
            const waitTime = 500 * Math.pow(2, attempt - 1);
            console.warn(`Tentativo ${attempt} fallito. Riprovo tra ${waitTime}ms...`);
            await new Promise(r => setTimeout(r, waitTime));
        }
    }
}

export async function publicApiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    const config = { ...options, headers };
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    // --- RETRY LOGIC (COPIATA DA apiFetch) ---
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        attempt++;
        try {
            const response = await fetch(url, config);

            // Se è un errore server temporaneo (500, 502, 503, 504), lanciamo eccezione per fare retry
            if ([500, 502, 503, 504].includes(response.status)) {
                throw new Error(`Server Error ${response.status}`);
            }

            return response;

        } catch (error) {
            // Se abbiamo raggiunto i tentativi massimi, rilanciamo l'errore
            if (attempt >= MAX_RETRIES) {
                console.error(`Public API Fetch failed after ${MAX_RETRIES} attempts:`, error);
                throw error;
            }

            // Backoff esponenziale: aspetta 500ms, 1000ms, ...
            const waitTime = 500 * Math.pow(2, attempt - 1);
            console.warn(`Public API Tentativo ${attempt} fallito. Riprovo tra ${waitTime}ms...`);
            await new Promise(r => setTimeout(r, waitTime));
        }
    }
}