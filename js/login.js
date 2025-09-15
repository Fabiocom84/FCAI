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
            const response = await fetch(`${API_BASE_URL}/api/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Login riuscito, salva TUTTI i dati ricevuti
                localStorage.setItem('authToken', JSON.stringify(data.session));
                localStorage.setItem('currentUserProfile', JSON.stringify(data.user_profile));
                window.location.href = 'index.html'; 
            }  else {
                // Mostra l'errore restituito dal backend (es. "Credenziali non valide")
                errorMessage.textContent = data.error || 'Si è verificato un errore.';
            }

        } catch (error) {
            console.error("Errore durante la comunicazione con il server:", error);
            errorMessage.textContent = 'Impossibile connettersi al server. Riprova più tardi.';
        }
    }

    loginForm.addEventListener('submit', handleLogin);
});