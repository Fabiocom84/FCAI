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

    try {
        const response = await fetch(url, config);

        // --- GESTIONE DISCONNESSIONE FORZATA ---
        // Se riceviamo 403 (Forbidden), significa che il backend ha rilevato 
        // che l'account è disabilitato (o il token è scaduto/invalido).
        if (response.status === 401 || response.status === 403) {
            console.warn("Sessione non valida o accesso revocato. Eseguo Logout.");
            
            localStorage.clear();
            window.location.replace('login.html');
            
            // Blocca l'esecuzione lanciando un errore silenzioso
            throw new Error("Accesso revocato");
        }

        return response;
    } catch (error) {
        if (error.message === "Accesso revocato") {
            return new Promise(() => {}); // Promise pendente per bloccare la catena
        }
        throw error;
    }
}

export async function publicApiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    const config = { ...options, headers };
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    return fetch(url, config);
}