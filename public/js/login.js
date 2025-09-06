// File: js/login.js

document.addEventListener('DOMContentLoaded', () => {
    // Seleziona il form di login dopo che il DOM è stato caricato
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

async function handleLogin(event) {
    event.preventDefault();
    const errorMessageDiv = document.getElementById('errorMessage');
    errorMessageDiv.style.display = 'none'; // Nascondi il messaggio di errore precedente

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;

    // L'URL del backend dovrebbe essere centralizzato in un file di configurazione,
    // ma per ora lo lasciamo qui per chiarezza.
    const authUrl = `${window.BACKEND_URL || 'https://fcai-tau.vercel.app'}/api/auth`;

    try {
        const response = await fetch(authUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: username, password: password, rememberMe: rememberMe })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `Errore HTTP: ${response.status}`);
        }

        if (data.success && data.token) {
            console.log('Autenticazione riuscita!');
            // Salva il token in base alla scelta dell'utente
            if (rememberMe) {
                localStorage.setItem('authToken', data.token);
            } else {
                sessionStorage.setItem('authToken', data.token);
            }
            // Reindirizza alla pagina principale
            window.location.href = 'index.html';
        } else {
            throw new Error(data.message || 'Credenziali non valide fornite dal server.');
        }

    } catch (error) {
        console.error('Errore durante la comunicazione con il server:', error);
        errorMessageDiv.textContent = error.message;
        errorMessageDiv.style.display = 'block';
    }
}