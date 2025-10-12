// js/registro-presenze.js

/**
 * Gestisce la logica per la pagina del Registro Presenze.
 * @namespace TimelineApp
 */
const TimelineApp = {
    /**
     * Lo stato corrente dell'applicazione, include la data visualizzata.
     * @property {Date} currentDate - La data usata per calcolare il mese da mostrare.
     */
    state: {
        currentDate: new Date(),
    },

    /**
     * Oggetto contenente i riferimenti agli elementi del DOM.
     * @property {HTMLElement} headerRow - La riga dell'intestazione della tabella.
     * @property {HTMLElement} timelineBody - Il corpo della tabella.
     * @property {HTMLElement} currentMonthDisplay - L'elemento H2 che mostra il mese.
     * @property {HTMLElement} prevMonthBtn - Il pulsante per il mese precedente.
     * @property {HTMLElement} nextMonthBtn - Il pulsante per il mese successivo.
     */
    dom: {},

    /**
     * Inizializza l'applicazione, recupera gli elementi del DOM e avvia il rendering.
     */
    init() {
        // Popoliamo l'oggetto dom con gli elementi della pagina
        this.dom.headerRow = document.getElementById('header-row');
        this.dom.timelineBody = document.getElementById('timeline-body');
        this.dom.currentMonthDisplay = document.getElementById('current-month-display');
        this.dom.prevMonthBtn = document.getElementById('prev-month');
        this.dom.nextMonthBtn = document.getElementById('next-month');

        // Aggiungiamo gli event listener per la navigazione tra i mesi
        this.addEventListeners();

        // Avviamo il primo rendering della griglia
        this.render();
    },

    /**
     * Aggiunge gli event listener ai pulsanti di navigazione.
     */
    addEventListeners() {
        this.dom.prevMonthBtn.addEventListener('click', () => this.changeMonth(-1));
        this.dom.nextMonthBtn.addEventListener('click', () => this.changeMonth(1));
    },

    /**
     * Funzione principale che orchestra il rendering della griglia.
     */
    render() {
        console.log("Rendering per il mese:", this.state.currentDate.toLocaleDateString());

        // Aggiorna l'etichetta del mese (es. "OTTOBRE 2025")
        this.updateMonthDisplay();
        
        // Disegna le intestazioni dei giorni (Lun 01, Mar 02, ...)
        this.renderHeaders();

        // Disegna le righe per ogni operatore (per ora con dati finti)
        this.renderRows();
    },
    
    /**
     * Aggiorna il testo dell'elemento H2 con il mese e l'anno correnti.
     */
    updateMonthDisplay() {
        const monthName = this.state.currentDate.toLocaleString('it-IT', { month: 'long' });
        const year = this.state.currentDate.getFullYear();
        this.dom.currentMonthDisplay.textContent = `${monthName.toUpperCase()} ${year}`;
    },

    /**
     * Genera e inserisce le intestazioni (<th>) per ogni giorno del mese.
     */
    renderHeaders() {
        // Pulisce le intestazioni precedenti
        // Manteniamo la prima cella "Operatore" che è statica nell'HTML
        this.dom.headerRow.innerHTML = '<th style="position: -webkit-sticky; position: sticky; left: 0; z-index: 15;">Operatore</th>';

        const year = this.state.currentDate.getFullYear();
        const month = this.state.currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Creiamo un frammento per ottimizzare l'inserimento nel DOM
        const fragment = document.createDocumentFragment();

        for (let i = 1; i <= daysInMonth; i++) {
            const dayDate = new Date(year, month, i);
            
            // Formattiamo il giorno della settimana (es. "Lun")
            const dayOfWeek = dayDate.toLocaleDateString('it-IT', { weekday: 'short' });
            // Formattiamo il numero del giorno con lo zero (es. "01")
            const dayNumber = String(i).padStart(2, '0');

            const th = document.createElement('th');
            th.textContent = `${dayOfWeek} ${dayNumber}`;
            
            // Evidenziamo Sabato e Domenica
            const dayIndex = dayDate.getDay(); // 0 = Domenica, 6 = Sabato
            if (dayIndex === 0 || dayIndex === 6) {
                th.style.backgroundColor = "#e9ecef"; // Un grigio leggero per il weekend
            }

            fragment.appendChild(th);
        }
        
        // Aggiungiamo tutte le nuove intestazioni in una sola operazione
        this.dom.headerRow.appendChild(fragment);
    },

    /**
     * Genera e inserisce le righe per gli operatori.
     * NOTA: Al momento usa dati finti. Verrà collegato all'API in seguito.
     */
    renderRows() {
        // Pulisce il corpo della tabella precedente
        this.dom.timelineBody.innerHTML = '';
        
        // Dati di esempio (verranno sostituiti da una chiamata API)
        const employees = [
            { id: 1, name: 'Mario Rossi' },
            { id: 2, name: 'Luigi Bianchi' },
            { id: 3, name: 'Giovanni Verdi' },
            // ...altri dipendenti
        ];

        const year = this.state.currentDate.getFullYear();
        const month = this.state.currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const fragment = document.createDocumentFragment();

        employees.forEach(employee => {
            const tr = document.createElement('tr');
            
            // Creiamo la cella fissa con il nome dell'operatore
            const thName = document.createElement('th');
            thName.textContent = employee.name;
            tr.appendChild(thName);

            // Creiamo le celle vuote per ogni giorno del mese
            for (let i = 1; i <= daysInMonth; i++) {
                const td = document.createElement('td');
                td.textContent = ''; // Lasciamo vuoto, verrà riempito con i dati
                tr.appendChild(td);
            }
            fragment.appendChild(tr);
        });

        this.dom.timelineBody.appendChild(fragment);
    },
    
    /**
     * Cambia il mese visualizzato avanti o indietro.
     * @param {number} direction - -1 per il mese precedente, 1 per quello successivo.
     */
    changeMonth(direction) {
        // Imposta il giorno a 1 per evitare problemi con mesi di diversa lunghezza
        this.state.currentDate.setDate(1); 
        this.state.currentDate.setMonth(this.state.currentDate.getMonth() + direction);
        this.render();
    }
};

// Avvia l'applicazione quando il DOM è completamente caricato
document.addEventListener('DOMContentLoaded', () => {
    TimelineApp.init();
});