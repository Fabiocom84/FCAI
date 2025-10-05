// js/auth-guard.js (Versione Finale)

import { supabase } from './supabase-client.js';

// Definiamo la variabile globale che conterrà la sessione
window.currentSession = null;

window.authReady = new Promise(resolve => {
    async function verifyAuth() {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (session && !error) {
            console.log("AuthGuard: Sessione valida trovata. L'applicazione può partire.");
            window.currentSession = session; // Salviamo la sessione valida
            resolve(session); // Passiamo l'intera sessione, non solo l'utente
        } else {
            console.log("AuthGuard: Nessuna sessione trovata. Reindirizzamento al login.");
            window.location.replace('login.html');
        }
    }
    verifyAuth();
});