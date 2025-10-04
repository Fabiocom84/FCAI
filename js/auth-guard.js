// js/auth-guard.js

import { supabase } from './supabase-client.js';

// Funzione di controllo più robusta
async function checkAuthWithPatience() {
    // Il client Supabase ha bisogno di un momento per processare il token
    // che arriva nell'URL da un magic link.
    // Attendiamo l'evento 'INITIAL_SESSION' che ci dice quando ha finito.
    const { data: { session } } = await supabase.auth.getSession();

    // Se troviamo subito una sessione (utente già loggato), tutto ok.
    if (session) {
        console.log("Sessione valida trovata immediatamente dalla guardia:", session.user.email);
        return;
    }

    // Se non c'è una sessione, potrebbe essere in arrivo dal magic link.
    // Diamo al client un'ultima possibilità aspettando l'evento SIGNED_IN.
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        // Se arriva l'evento di login, l'utente è dentro.
        // Possiamo smettere di ascoltare e considerare il controllo superato.
        if (event === 'SIGNED_IN') {
            console.log("Sessione creata con successo dal magic link/redirect.");
            authListener.subscription.unsubscribe();
        }
    });

    // Per sicurezza, se dopo un breve periodo non è successo nulla,
    // significa che non c'era una sessione valida né un magic link.
    // Solo a questo punto reindirizziamo al login.
    setTimeout(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                console.log("Nessuna sessione trovata dopo l'attesa, reindirizzamento al login...");
                window.location.replace('login.html');
            }
        });
    }, 1000); // Aspettiamo 1 secondo
}

// Esegui il nuovo controllo.
checkAuthWithPatience();