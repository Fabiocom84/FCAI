// js/shared-ui.js

/**
 * Mostra un modale di conferma personalizzato.
 * @param {object} options - Opzioni per il modale (title, message, etc.)
 * @returns {Promise<boolean>} Risolve a true se l'utente conferma, false altrimenti.
 */
export function showModal(options) {
    return new Promise(resolve => {
        const modal = document.getElementById('std-modal');
        const overlay = document.getElementById('std-modal-overlay');
        const titleEl = document.getElementById('std-modal-title');
        const messageEl = document.getElementById('std-modal-message');
        const buttonsEl = document.getElementById('std-modal-buttons');
        const headerEl = modal.querySelector('.modal-header') || titleEl.parentElement; // Fallback

        if (!modal || !overlay) {
            console.error("Elementi del modale custom non trovati.");
            return resolve(false);
        }

        // 1. Reset Stili Base
        headerEl.className = 'modal-header';
        titleEl.textContent = options.title || 'Attenzione';
        messageEl.textContent = options.message || '';
        buttonsEl.innerHTML = '';

        // 2. Gestione Tipo (Successo, Errore, Warning)
        let confirmBtnClass = 'std-btn std-btn--primary'; // Default Verde (Successo/Azione)
        if (options.type === 'error') {
            confirmBtnClass = 'std-btn std-btn--danger'; // Rosso
            headerEl.classList.add('error-header'); // Opzionale per CSS futuro
        } else if (options.type === 'warning') {
            confirmBtnClass = 'std-btn std-btn--warning'; // Giallo
        }

        // Sovrascrittura manuale classe
        if (options.confirmClass) confirmBtnClass = options.confirmClass;

        // 3. Creazione Pulsante Conferma
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = options.confirmText || 'OK';
        confirmBtn.className = confirmBtnClass;
        confirmBtn.onclick = () => {
            overlay.style.display = 'none';
            resolve(true);
        };
        buttonsEl.appendChild(confirmBtn);

        // 4. Creazione Pulsante Annulla (se richiesto)
        if (options.cancelText) {
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = options.cancelText;
            cancelBtn.className = 'std-btn std-btn--ghost'; // Grigio/Bianco
            cancelBtn.onclick = () => {
                overlay.style.display = 'none';
                resolve(false);
            };
            buttonsEl.appendChild(cancelBtn);
        }

        overlay.style.display = 'flex';
    });
}

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

export function closeSuccessFeedbackModal() {
    clearInterval(countdownInterval);
    clearTimeout(closeTimeout);

    if (feedbackModal) feedbackModal.style.display = 'none';

    const modalOverlay = document.getElementById('modalOverlay');
    const parentModalCloseFunction = parentModalToClose ? window[`close${parentModalToClose.id.charAt(0).toUpperCase() + parentModalToClose.id.slice(1)}`] : null;

    if (parentModalCloseFunction) {
        parentModalCloseFunction();
    } else if (parentModalToClose) {
        parentModalToClose.style.display = 'none';
        if (modalOverlay) modalOverlay.style.display = 'none';
    } else {
        if (modalOverlay) modalOverlay.style.display = 'none';
    }
}