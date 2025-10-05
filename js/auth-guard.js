// js/auth-guard.js (Versione Finale Definitiva)
const token = localStorage.getItem('session_token');
if (!token) {
    window.location.replace('login.html');
}