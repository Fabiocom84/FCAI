// js/login.js

import { supabase } from './supabase-client.js';

import { publicApiFetch } from './api-client.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const passwordInput = document.getElementById('loginPassword');
    const togglePasswordBtn = document.getElementById('togglePassword');

    if (!loginForm) return;

    togglePasswordBtn?.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePasswordBtn.src = type === 'text' ? 'img/eye.png' : 'img/eye.png';
    });

    async function handleLogin(event) {
        event.preventDefault();
        errorMessage.style.display = 'none';
        const email = loginForm.email.value;
        const password = loginForm.password.value;

        try {
            // 1. Chiamiamo il nostro backend per fare da assistente al login
            const response = await publicApiFetch('/api/assistente-login', {
                method: 'POST',
                body: JSON.stringify({ email: email, password: password }),
                isPublic: true
            });

            const sessionData = await response.json();

            // 2. Se il backend ci dà un errore, lo mostriamo
            if (!response.ok) {
                throw new Error(sessionData.error || 'Credenziali non valide.');
            }

            // 3. Se il backend ci dà i token, li usiamo per impostare la sessione
            const { error } = await supabase.auth.setSession({
                access_token: sessionData.access_token,
                refresh_token: sessionData.refresh_token,
            });

            if (error) {
                throw new Error('Errore nell\'impostare la sessione nel browser.');
            }
            
            // 4. Se tutto è andato bene, andiamo alla pagina principale
            window.location.href = 'index.html';

        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.style.display = 'block';
        }
    }

    loginForm.addEventListener('submit', handleLogin);
});