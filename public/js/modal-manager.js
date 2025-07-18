// js/modal-manager.js

(function() {
    const modalOverlay = document.getElementById('modalOverlay');
    let openElementCount = 0; // Contatore unificato per modali e leggende

    // Funzione per mostrare l'overlay
    window.showOverlay = function() {
        openElementCount++;
        if (modalOverlay) {
            modalOverlay.classList.add('is-open');
            console.log(`Overlay mostrato. Elementi aperti: ${openElementCount}`);
        }
    };

    // Funzione per nascondere l'overlay
    window.hideOverlay = function() {
        if (openElementCount > 0) {
            openElementCount--;
        }

        // Nascondi l'overlay solo se nessun modale o leggenda è più aperto
        if (openElementCount === 0 && modalOverlay) {
            modalOverlay.classList.remove('is-open');
            console.log(`Overlay nascosto. Elementi aperti: ${openElementCount}`);
        }
    };

    // Funzione generica per aprire un modale (o una leggenda, dato che usano lo stesso overlay)
    window.openGenericElement = function(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('is-open');
            window.showOverlay();
            document.body.classList.add('modal-open'); // Disabilita scroll del body
            console.log(`Elemento ${elementId} aperto.`);
        } else {
            console.error(`Errore: Elemento con ID ${elementId} non trovato.`);
        }
    };

    // Funzione generica per chiudere un modale (o una leggenda)
    window.closeGenericElement = function(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove('is-open');
            window.hideOverlay();
            // Controlla se ci sono ancora modali/leggende aperti prima di rimuovere modal-open dal body
            if (openElementCount === 0) {
                document.body.classList.remove('modal-open');
            }
            console.log(`Elemento ${elementId} chiuso.`);
        } else {
            console.warn(`Tentativo di chiudere un elemento non esistente con ID ${elementId}.`);
        }
    };

    // Funzione per chiudere TUTTI i modali e le leggende attualmente aperti
    window.closeAllOpenElements = function() {
        document.querySelectorAll('.modal.is-open, .legend.is-open').forEach(element => {
            element.classList.remove('is-open');
        });
        openElementCount = 0; // Reset diretto del contatore
        window.hideOverlay(); // Forza la chiusura dell'overlay
        document.body.classList.remove('modal-open');
        console.log('Tutti gli elementi (modali/leggende) e overlay chiusi.');
    };

    // Listener per chiudere l'overlay al click diretto sull'overlay stesso.
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (event) => {
            if (event.target === modalOverlay) {
                window.closeAllOpenElements();
            }
        });
    }

    // Aggiungi un metodo per ottenere lo stato degli elementi aperti (utile per il debug)
    window.getOpenElementCount = function() {
        return openElementCount;
    };

    // --- Inizializzazione degli Event Listener per i Pulsanti di Apertura Modali ---
    document.addEventListener('DOMContentLoaded', () => {
        // Pulsante "Inserisci Dati"
        const openInsertDataModalBtn = document.getElementById('openInsertDataModalBtn');
        if (openInsertDataModalBtn) {
            openInsertDataModalBtn.addEventListener('click', (event) => {
                event.preventDefault(); // Impedisce il comportamento di default del link
                window.openGenericElement('insertDataModal');
            });
        } else {
            console.warn('Pulsante #openInsertDataModalBtn non trovato.');
        }

        // Pulsante "Chat AI"
        const openChatModalBtn = document.getElementById('openChatModalBtn');
        if (openChatModalBtn) {
            openChatModalBtn.addEventListener('click', (event) => {
                event.preventDefault();
                window.openGenericElement('chatModal');
            });
        } else {
            console.warn('Pulsante #openChatModalBtn non trovato.');
        }

        // Pulsante "Nuova Commessa"
        const openNewOrderModalBtn = document.getElementById('openNewOrderModalBtn');
        if (openNewOrderModalBtn) {
            openNewOrderModalBtn.addEventListener('click', (event) => {
                event.preventDefault();
                window.openGenericElement('newOrderModal');
            });
        } else {
            console.warn('Pulsante #openNewOrderModalBtn non trovato.');
        }

        // Pulsante "Knowledge Logs" (updateAIDbBtn)
        const updateAIDbBtn = document.getElementById('updateAIDbBtn');
        if (updateAIDbBtn) {
            updateAIDbBtn.addEventListener('click', (event) => {
                event.preventDefault();
                window.openGenericElement('knowledgeLogsModal');
                
                // Logica specifica per l'aggiornamento della KB (spostata qui da main.js)
                updateAIDbBtn.disabled = true;
                updateAIDbBtn.querySelector('img').src = 'img/loading.gif'; // Immagine di caricamento
                updateAIDbBtn.title = 'Aggiornamento in corso...';
                
                // Avvia il processo di aggiornamento nel backend
                // Assicurati che initiateKnowledgeBaseUpdate sia globale (come lo è nel tuo main.js attuale)
                if (typeof window.initiateKnowledgeBaseUpdate === 'function') {
                    window.initiateKnowledgeBaseUpdate();
                } else {
                    console.error('La funzione window.initiateKnowledgeBaseUpdate non è disponibile. Assicurati che main.js la renda globale.');
                    // Fallback in caso di errore: riabilita il pulsante
                    updateAIDbBtn.disabled = false;
                    updateAIDbBtn.querySelector('img').src = 'img/reload.png';
                    updateAIDbBtn.title = 'Aggiorna Knowledge Base AI';
                }
            });
        } else {
            console.warn('Pulsante #updateAIDbBtn (per Knowledge Logs) non trovato.');
        }

        // Gestione dei pulsanti di chiusura (X) di tutti i modali
        document.querySelectorAll('.modal .close-button, .legend .close-button').forEach(button => {
            button.addEventListener('click', () => {
                const parentModal = button.closest('.modal');
                const parentLegend = button.closest('.legend');
                if (parentModal) {
                    window.closeGenericElement(parentModal.id);
                } else if (parentLegend) {
                    window.closeGenericElement(parentLegend.id);
                }
            });
        });
    });

})(); // Funzione anonima auto-invocante
console.log('Modal manager loaded and listeners initialized.');