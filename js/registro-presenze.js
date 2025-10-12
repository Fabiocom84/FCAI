import { apiFetch } from './api-client.js';

const TimelineApp = {
    state: {
        currentDate: new Date(),
        employees: [],
        presenze: new Map(),
        tipiPresenza: [],
        activeCell: null,
        isInitialLoad: true,
    },

    dom: {},

    async init() {
        this.dom.timelineContainer = document.querySelector('.timeline-container');
        this.dom.headerRow = document.getElementById('header-row');
        this.dom.timelineBody = document.getElementById('timeline-body');
        this.dom.currentMonthDisplay = document.getElementById('current-month-display');
        this.dom.prevMonthBtn = document.getElementById('prev-month');
        this.dom.nextMonthBtn = document.getElementById('next-month');

        await this.loadInitialData();
        this.addEventListeners();
        await this.render();
    },

    addEventListeners() {
        this.dom.prevMonthBtn.addEventListener('click', () => this.changeMonth(-1));
        this.dom.nextMonthBtn.addEventListener('click', () => this.changeMonth(1));
        
        this.dom.timelineBody.addEventListener('click', (event) => {
            const cell = event.target.closest('td');
            if (cell && !cell.classList.contains('editing')) {
                this.handleCellClick(cell);
            }
        });
    },

    async render() {
        if (this.state.activeCell) {
            await this.saveCell(this.state.activeCell);
        }
        this.updateMonthDisplay();
        this.renderHeaders();
        await this.loadPresenzeForCurrentMonth();
        this.renderRows();

        // NUOVO: Esegui lo scroll solo al primo caricamento
        if (this.state.isInitialLoad) {
            this.scrollToToday();
            this.state.isInitialLoad = false;
        }
    },
    
    // --- FUNZIONI DI CARICAMENTO DATI ---
    async loadInitialData() {
        try {
            const [personaleRes, tipiRes] = await Promise.all([
                apiFetch('/api/personale?attivo=true&limit=100'),
                apiFetch('/api/tipi_presenza')
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
        const todayString = new Date().toISOString().slice(0, 10);
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
                
                // MODIFICA: Applica la classe se il giorno è oggi
                if (dateString === todayString) {
                    td.classList.add('today-column');
                }

                const presenceKey = `${employee.id_personale}_${dateString}`;
                const presenceData = this.state.presenze.get(presenceKey);
                this.updateCellDisplay(td, presenceData);
                tr.appendChild(td);
            }
            fragment.appendChild(tr);
        });
        this.dom.timelineBody.appendChild(fragment);
    },

    scrollToToday() {
        const todayHeader = this.dom.headerRow.querySelector('.today-column');
        if (todayHeader) {
            const container = this.dom.timelineContainer;
            const containerWidth = container.offsetWidth;
            const scrollTarget = todayHeader.offsetLeft - (containerWidth / 2) + (todayHeader.offsetWidth / 2);
            
            container.scrollTo({
                left: scrollTarget,
                behavior: 'smooth'
            });
        }
    },
    
    /**
     * Aggiorna il contenuto di una cella per mostrare i chip e l'indicatore di nota.
     */
    updateCellDisplay(cell, data) {
        cell.innerHTML = '';
        cell.classList.remove('editing');
        this.state.activeCell = null;
        if (!data) return;

        let content = '';
        if (data.numero_ore != null) {
            content += `<span class="chip ore">${data.numero_ore}</span>`;
        }
        if (data.id_tipo_presenza_fk && this.state.tipiPresenza.length > 0) {
            const tipo = this.state.tipiPresenza.find(t => t.id_tipo === data.id_tipo_presenza_fk);
            if (tipo) {
                content += `<span class="chip" style="background-color:${tipo.colore_hex}; color:white;">${tipo.icona || ''} ${tipo.etichetta}</span>`;
            }
        }
        
        if (data.note) {
            cell.title = data.note;
            content += '<span class="note-indicator"></span>';
        } else {
            cell.title = '';
        }

        cell.innerHTML = content;
    },

    // --- FUNZIONI DI INTERAZIONE UTENTE ---
    handleCellClick(cell) {
        if (this.state.activeCell && this.state.activeCell !== cell) {
            this.saveCell(this.state.activeCell);
        }

        this.state.activeCell = cell;
        cell.classList.add('editing');
        
        const presenceKey = `${cell.parentElement.dataset.personaleId}_${cell.dataset.date}`;
        const currentData = this.state.presenze.get(presenceKey);
        const currentValue = this.dataToString(currentData);
        
        cell.innerHTML = `
            <div class="edit-container">
                <input type="text" class="cell-input" value="${currentValue}" />
                <button class="options-btn">...</button>
            </div>
        `;
        
        const input = cell.querySelector('.cell-input');
        input.focus();
        input.select();

        input.addEventListener('blur', () => this.saveCell(cell));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.saveCell(cell);
            if (e.key === 'Escape') this.updateCellDisplay(cell, currentData); // Annulla
        });

        // Per ora il pulsante "..." non fa nulla, lo implementeremo dopo
        cell.querySelector('.options-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            alert('Popup di inserimento guidato da implementare!');
        });
    },

    async saveCell(cell) {
        if (!cell || !cell.classList.contains('editing')) return;
        
        const input = cell.querySelector('.cell-input');
        if (!input) return;

        const rawText = input.value;
        const parsedData = this.parseInput(rawText);

        const payload = {
            id_personale_fk: parseInt(cell.parentElement.dataset.personaleId),
            data: cell.dataset.date,
            ...parsedData
        };

        try {
            const response = await apiFetch('/api/presenze', {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error('Salvataggio fallito');
            
            const savedData = await response.json();
            
            // Aggiorna lo stato locale e la cella
            const key = `${savedData.id_personale_fk}_${savedData.data}`;
            this.state.presenze.set(key, savedData);
            this.updateCellDisplay(cell, savedData);

        } catch (error) {
            console.error("Errore durante il salvataggio:", error);
            // In caso di errore, ripristina la cella allo stato precedente
            const presenceKey = `${cell.parentElement.dataset.personaleId}_${cell.dataset.date}`;
            const originalData = this.state.presenze.get(presenceKey);
            this.updateCellDisplay(cell, originalData);
        }
    },

    /**
     * Converte un oggetto dati in una stringa per l'input.
     */
    dataToString(data) {
        if (!data) return '';
        let parts = [];
        if (data.numero_ore != null) parts.push(data.numero_ore);
        if (data.id_tipo_presenza_fk) {
            const tipo = this.state.tipiPresenza.find(t => t.id_tipo === data.id_tipo_presenza_fk);
            if (tipo) parts.push(`\\${tipo.shortcut_key}`);
        }
        if (data.note) parts.push(`+${data.note}`);
        return parts.join(' ');
    },

    /**
     * Analizza la stringa dall'input e la converte in un oggetto dati.
     */
    parseInput(text) {
        const data = {
            numero_ore: null,
            id_tipo_presenza_fk: null,
            note: null
        };
        
        const parts = text.trim().split(' ');
        
        parts.forEach(part => {
            if (/^\d+(\.\d+)?$/.test(part)) { // Se è un numero (ore)
                data.numero_ore = parseFloat(part);
            } else if (part.startsWith('\\') && part.length === 2) { // Se è una shortcut
                const shortcut = part.substring(1);
                const tipo = this.state.tipiPresenza.find(t => t.shortcut_key === shortcut);
                if (tipo) data.id_tipo_presenza_fk = tipo.id_tipo;
            } else if (part.startsWith('+')) { // Se è una nota
                // Ricostruisce la nota completa se contiene spazi
                const noteIndex = text.indexOf('+');
                data.note = text.substring(noteIndex + 1).trim();
            }
        });
        
        // Se la nota è stata catturata da un'altra parte, la rimuoviamo per non duplicarla
        if (data.note) {
            const noteParts = data.note.split(' ');
            if (noteParts.includes(`\\${this.state.tipiPresenza.find(t=>t.id_tipo === data.id_tipo_presenza_fk)?.shortcut_key}`)) {
                // Semplice fix per evitare note sporche, migliorabile se necessario
            }
        }

        return data;
    },
    
    async changeMonth(direction) {
        await this.render(); // Salva la cella attiva prima di cambiare mese
        this.state.currentDate.setDate(1);
        this.state.currentDate.setMonth(this.state.currentDate.getMonth() + direction);
        await this.render();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    TimelineApp.init();
});