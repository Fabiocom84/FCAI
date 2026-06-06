// js/auth-guard.js (Versione Finale Definitiva)
const token = localStorage.getItem('session_token');
if (!token) {
    window.location.replace('login.html');
}

// [OPTIMIZATION] Registra Service Worker per cache assets statici
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}