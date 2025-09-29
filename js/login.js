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
        
        // --- INIZIO MODIFICA CHIAVE ---
        const rememberMe = document.getElementById('rememberMe').checked;
        // Selezioniamo dove salvare i dati: localStorage per "ricordami", sessionStorage altrimenti.
        const storage = rememberMe ? localStorage : sessionStorage;
        // --- FINE MODIFICA CHIAVE ---

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
            
            // La sessione è l'intero oggetto restituito, che contiene il token
            const session = authData; 
            
            // 2. RECUPERO PROFILO (autenticato con il token appena ottenuto)
            const profileResponse = await fetch(`${API_BASE_URL}/api/me`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            const profileData = await profileResponse.json();
            if (!profileResponse.ok) {
                throw new Error(profileData.error || 'Impossibile recuperare il profilo utente.');
            }

            // --- MODIFICA CHIAVE: SALVATAGGIO ROBUSTO ---
            // Pulisci entrambi gli storage per evitare conflitti
            localStorage.clear();
            sessionStorage.clear();

            // Salva sessione e profilo nello storage corretto (localStorage o sessionStorage)
            storage.setItem('authToken', JSON.stringify(session));
            storage.setItem('currentUserProfile', JSON.stringify(profileData));
            
            // 3. REINDIRIZZAMENTO
            window.location.href = 'index.html';

        } catch (error) {
            console.error("Errore durante il processo di login:", error);
            errorMessage.textContent = error.message;
            errorMessage.style.display = 'block';
            // Pulisci tutto in caso di errore
            localStorage.clear();
            sessionStorage.clear();
        }
    }

    loginForm.addEventListener('submit', handleLogin);
});