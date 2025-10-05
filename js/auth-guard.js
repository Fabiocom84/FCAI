// js/auth-guard.js (Versione Definitiva)

import { supabase } from './supabase-client.js';

// Definiamo la variabile globale per la sessione
window.currentSession = null;

// La promessa rimane, per segnalare quando il controllo è finito
window.authReady = new Promise(resolve => {
    async function verifyAuth() {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (session && !error) {
            console.log("AuthGuard: Sessione valida trovata e salvata globalmente.");
            // SALVIAMO la sessione valida in una variabile globale
            window.currentSession = session;
            resolve(session.user); // Manteniamo la promessa per avviare le app
            return;
        }
        
        console.log("AuthGuard: Nessuna sessione valida. Reindirizzamento al login.");
        window.location.replace('login.html');
    }

    verifyAuth();
});