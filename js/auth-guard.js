// js/auth-guard.js (Versione Definitiva)

// La guardia controlla solo la presenza del nostro token personalizzato.
const token = localStorage.getItem('custom_session_token');

if (!token) {
    console.log("AuthGuard: Token personalizzato non trovato. Reindirizzo al login.");
    window.location.replace('login.html');
} else {
    console.log("AuthGuard: Token personalizzato trovato. Accesso consentito.");
}