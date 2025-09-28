import { API_BASE_URL } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    if (!loginForm) {
        console.error('Elemento form di login non trovato.');
        return;
    }

    async function handleLogin(event) {
        event.preventDefault();
        errorMessage.textContent = '';

        const email = loginForm.email.value;
        const password = loginForm.password.value;

        if (!email || !password) {
            errorMessage.textContent = 'Inserire sia email che password.';
            return;
        }

        try {
            // 1. PRIMA CHIAMATA: AUTENTICAZIONE
            const authResponse = await fetch(`${API_BASE_URL}/api/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const authData = await authResponse.json();
            if (!authResponse.ok) {
                throw new Error(authData.error || 'Credenziali non valide.');
            }
            
            // Salva subito la sessione (che contiene il token)
            const session = authData.session;
            localStorage.setItem('authToken', JSON.stringify(session));

            // 2. SECONDA CHIAMATA: RECUPERO PROFILO (autenticata con il token)
            const profileResponse = await fetch(`${API_BASE_URL}/api/me`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            const profileData = await profileResponse.json();
            if (!profileResponse.ok) {
                throw new Error(profileData.error || 'Impossibile recuperare il profilo utente.');
            }

            // 3. SALVA IL PROFILO E REINDIRIZZA
            localStorage.setItem('currentUserProfile', JSON.stringify(profileData));
            window.location.href = 'index.html';

        } catch (error) {
            console.error("Errore durante il processo di login:", error);
            errorMessage.textContent = error.message;
            // Pulisci il token se qualcosa è andato storto
            localStorage.removeItem('authToken');
        }
    }

    loginForm.addEventListener('submit', handleLogin);
});