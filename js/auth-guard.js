// js/auth-guard.js (Versione Definitiva)
import { supabase } from './supabase-client.js';

window.currentSession = null;

window.authReady = new Promise(resolve => {
    async function verifyAuth() {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (session && !error) {
            console.log("AuthGuard: Sessione valida trovata e salvata globalmente.");
            window.currentSession = session; // Salva la sessione valida
            resolve(session); // Passa l'intera sessione alla promessa
        } else {
            console.log("AuthGuard: Nessuna sessione valida. Reindirizzamento al login.");
            window.location.replace('login.html');
        }
    }
    verifyAuth();
});