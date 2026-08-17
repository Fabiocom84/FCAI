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

// Template PDF del modulo presenze, servito da un bucket Storage pubblico.
//
// Punta al progetto di PRODUZIONE anche quando il sito gira su staging: il
// bucket `templates` esiste solo là. È una dipendenza incrociata nota e
// deliberata, non una dimenticanza — modificare il template in produzione lo
// cambia anche su staging.
//
// Per chiuderla servono due cose: creare il bucket `templates` su staging con
// una copia del modulo, e rendere questa costante dipendente dall'ambiente come
// baseUrl qui sopra. Rientra nella stessa famiglia del task 2.9 (riferimenti a
// file indipendenti dall'ambiente).
export const TEMPLATE_PRESENZE_URL =
    'https://mqfhsiezsorpdnskcsgw.supabase.co/storage/v1/object/public/templates/modello_presenze.pdf';