import { API_BASE_URL } from './config.js';

export async function publicApiFetch(url, options = {}) {
    const headers = { ...options.headers };

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const fullUrl = `${API_BASE_URL}${url}`;
    const response = await fetch(fullUrl, { ...options, headers });
    return response;
}

export async function apiFetch(url, options = {}) {
    const headers = { ...options.headers };

    // CORREZIONE: Usiamo un'unica chiave coerente 'session_token'
    const token = localStorage.getItem('session_token');
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    } else {
        console.error("Auth: Token mancante. Reindirizzo al login.");
        localStorage.clear(); // Pulisce tutto per sicurezza
        window.location.replace('login.html');
        throw new Error("Token mancante.");
    }

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const fullUrl = `${API_BASE_URL}${url}`;
    const response = await fetch(fullUrl, { ...options, headers });

    // Gestione scadenza token
    if (response.status === 401) {
        console.error("Auth: Token scaduto o non valido (401).");
        localStorage.removeItem('session_token'); // CORRETTO: rimuove la chiave giusta
        localStorage.removeItem('user_profile');
        window.location.replace('login.html');
    }
    
    return response;
}