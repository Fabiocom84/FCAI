// js/config.js
let baseUrl = 'https://segretario-ai-backend-service-460205196659.europe-west1.run.app';

// Se il sito viene aperto dal link di staging, usa il server di staging
if (window.location.hostname.includes('staging')) {
    baseUrl = 'https://segretario-ai-backend-staging-460205196659.europe-west1.run.app';
} 
// Se lo apri sul tuo computer locale (es. con Live Server)
else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // baseUrl = 'http://127.0.0.1:8080'; // Decommenta questo se in futuro testerai con il server python locale
}

export const API_BASE_URL = baseUrl;