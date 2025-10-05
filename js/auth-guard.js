// js/auth-guard.js (Versione Definitiva e Corretta)

import { supabase } from './supabase-client.js';

window.authReady = new Promise(resolve => {
    async function verifyAuth() {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            console.log("AuthGuard: Sessione valida trovata. L'applicazione può partire.");
            resolve(session.user); // Manteniamo la promessa per avviare gli script delle pagine
        } else {
            console.log("AuthGuard: Nessuna sessione trovata. Reindirizzamento al login.");
            window.location.replace('login.html');
        }
    }
    verifyAuth();
});