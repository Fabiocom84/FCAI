// js/auth-guard.js (Versione Definitiva)

import { supabase } from './supabase-client.js';

async function verifyAuth() {
    // 1. Controlla se esiste già una sessione valida.
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        console.log("AuthGuard: Sessione valida trovata.", session.user.email);
        return; // L'utente è loggato, la guardia ha finito il suo lavoro.
    }

    // 2. Se non c'è sessione, controlla se siamo appena arrivati da un link speciale (login, magic link, etc.)
    // La funzione handleSessionFromUrl() rileva il token nell'URL, crea la sessione e lo rimuove dall'URL.
    try {
        const { error } = await supabase.auth.handleRedirectReturn();
        if (!error) {
             // Se non ci sono errori, significa che la sessione potrebbe essere stata appena creata.
             // Facciamo un ultimo controllo.
             const { data: { session: newSession } } = await supabase.auth.getSession();
             if (newSession) {
                 console.log("AuthGuard: Sessione creata con successo dal redirect.");
                 // Ricarichiamo la pagina per assicurarci che l'app parta con lo stato corretto.
                 window.location.replace(window.location.pathname);
                 return;
             }
        }
    } catch (e) {
        // Ignoriamo errori se non c'è nulla da processare, è normale.
    }

    // 3. Se dopo tutti i controlli non c'è ancora una sessione, l'utente non è autorizzato.
    console.log("AuthGuard: Nessuna sessione valida. Reindirizzamento al login.");
    window.location.replace('login.html');
}

// Eseguiamo il controllo non appena lo script viene caricato.
verifyAuth();