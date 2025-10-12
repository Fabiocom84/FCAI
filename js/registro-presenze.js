import { apiFetch } from './api-client.js';

const TimelineApp = {
    state: {
        currentDate: new Date(),
        // NOVITÀ: Aggiungiamo uno stato per contenere i dati caricati
        employees: [],
        presenze: new Map(), // Usiamo una mappa per un accesso rapido ai dati
    },

    dom: {},

    /**
     * MODIFICA: init ora è una funzione asincrona per attendere il caricamento dei dati
     */
    async init() {
        this.dom.headerRow = document.getElementById('header-row');
        this.dom.timelineBody = document.getElementById('timeline-body');
        this.dom.currentMonthDisplay = document.getElementById('current-month-display');
        this.dom.prevMonthBtn = document.getElementById('prev-month');
        this.dom.nextMonthBtn = document.getElementById('next-month');

        this.addEventListeners();

        // Avviamo il primo rendering della griglia
        await this.render();
    },

    addEventListeners() {
        this.dom.prevMonthBtn.addEventListener('click', () => this.changeMonth(-1));
        this.dom.nextMonthBtn.addEventListener('click', () => this.changeMonth(1));
    },

    /**
     * MODIFICA: render ora è asincrono per caricare i dati prima di disegnare
     */
    async render() {
        console.log("Rendering per il mese:", this.state.currentDate.toLocaleDateString());

        this.updateMonthDisplay();
        this.renderHeaders();

        // NOVITÀ: Carichiamo i dati dal backend prima di disegnare le righe
        await this.loadDataForCurrentMonth();

        // Disegniamo le righe usando i dati caricati
        this.renderRows();
    },
    
    updateMonthDisplay() {
        const monthName = this.state.currentDate.toLocaleString('it-IT', { month: 'long' });
        const year = this.state.currentDate.getFullYear();
        this.dom.currentMonthDisplay.textContent = `${monthName.toUpperCase()} ${year}`;
    },

    renderHeaders() {
        this.dom.headerRow.innerHTML = '<th style="position: -webkit-sticky; position: sticky; left: 0; z-index: 15;">Operatore</th>';

        const year = this.state.currentDate.getFullYear();
        const month = this.state.currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const fragment = document.createDocumentFragment();

        for (let i = 1; i <= daysInMonth; i++) {
            const dayDate = new Date(year, month, i);
            const dayOfWeek = dayDate.toLocaleDateString('it-IT', { weekday: 'short' });
            const dayNumber = String(i).padStart(2, '0');

            const th = document.createElement('th');
            th.textContent = `${dayOfWeek} ${dayNumber}`;
            
            const dayIndex = dayDate.getDay();
            if (dayIndex === 0 || dayIndex === 6) {
                th.style.backgroundColor = "#e9ecef";
            }
            fragment.appendChild(th);
        }
        
        this.dom.headerRow.appendChild(fragment);
    },

    /**
     * MODIFICA: Ora disegna le righe basandosi sul personale caricato e popola le celle
     * con i dati delle presenze.
     */
    renderRows() {
        this.dom.timelineBody.innerHTML = '';
        
        const year = this.state.currentDate.getFullYear();
        const month = this.state.currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const fragment = document.createDocumentFragment();

        // Usiamo la lista di dipendenti caricata nello stato
        this.state.employees.forEach(employee => {
            const tr = document.createElement('tr');
            // NOVITÀ: Aggiungiamo un identificatore univoco alla riga
            tr.dataset.personaleId = employee.id_personale;
            
            const thName = document.createElement('th');
            thName.textContent = employee.nome_cognome;
            tr.appendChild(thName);

            for (let i = 1; i <= daysInMonth; i++) {
                const td = document.createElement('td');
                // NOVITÀ: Aggiungiamo un identificatore di data alla cella
                const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                td.dataset.date = dateString;
                
                // Cerca se esiste una presenza per questo dipendente in questa data
                const presenceKey = `${employee.id_personale}_${dateString}`;

                // --> 1. Definiamo la costante qui
                const presenceData = this.state.presenze.get(presenceKey);

                // --> 2. Controlliamo che la costante esista
                if (presenceData) {
                    // --> 3. Usiamo ESATTAMENTE lo stesso nome per accedere ai dati
                    td.textContent = presenceData.numero_ore || ''; 
                }
                
                tr.appendChild(td);
            }
            fragment.appendChild(tr);
        });

        this.dom.timelineBody.appendChild(fragment);
    },

    /**
     * NOVITÀ: Carica tutti i dati necessari (personale e presenze) per il mese corrente.
     */
    async loadDataForCurrentMonth() {
        try {
            // 1. Carica la lista del personale (solo se non è già stata caricata)
            if (this.state.employees.length === 0) {
                const response = await apiFetch('/api/personale?attivo=true&limit=100'); // Filtriamo per attivi
                if (!response.ok) throw new Error('Errore nel caricamento del personale.');
                const data = await response.json();
                this.state.employees = data.data; // L'API restituisce un oggetto con 'data' e 'count'
            }

            // 2. Carica i dati delle presenze per il mese corrente
            const year = this.state.currentDate.getFullYear();
            const month = this.state.currentDate.getMonth();
            const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
            const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

            const presenzeResponse = await apiFetch(`/api/presenze?startDate=${firstDay}&endDate=${lastDay}`);
            if (!presenzeResponse.ok) throw new Error('Errore nel caricamento delle presenze.');
            const presenzeData = await presenzeResponse.json();
            
            // Convertiamo l'array di dati in una mappa per un accesso O(1)
            this.state.presenze.clear();
            presenzeData.forEach(p => {
                const key = `${p.id_personale_fk}_${p.data}`;
                this.state.presenze.set(key, p);
            });

        } catch (error) {
            console.error("Errore durante il caricamento dei dati:", error);
            // Qui potresti mostrare un messaggio di errore all'utente
        }
    },
    
    /**
     * MODIFICA: changeMonth ora è asincrono
     */
    async changeMonth(direction) {
        this.state.currentDate.setDate(1); 
        this.state.currentDate.setMonth(this.state.currentDate.getMonth() + direction);
        await this.render();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    TimelineApp.init();
});