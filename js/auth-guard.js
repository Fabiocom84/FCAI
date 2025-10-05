// js/auth-guard.js (Versione Finale)
const hash = window.location.hash;

// Caso 1: Siamo appena arrivati dal login con un token nell'URL
if (hash && hash.startsWith('#token=')) {
    const token = hash.substring(7); // Estrae il token dall'URL
    console.log("AuthGuard: Token trovato nell'URL. Lo salvo...");
    localStorage.setItem('custom_session_token', token);
    
    // Pulisce l'URL per nascondere il token e ricarica la pagina in modo pulito
    window.location.replace(window.location.pathname);
} else {
    // Caso 2: Caricamento normale della pagina, controlliamo lo storage
    const token = localStorage.getItem('custom_session_token');
    if (!token) {
        console.log("AuthGuard: Nessun token trovato. Reindirizzo al login.");
        window.location.replace('login.html');
    } else {
        console.log("AuthGuard: Token trovato nello storage. Accesso consentito.");
    }
}