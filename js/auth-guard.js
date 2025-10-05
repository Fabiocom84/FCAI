// js/auth-guard.js (Versione Finale Definitiva)
const token = localStorage.getItem('custom_session_token');

if (!token) {
    console.log("AuthGuard: Token non trovato. Reindirizzo al login.");
    window.location.replace('login.html');
} else {
    console.log("AuthGuard: Token trovato. Accesso consentito.");
}