// js/auth-guard.js

import { supabase } from './supabase-client.js';

// Questa funzione controlla se esiste una sessione utente valida.
async function checkAuth() {
    const { data, error } = await supabase.auth.getSession();

    // Se c'è un errore o non c'è una sessione attiva (utente non loggato),
    // reindirizza immediatamente alla pagina di login.
    if (error || !data.session) {
        console.log("Nessuna sessione trovata dalla guardia, reindirizzamento al login...");
        window.location.replace('login.html');
    } else {
        // Se la sessione esiste, l'utente è autorizzato a vedere la pagina.
        console.log("Sessione valida trovata dalla guardia:", data.session.user.email);
    }
}

// Esegui il controllo non appena questo script viene caricato.
checkAuth();