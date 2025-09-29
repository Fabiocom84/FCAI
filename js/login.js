// js/login.js

// NOTA: Non importiamo più API_BASE_URL perché non chiameremo il nostro backend.
// Importiamo direttamente il client Supabase.
import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    if (!loginForm) {
        console.error('Elemento form di login non trovato.');
        return;
    }

    const passwordInput = document.getElementById('loginPassword');
    const togglePasswordBtn = document.getElementById('togglePassword');

    togglePasswordBtn.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePasswordBtn.src = type === 'text' ? 'img/eye-off.png' : 'img/eye.png';
        togglePasswordBtn.alt = type === 'text' ? 'Nascondi password' : 'Mostra password';
    });

    async function handleLogin(event) {
        event.preventDefault();
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';

        const email = loginForm.email.value;
        const password = loginForm.password.value;

        if (!email || !password) {
            errorMessage.textContent = 'Inserire sia email che password.';
            errorMessage.style.display = 'block';
            return;
        }

        try {
            // --- INIZIO MODIFICA CHIAVE ---
            // Usiamo il metodo di login del client Supabase direttamente qui nel frontend.
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            // Se Supabase restituisce un errore (es. credenziali errate), lo mostriamo.
            if (error) {
                throw new Error(error.message || 'Credenziali non valide.');
            }

            // Se il login ha successo, Supabase salva automaticamente la sessione
            // nel modo corretto. Non dobbiamo fare più nulla manualmente.
            
            // L'evento 'onAuthStateChange' in main.js verrà attivato automaticamente.
            
            // Ora recuperiamo il profilo utente per salvarlo (opzionale ma utile)
            const { data: profileData, error: profileError } = await supabase
                .from('personale')
                .select('*')
                .eq('id_auth_user', data.user.id)
                .single();

            if (profileError) {
                throw new Error("Login riuscito, ma impossibile recuperare il profilo utente.");
            }

            // Salviamo il profilo per un accesso rapido, come prima.
            // La checkbox "rememberMe" non è più necessaria perché il client Supabase
            // gestisce la persistenza della sessione in modo predefinito.
            localStorage.setItem('currentUserProfile', JSON.stringify(profileData));

            // Ora possiamo reindirizzare alla pagina principale.
            window.location.href = 'index.html';
            // --- FINE MODIFICA CHIAVE ---

        } catch (error) {
            console.error("Errore durante il processo di login:", error);
            errorMessage.textContent = error.message;
            errorMessage.style.display = 'block';
            // Puliamo lo storage in caso di errore per sicurezza.
            localStorage.clear();
            sessionStorage.clear();
        }
    }

    loginForm.addEventListener('submit', handleLogin);
});