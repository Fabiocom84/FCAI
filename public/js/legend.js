// js/legend.js

class Legend {
    constructor() {
        this.activeLegendId = null; // Per tenere traccia di quale leggenda è aperta
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Seleziona tutti i pulsanti di aiuto che hanno un attributo data-legend
        const buttons = document.querySelectorAll('.help-button[data-legend]');
        buttons.forEach(button => {
            button.addEventListener('click', this.handleClick.bind(this));
        });

        // Aggiungi un listener globale al documento per chiudere la leggenda se si clicca fuori da essa
        document.addEventListener('click', (event) => {
            if (this.activeLegendId) {
                const legendElement = document.getElementById(this.activeLegendId);
                const helpButton = document.querySelector(`.help-button[data-legend="${this.activeLegendId}"]`);

                // Se la leggenda è visibile e il click non è sul pulsante o all'interno della leggenda
                if (legendElement && legendElement.style.display === 'block' && 
                    !legendElement.contains(event.target) &&
                    (!helpButton || !helpButton.contains(event.target))) { // Verifica che helpButton esista
                    this.hide(this.activeLegendId);
                }
            }
        });
    }

    handleClick(event) {
        event.stopPropagation(); // Impedisce al click di propagarsi al document e chiudere subito la leggenda
        const legendId = event.target.dataset.legend;

        if (legendId) {
            // Se la leggenda cliccata è già quella attiva e visibile, la nascondi
            const currentLegendElement = document.getElementById(legendId);
            if (this.activeLegendId === legendId && currentLegendElement && currentLegendElement.style.display === 'block') {
                this.hide(legendId);
            } else {
                // Se c'è un'altra leggenda attiva, nascondila prima di aprirne una nuova
                if (this.activeLegendId && this.activeLegendId !== legendId) {
                    this.hide(this.activeLegendId);
                }
                // Mostra la nuova leggenda
                this.show(legendId);
            }
        }
    }

    show(legendId) {
        const legendElement = document.getElementById(legendId);
        if (legendElement) {
            legendElement.style.display = 'block';
            this.activeLegendId = legendId; // Imposta la leggenda come attiva
            
            // Incrementa il contatore dell'overlay, che ora è centralizzato in main.js
            if (typeof window.showOverlay === 'function') {
                window.showOverlay(); 
            } else {
                console.warn('window.showOverlay non è definita. Assicurati che main.js sia caricato correttamente.');
            }
            console.log(`Legenda "${legendId}" aperta.`);
        } else {
            console.error(`Legenda con ID "${legendId}" non trovata.`);
        }
    }

    hide(legendId) {
        const legendElement = document.getElementById(legendId);
        if (legendElement) {
            legendElement.style.display = 'none';
            if (this.activeLegendId === legendId) {
                this.activeLegendId = null; // Rimuovi la leggenda attiva
            }
            
            // Decrementa il contatore dell'overlay, che ora è centralizzato in main.js
            if (typeof window.hideOverlay === 'function') {
                window.hideOverlay();
            } else {
                console.warn('window.hideOverlay non è definita. Assicurati che main.js sia caricato correttamente.');
            }
            console.log(`Legenda "${legendId}" chiusa.`);
        } else {
            console.error(`Legenda con ID "${legendId}" non trovata.`);
        }
    }

    // Metodo pubblico per essere chiamato da altri script se necessario
    // per sapere se una leggenda è aperta.
    isLegendOpen() {
        return this.activeLegendId !== null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Rendi l'istanza della classe Legend disponibile globalmente
    // così altri script (es. modal-manager.js, anche se ora l'overlay è gestito in main.js)
    // possono interagire con essa.
    if (!window.legendManager) {
        window.legendManager = new Legend();
        console.log('Legend Manager inizializzato.');
    } else {
        console.warn('Legend Manager già inizializzato.');
    }
});