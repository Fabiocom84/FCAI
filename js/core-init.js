// js/core-init.js

// 1. RECUPERO SINCRONO E SICURO DEL PROFILO
// Questo viene eseguito PRIMA di tutto il resto.
const profileStr = localStorage.getItem('user_profile');
let _isAdmin = false;

if (profileStr) {
    try {
        const user = JSON.parse(profileStr);
        // Normalizzazione: accetta true, "true", 1, "1"
        const raw = user.is_admin;
        if (raw === true || raw === "true" || raw === 1 || raw === "1") {
            _isAdmin = true;
        }
    } catch (e) {
        console.error("CoreInit: Errore lettura profilo", e);
    }
}

// Esportiamo solo la verità: Sei Admin? Sì/No.
export const IsAdmin = _isAdmin;