import { apiFetch } from './api-client.js';

const TimelineApp = {
    state: {
        currentDate: new Date(),
        employees: [],
        presenze: new Map(),
        tipiPresenza: [], // Conterrà i dati da `tipi_presenza` (ferie, etc.)
    },

    dom: {},

    async init() {
        this.dom.headerRow = document.getElementById('header-row');
        this.dom.timelineBody = document.getElementById('timeline-body');
        this.dom.currentMonthDisplay = document.getElementById('current-month-display');
        this.dom.prevMonthBtn = document.getElementById('prev-month');
        this.dom.nextMonthBtn = document.getElementById('next-month');

        await this.loadInitialData(); // Carichiamo anche i tipi di presenza
        this.addEventListeners();
        await this.render();
    },

    addEventListeners() {
        this.dom.prevMonthBtn.addEventListener('click', () => this.changeMonth(-1));
        this.dom.nextMonthBtn.addEventListener('click', () => this.changeMonth(1));
        
        // Usiamo la "event delegation" per gestire i click su tutte le celle
        this.dom.timelineBody.addEventListener('click', (event) => {
            // Se clicchiamo su una cella dati (TD) e non c'è già un input
            if (event.target.tagName === 'TD' && !event.target.querySelector('input')) {
                this.handleCellClick(event.target);
            }
        });
    },

    async render() {
        this.updateMonthDisplay();
        this.renderHeaders();
        await this.loadPresenzeForCurrentMonth();
        this.renderRows();
    },
    
    // --- FUNZIONI DI CARICAMENTO DATI ---
    async loadInitialData() {
        try {
            // Carichiamo personale e tipi di presenza in parallelo
            const [personaleRes, tipiRes] = await Promise.all([
                apiFetch('/api/personale?attivo=true&limit=100'),
                apiFetch('/api/tipi_presenza') // Assicurati di avere un endpoint per questo!
            ]);
            
            if (!personaleRes.ok || !tipiRes.ok) throw new Error('Errore nel caricamento dati iniziali.');
            
            const personaleData = await personaleRes.json();
            this.state.employees = personaleData.data;
            this.state.tipiPresenza = await tipiRes.json();

        } catch (error) {
            console.error("Errore fatale durante il caricamento iniziale:", error);
        }
    },
    
    async loadPresenzeForCurrentMonth() {
        try {
            const year = this.state.currentDate.getFullYear();
            const month = this.state.currentDate.getMonth();
            const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
            const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

            const presenzeResponse = await apiFetch(`/api/presenze?startDate=${firstDay}&endDate=${lastDay}`);
            if (!presenzeResponse.ok) throw new Error('Errore nel caricamento delle presenze.');
            
            const presenzeData = await presenzeResponse.json();
            this.state.presenze.clear();
            presenzeData.forEach(p => {
                const key = `${p.id_personale_fk}_${p.data}`;
                this.state.presenze.set(key, p);
            });
        } catch (error) {
            console.error("Errore durante il caricamento delle presenze:", error);
        }
    },

    // --- FUNZIONI DI RENDERING ---
    updateMonthDisplay() {
        const monthName = this.state.currentDate.toLocaleString('it-IT', { month: 'long' });
        const year = this.state.currentDate.getFullYear();
        this.dom.currentMonthDisplay.textContent = `${monthName.toUpperCase()} ${year}`;
    },

    renderHeaders() {
        this.dom.headerRow.innerHTML = '<th style="position: sticky; left: 0; z-index: 15;">Operatore</th>';
        const year = this.state.currentDate.getFullYear();
        const month = this.state.currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const fragment = document.createDocumentFragment();
        for (let i = 1; i <= daysInMonth; i++) {
            const dayDate = new Date(year, month, i);
            const dayOfWeek = dayDate.toLocaleString('it-IT', { weekday: 'short' });
            const dayNumber = String(i).padStart(2, '0');
            const th = document.createElement('th');
            th.textContent = `${dayOfWeek} ${dayNumber}`;
            const dayIndex = dayDate.getDay();
            if (dayIndex === 0 || dayIndex === 6) th.style.backgroundColor = "#e9ecef";
            fragment.appendChild(th);
        }
        this.dom.headerRow.appendChild(fragment);
    },

    renderRows() {
        this.dom.timelineBody.innerHTML = '';
        const year = this.state.currentDate.getFullYear();
        const month = this.state.currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const fragment = document.createDocumentFragment();
        this.state.employees.forEach(employee => {
            const tr = document.createElement('tr');
            tr.dataset.personaleId = employee.id_personale;
            const thName = document.createElement('th');
            thName.textContent = employee.nome_cognome;
            tr.appendChild(thName);
            for (let i = 1; i <= daysInMonth; i++) {
                const td = document.createElement('td');
                const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                td.dataset.date = dateString;
                const presenceKey = `${employee.id_personale}_${dateString}`;
                const presenceData = this.state.presenze.get(presenceKey);
                this.updateCellDisplay(td, presenceData); // Usiamo una funzione dedicata per il display
                tr.appendChild(td);
            }
            fragment.appendChild(tr);
        });
        this.dom.timelineBody.appendChild(fragment);
    },
    
    /**
     * Aggiorna il contenuto di una cella per mostrare i chip e l'indicatore di nota.
     */
    updateCellDisplay(cell, data) {
        cell.innerHTML = ''; // Pulisce la cella
        if (!data) return; // Se non ci sono dati, la cella rimane vuota

        let content = '';
        if (data.numero_ore) {
            content += `<span class="chip ore">${data.numero_ore}</span>`;
        }
        if (data.tipi_presenza) { // Se il backend ha fatto il join
             content += `<span class="chip" style="background-color:${data.tipi_presenza.colore_hex}; color:white;">${data.tipi_presenza.icona} ${data.tipi_presenza.etichetta}</span>`;
        }
        
        if (data.note) {
            cell.title = data.note; // Tooltip in stile Excel
            content += '<span class="note-indicator">◢</span>'; // Indicatore di nota
        } else {
            cell.title = '';
        }

        cell.innerHTML = content;
    },

    // --- FUNZIONI DI INTERAZIONE UTENTE ---
    handleCellClick(cell) {
        // Logica per mostrare l'input ibrido quando una cella viene cliccata
        // (Questa parte la svilupperemo nel prossimo passaggio)
        console.log(`Cella cliccata: Personale ID ${cell.parentElement.dataset.personaleId}, Data ${cell.dataset.date}`);
    },

    async changeMonth(direction) {
        this.state.currentDate.setDate(1);
        this.state.currentDate.setMonth(this.state.currentDate.getMonth() + direction);
        await this.render();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    TimelineApp.init();
});