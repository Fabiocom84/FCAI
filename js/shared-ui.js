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