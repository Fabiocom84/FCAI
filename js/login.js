// js/login.js

import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const passwordInput = document.getElementById('loginPassword');
    const togglePasswordBtn = document.getElementById('togglePassword');

    if (!loginForm) return;

    togglePasswordBtn?.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePasswordBtn.src = type === 'text' ? 'img/eye-off.png' : 'img/eye.png';
    });

    async function handleLogin(event) {
        event.preventDefault();
        errorMessage.style.display = 'none';
        const email = loginForm.email.value;
        const password = loginForm.password.value;

        try {
            // Usiamo il metodo di login ufficiale di Supabase.
            const { error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            // Se Supabase restituisce un errore, lo mostriamo e ci fermiamo.
            if (error) throw error;

            // Se il login ha successo, Supabase (grazie alla configurazione corretta
            // in supabase-client.js) salva automaticamente la sessione.
            // L'unica cosa che dobbiamo fare è reindirizzare alla pagina principale.
            window.location.href = 'index.html';

        } catch (error) {
            errorMessage.textContent = error.message || 'Credenziali non valide.';
            errorMessage.style.display = 'block';
        }
    }

    loginForm.addEventListener('submit', handleLogin);
});