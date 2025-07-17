// js/modal-manager.js

(function() {
    const modalOverlay = document.getElementById('modalOverlay');
    let openElementCount = 0; // Contatore unificato per modali e leggende

    // Funzione per mostrare l'overlay
    window.showOverlay = function() {
        openElementCount++;
        if (modalOverlay) {
            modalOverlay.style.display = 'block';
        }
    };

    // Funzione per nascondere l'overlay
    window.hideOverlay = function() {
        if (openElementCount > 0) {
            openElementCount--;
        }

        // Nascondi l'overlay solo se nessun modale o leggenda è più aperto
        if (openElementCount === 0 && modalOverlay) {
            modalOverlay.style.display = 'none';
        }
    };

    // Listener per chiudere l'overlay al click diretto sull'overlay stesso.
    // Questo chiuderà la leggenda attiva se non ci sono modali aperti.
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (event) => {
            if (event.target === modalOverlay) {
                // Se non ci sono modali aperti, ma ci sono leggende aperte,
                // tenta di chiudere la leggenda attiva tramite il legendManager.
                // La chiamata a hideOverlay() all'interno di legendManager si occuperà del contatore.
                if (window.getOpenModalCount() === 0 && window.legendManager && window.legendManager.isLegendOpen()) {
                    window.legendManager.hide(window.legendManager.activeLegendId);
                }
                // Se, dopo aver gestito le leggende, il conteggio è zero, hideOverlay lo nasconderà.
                window.hideOverlay();
            }
        });
    }

    // Aggiungi un metodo per ottenere lo stato degli elementi aperti (utile per il debug)
    // Ho mantenuto `getOpenModalCount` e aggiunto `getOpenLegendCount` per chiarezza,
    // ma la logica interna si basa su `openElementCount`.
    // In un'implementazione più complessa, potresti voler mantenere contatori separati
    // e gestirli in show/hide per un controllo più granulare.
    // Per questa configurazione attuale, basta che questi riflettano lo stato globale dell'overlay.
    window.getOpenModalCount = function() {
        // Questa funzione ora serve a dare un'indicazione se ci sono modali aperti
        // basandosi su una convenzione o su come i tuoi modali chiamano show/hide.
        // Se tutti gli elementi chiamano show/hide, openElementCount è sufficiente.
        // Se vuoi distinguere, avresti bisogno di un contatore separato per i modali e le leggende.
        // Per semplicità e coerenza con la classe Legend, useremo openElementCount come indicatore principale.
        // Tuttavia, per un'informazione specifica sui "modali" in contrasto con le "leggende",
        // potresti voler passare un flag a show/hide.
        // Per ora, torniamo al contatore unificato per l'overlay.
        return openElementCount; // Questo riflette il numero totale di elementi che mantengono l'overlay attivo
    };

    // Puoi rimuovere window.getOpenLegendCount() da qui se usi un contatore unificato
    // a meno che tu non abbia un bisogno specifico di sapere solo quante leggende sono aperte
    // senza modificare show/hide per accettare un flag 'isLegend'.

})(); // Funzione anonima auto-invocante per incapsulare le variabili
console.log('Modal manager loaded.');
