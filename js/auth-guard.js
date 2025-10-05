// js/auth-guard.js (Versione con Promise)

import { supabase } from './supabase-client.js';

// Creiamo una "promessa" che verrà mantenuta quando l'autenticazione sarà verificata.
// La esponiamo globalmente per renderla accessibile agli altri script.
window.authReady = new Promise(resolve => {
    async function verifyAuth() {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            console.log("AuthGuard: Sessione valida trovata. Autenticazione completata.");
            resolve(session.user); // Manteniamo la promessa e passiamo i dati dell'utente
            return;
        }
        
        console.log("AuthGuard: Nessuna sessione. Reindirizzamento al login.");
        window.location.replace('login.html');
    }

    verifyAuth();
});