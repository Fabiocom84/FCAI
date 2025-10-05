// js/auth-guard.js
// La guardia ora controlla solo la nostra chiave, non la sessione di Supabase
const token = localStorage.getItem('custom_session_token');
if (!token) {
    window.location.replace('login.html');
}