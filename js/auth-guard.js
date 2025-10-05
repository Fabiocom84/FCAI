// js/auth-guard.js (Versione con segnale)

import { supabase } from './supabase-client.js';

async function verifyAuth() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        console.log("AuthGuard: Sessione valida trovata.");
        // Invia il segnale di "via libera" a tutta la pagina
        document.dispatchEvent(new Event('auth-verified'));
        return;
    }
    
    // Se non c'è sessione, reindirizza (logica semplificata)
    console.log("AuthGuard: Nessuna sessione. Reindirizzamento al login.");
    window.location.replace('login.html');
}

verifyAuth();