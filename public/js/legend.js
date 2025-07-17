// js/legend.js

class Legend {
    constructor() {
        this.legends = {}; // Per tenere traccia delle leggende aperte/chiuse
        this.activeLegendId = null; // Per tenere traccia di quale leggenda è aperta
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Seleziona solo i pulsanti di aiuto che hanno un data-legend attributo
        const buttons = document.querySelectorAll('.help-button[data-legend]');
        buttons.forEach(button => {
            button.addEventListener('click', this.handleClick.bind(this));
        });

        // Aggiungi un listener globale al documento per chiudere la leggenda se si clicca fuori da essa
        // Questo sarà un listener più generico rispetto al click sull'overlay gestito dal modal-manager
        document.addEventListener('click', (event) => {
            // Controlla se c'è una leggenda attiva e se il click non è avvenuto sul pulsante che l'ha aperta
            // o all'interno della leggenda stessa.
            if (this.activeLegendId) {
                const legendElement = document.getElementById(this.activeLegendId);
                const helpButton = document.querySelector(`.help-button[data-legend="${this.activeLegendId}"]`);

                if (legendElement && helpButton &&
                    !legendElement.contains(event.target) &&
                    !helpButton.contains(event.target)) {
                    this.hide(this.activeLegendId);
                }
            }
        });
    }

    handleClick(event) {
        const legendId = event.target.dataset.legend;
        if (legendId) {
            // Se la leggenda cliccata è già quella attiva, nascondila
            if (this.activeLegendId === legendId) {
                this.hide(legendId);
            } else {
                // Se c'è un'altra leggenda attiva, nascondila prima
                if (this.activeLegendId) {
                    this.hide(this.activeLegendId);
                }
                // Mostra la nuova leggenda
                this.show(legendId);
            }
        }
        event.stopPropagation(); // Impedisce al click di propagarsi al document e chiudere subito la leggenda
    }

    show(legendId) {
        const legendElement = document.getElementById(legendId);
        if (legendElement) {
            legendElement.style.display = 'block';
            this.activeLegendId = legendId; // Imposta la leggenda come attiva
            window.showOverlay(true); // Mostra l'overlay, indicando che è una "leggenda"
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
            window.hideOverlay(true); // Nascondi l'overlay, indicando che è una "leggenda"
        } else {
            console.error(`Legenda con ID "${legendId}" non trovata.`);
        }
    }

    // Metodo pubblico per essere chiamato da modal-manager.js o altri script se necessario
    // per sapere se una leggenda è aperta
    isLegendOpen() {
        return this.activeLegendId !== null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Rendi l'istanza della classe Legend disponibile globalmente
    // così modal-manager.js può interagire con essa.
    if (!window.legendManager) {
        window.legendManager = new Legend();
    }
});