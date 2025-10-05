// js/auth-guard.js (Versione Corretta e Completa)

import { supabase } from './supabase-client.js';

// Creiamo una "promessa" che verrà mantenuta quando l'autenticazione sarà verificata.
// La esponiamo globalmente su 'window' per massima compatibilità,
// ma la esportiamo anche per un uso moderno con i moduli.
window.authReady = new Promise(resolve => {
    async function verifyAuth() {
        // Chiediamo a Supabase se esiste già una sessione valida
        const { data: { session }, error } = await supabase.auth.getSession();

        // Se troviamo una sessione e non ci sono errori, l'utente è autenticato.
        if (session && !error) {
            console.log("AuthGuard: Sessione valida trovata. L'applicazione può partire.");
            // Manteniamo la promessa, passando l'intera sessione come risultato.
            // Questo permette agli altri script di accedere ai dati dell'utente.
            resolve(session); 
            return;
        }
        
        // Se non troviamo una sessione, l'utente non è autorizzato.
        console.log("AuthGuard: Nessuna sessione trovata. Reindirizzamento al login.");
        // Reindirizziamo immediatamente alla pagina di login.
        window.location.replace('login.html');
    }

    // Eseguiamo la funzione di verifica non appena lo script viene caricato.
    verifyAuth();
});

// Esportiamo la promessa per permettere ad altri file (come main.js e commesse.js)
// di importarla direttamente e attendere il suo completamento.
export const authReady = window.authReady;