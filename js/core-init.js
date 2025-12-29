// js/core-init.js
// NUCLEO CENTRALE: Gestisce Utente, Admin e Utility.

// 1. RECUPERO DATI UTENTE
const profileStr = localStorage.getItem('user_profile');
let _currentUser = null;
let _isAdmin = false;

if (profileStr) {
    try {
        _currentUser = JSON.parse(profileStr);
        
        // Verifica minima validità oggetto
        if (!_currentUser || typeof _currentUser !== 'object') {
            throw new Error("Formato profilo non valido");
        }

        // NORMALIZZAZIONE ADMIN (Gestisce 1, "1", true, "true")
        const raw = _currentUser.is_admin;
        if (raw === true || raw === "true" || raw === 1 || raw === "1") {
            _currentUser.is_admin = true;
            _isAdmin = true;
        } else {
            _currentUser.is_admin = false;
            _isAdmin = false;
        }
    } catch (e) {
        console.error("CoreInit: Profilo utente corrotto. Eseguo logout di sicurezza.", e);
        // --- APPLICAZIONE SUGGERIMENTO 1 ---
        // Se il profilo è corrotto, puliamo tutto e rimandiamo al login
        // per evitare che l'app giri in uno stato rotto.
        localStorage.clear();
        window.location.replace('login.html');
    }
}

// 2. EXPORT DELLE VARIABILI
export const CurrentUser = _currentUser;
export const IsAdmin = _isAdmin;