// js/modal-manager.js

// LE CINQUE FUNZIONI DI QUESTO FILE NON SONO PIU' SU `window` — task 4.9,
// 10/09/2026. Stanno dentro la IIFE, che e' esattamente il loro ambito d'uso:
// nessuna pagina le nomina in un `onclick` (verificato su tutti i 21 file) e
// nessun altro modulo le legge. Erano globali per abitudine, non per bisogno.

(function() {
    const modalOverlay = document.getElementById('modalOverlay');
    let openElementCount = 0; // Contatore unificato per modali e leggende

    // Funzione per mostrare l'overlay
    function showOverlay() {
        openElementCount++;
        if (modalOverlay) {
            modalOverlay.classList.add('is-open');
            console.log(`Overlay mostrato. Elementi aperti: ${openElementCount}`);
        }
    }

    // Funzione per nascondere l'overlay
    function hideOverlay() {
        if (openElementCount > 0) {
            openElementCount--;
        }

        // Nascondi l'overlay solo se nessun modale o leggenda è più aperto
        if (openElementCount === 0 && modalOverlay) {
            modalOverlay.classList.remove('is-open');
            console.log(`Overlay nascosto. Elementi aperti: ${openElementCount}`);
        }
    }

    // Funzione generica per aprire un modale (o una leggenda, dato che usano lo stesso overlay)
    function openGenericElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('is-open');
            showOverlay();
            document.body.classList.add('modal-open'); // Disabilita scroll del body
            console.log(`Elemento ${elementId} aperto.`);
        } else {
            console.error(`Errore: Elemento con ID ${elementId} non trovato.`);
        }
    }

    // Funzione generica per chiudere un modale (o una leggenda)
    function closeGenericElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove('is-open');
            hideOverlay();
            // Controlla se ci sono ancora modali/leggende aperti prima di rimuovere modal-open dal body
            if (openElementCount === 0) {
                document.body.classList.remove('modal-open');
            }
            console.log(`Elemento ${elementId} chiuso.`);
        } else {
            console.warn(`Tentativo di chiudere un elemento non esistente con ID ${elementId}.`);
        }
    }

    // Funzione per chiudere TUTTI i modali e le leggende attualmente aperti
    function closeAllOpenElements() {
        document.querySelectorAll('.modal.is-open, .legend.is-open').forEach(element => {
            element.classList.remove('is-open');
        });
        openElementCount = 0; // Reset diretto del contatore
        hideOverlay(); // Forza la chiusura dell'overlay
        document.body.classList.remove('modal-open');
        console.log('Tutti gli elementi (modali/leggende) e overlay chiusi.');
    }

    // Listener per chiudere l'overlay al click diretto sull'overlay stesso.
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (event) => {
            if (event.target === modalOverlay) {
                closeAllOpenElements();
            }
        });
    }

    // RIMOSSA l'09/09/2026 (task 4.9): `window.getOpenElementCount`, che
    // restituiva `openElementCount`. Nessuna lettura in nessuna forma — né da
    // JavaScript, né da un attributo `onclick`, né per nome costruito. Era
    // dichiarata "utile per il debug" e in debug non l'ha usata nessuno.

    // --- Inizializzazione degli Event Listener per i Pulsanti di Apertura Modali ---
    document.addEventListener('DOMContentLoaded', () => {
        // Pulsante "Inserisci Dati"
        const openInsertDataModalBtn = document.getElementById('openInsertDataModalBtn');
        if (openInsertDataModalBtn) {
            openInsertDataModalBtn.addEventListener('click', (event) => {
                event.preventDefault(); // Impedisce il comportamento di default del link
                openGenericElement('insertDataModal');
            });
        } else {
            console.warn('Pulsante #openInsertDataModalBtn non trovato.');
        }

        // Pulsante "Chat AI"
        const openChatModalBtn = document.getElementById('openChatModalBtn');
        if (openChatModalBtn) {
            openChatModalBtn.addEventListener('click', (event) => {
                event.preventDefault();
                openGenericElement('chatModal');
            });
        } else {
            console.warn('Pulsante #openChatModalBtn non trovato.');
        }

        // Pulsante "Nuova Commessa"
        const openNewOrderModalBtn = document.getElementById('openNewOrderModalBtn');
        if (openNewOrderModalBtn) {
            openNewOrderModalBtn.addEventListener('click', (event) => {
                event.preventDefault();
                openGenericElement('newOrderModal');
            });
        } else {
            console.warn('Pulsante #openNewOrderModalBtn non trovato.');
        }

        // Pulsante "Knowledge Logs" (updateAIDbBtn)
        const updateAIDbBtn = document.getElementById('updateAIDbBtn');
        if (updateAIDbBtn) {
            updateAIDbBtn.addEventListener('click', (event) => {
                event.preventDefault();
                openGenericElement('knowledgeLogsModal');
                
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
                    closeGenericElement(parentModal.id);
                } else if (parentLegend) {
                    closeGenericElement(parentLegend.id);
                }
            });
        });
    });

})(); // Funzione anonima auto-invocante
console.log('Modal manager loaded and listeners initialized.');