// js/login.js

import { API_BASE_URL } from './config.js';

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
        // Cambia l'icona in base alla visibilità (logica semplificata)
        togglePasswordBtn.src = type === 'text' ? 'img/eye-off.png' : 'img/eye.png'; // Assicurati di avere l'immagine eye-off.png
        togglePasswordBtn.alt = type === 'text' ? 'Nascondi password' : 'Mostra password';
    });

    async function handleLogin(event) {
        event.preventDefault();
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';

        const email = loginForm.email.value;
        const password = loginForm.password.value;
        const rememberMe = document.getElementById('rememberMe').checked;
        const storage = rememberMe ? localStorage : sessionStorage;

        if (!email || !password) {
            errorMessage.textContent = 'Inserire sia email che password.';
            errorMessage.style.display = 'block';
            return;
        }

        try {
            // 1. AUTENTICAZIONE
            const authResponse = await fetch(`${API_BASE_URL}/api/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const authData = await authResponse.json();
            if (!authResponse.ok) {
                throw new Error(authData.error || 'Credenziali non valide.');
            }

            // --- INIZIO MODIFICA CHIAVE ---
            // Estraiamo l'oggetto 'session' annidato dalla risposta del backend.
            const session = authData.session;
            if (!session || !session.access_token) {
                throw new Error("La risposta di autenticazione non contiene una sessione valida.");
            }
            // --- FINE MODIFICA CHIAVE ---

            // 2. RECUPERO PROFILO
            const profileResponse = await fetch(`${API_BASE_URL}/api/me`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            const profileData = await profileResponse.json();
            if (!profileResponse.ok) {
                throw new Error(profileData.error || 'Impossibile recuperare il profilo utente.');
            }

            // 3. SALVATAGGIO E REINDIRIZZAMENTO
            localStorage.clear();
            sessionStorage.clear();

            storage.setItem('authToken', JSON.stringify(session)); // Ora salviamo l'oggetto corretto
            storage.setItem('currentUserProfile', JSON.stringify(profileData));
            
            window.location.href = 'index.html';

        } catch (error) {
            console.error("Errore durante il processo di login:", error);
            errorMessage.textContent = error.message;
            errorMessage.style.display = 'block';
            localStorage.clear();
            sessionStorage.clear();
        }
    }

    loginForm.addEventListener('submit', handleLogin);
});