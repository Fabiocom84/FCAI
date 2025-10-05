// js/login.js

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
            const response = await publicApiFetch('/api/assistente-login', {
                method: 'POST',
                body: JSON.stringify({ email: email, password: password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Credenziali non valide');

            // NON salviamo più qui. Passiamo il token nell'URL.
            // localStorage.setItem('custom_session_token', data.custom_token);
            window.location.replace(`index.html#token=${data.custom_token}`);

        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.style.display = 'block';
        }
    }

    loginForm.addEventListener('submit', handleLogin);
});