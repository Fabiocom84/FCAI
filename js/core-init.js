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

// 2. NORMALIZZAZIONE DEL RUOLO
//
// PERCHE' STA QUI
// La derivazione del ruolo era ripetuta in sei punti del frontend, in due
// varianti incompatibili, e tre di esse erano SBAGLIATE:
//
//     CurrentUser?.ruoli?.[0]?.nome_ruolo || CurrentUser?.ruolo || ''
//
// `personale.id_ruolo_fk -> ruoli` è una relazione molti-a-uno, quindi PostgREST
// restituisce un OGGETTO e non un array: `ruoli[0]` è sempre undefined. Il
// ripiego su `CurrentUser.ruolo` non funziona perché quel campo esiste nel JWT,
// non nel profilo salvato in localStorage. Risultato: ruolo vuoto e impiegati
// respinti da manutenzioni.html, commesse.html e nuova-commessa.html, mentre
// main.js — che gestiva entrambe le forme — mostrava loro il pulsante.
// Un difetto preesistente alla Fase 0, reso evidente dal fatto che il proprietario
// normalmente accede come amministratore.
//
// Da qui in avanti esiste UNA sola implementazione.
function _estraiRuolo(profilo) {
    if (!profilo) return '';

    const relazione = profilo.ruoli;
    let nome = '';

    if (Array.isArray(relazione)) {
        nome = relazione.length ? (relazione[0].nome_ruolo || '') : '';
    } else if (relazione && typeof relazione === 'object') {
        nome = relazione.nome_ruolo || '';
    }

    // Ripiego: alcuni profili salvati in passato contengono il ruolo piatto.
    if (!nome && typeof profilo.ruolo === 'string') nome = profilo.ruolo;

    return String(nome).trim().toLowerCase();
}

const _ruolo = _estraiRuolo(_currentUser);

// 3. EXPORT DELLE VARIABILI
export const CurrentUser = _currentUser;
export const IsAdmin = _isAdmin;

/** Ruolo dell'utente, minuscolo e senza spazi. Stringa vuota se assente. */
export const Ruolo = _ruolo;

/** L'utente ha il ruolo Impiegato (indipendentemente da IsAdmin). */
export const IsImpiegato = _ruolo === 'impiegato';

/** Accesso alle aree riservate a impiegati e amministratori. */
export const HasAccessoImpiegato = _isAdmin || _ruolo === 'impiegato';