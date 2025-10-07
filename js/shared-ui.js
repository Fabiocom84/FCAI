// js/shared-ui.js

/**
 * Mostra un modale di conferma personalizzato.
 * @param {object} options - Opzioni per il modale (title, message, etc.)
 * @returns {Promise<boolean>} Risolve a true se l'utente conferma, false altrimenti.
 */
export function showModal(options) {
    return new Promise(resolve => {
        const modal = document.getElementById('custom-modal');
        const overlay = document.getElementById('custom-modal-overlay');
        const titleEl = document.getElementById('custom-modal-title');
        const messageEl = document.getElementById('custom-modal-message');
        const buttonsEl = document.getElementById('custom-modal-buttons');

        if (!modal || !overlay) {
            console.error("Elementi del modale custom non trovati.");
            return resolve(false);
        }

        titleEl.textContent = options.title || 'Attenzione';
        messageEl.textContent = options.message || '';
        buttonsEl.innerHTML = ''; // Pulisci i pulsanti precedenti

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = options.confirmText || 'OK';
        confirmBtn.className = 'button';
        confirmBtn.onclick = () => {
            overlay.style.display = 'none';
            resolve(true);
        };
        buttonsEl.appendChild(confirmBtn);

        if (options.cancelText) {
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = options.cancelText;
            cancelBtn.className = 'button button--secondary';
            cancelBtn.onclick = () => {
                overlay.style.display = 'none';
                resolve(false);
            };
            buttonsEl.appendChild(cancelBtn);
        }

        overlay.style.display = 'flex';
    });
}

// Rendiamo la funzione disponibile globalmente
window.showModal = showModal;

let feedbackModal, countdownInterval, closeTimeout, parentModalToClose;

// Esporta la funzione per renderla importabile
export function showSuccessFeedbackModal(title, message, parentModalId) {
    if (!feedbackModal) {
        feedbackModal = document.getElementById('success-feedback-modal');
    }
    if (!feedbackModal) {
        console.error("Elemento del modale di feedback non trovato!");
        return;
    }

    feedbackModal.querySelector('#feedback-modal-title').textContent = title;
    feedbackModal.querySelector('#feedback-modal-message').textContent = message;
    parentModalToClose = document.getElementById(parentModalId);

    const modalOverlay = document.getElementById('modalOverlay');
    feedbackModal.style.display = 'block';
    if (modalOverlay) modalOverlay.style.display = 'block';

    let seconds = 2; 
    const countdownElement = feedbackModal.querySelector('#feedback-modal-countdown');
    countdownElement.textContent = `Questo messaggio si chiuderà tra ${seconds} secondi...`;

    countdownInterval = setInterval(() => {
        seconds--;
        countdownElement.textContent = seconds > 0 ? `Questo messaggio si chiuderà tra ${seconds} secondi...` : '';
        if (seconds <= 0) clearInterval(countdownInterval);
    }, 1000);

    closeTimeout = setTimeout(closeSuccessFeedbackModal, 2000);

    feedbackModal.querySelector('#feedback-modal-close-btn').onclick = closeSuccessFeedbackModal;
    feedbackModal.querySelector('[data-close-feedback]').onclick = closeSuccessFeedbackModal;
}

function closeSuccessFeedbackModal() {
    clearInterval(countdownInterval);
    clearTimeout(closeTimeout);

    if (feedbackModal) feedbackModal.style.display = 'none';

    const modalOverlay = document.getElementById('modalOverlay');
    const parentModalCloseFunction = parentModalToClose ? window[`close${parentModalToClose.id.charAt(0).toUpperCase() + parentModalToClose.id.slice(1)}`] : null;
    
    if (parentModalCloseFunction) {
        parentModalCloseFunction();
    } else if (parentModalToClose) {
        parentModalToClose.style.display = 'none';
        if(modalOverlay) modalOverlay.style.display = 'none';
    } else {
        if(modalOverlay) modalOverlay.style.display = 'none';
    }
}