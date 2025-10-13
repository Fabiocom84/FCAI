import { apiFetch } from './api-client.js';

const DateUtils = {
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    },
    toYYYYMMDD(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
};

const TimelineApp = {
    state: {
        startDate: null,
        endDate: null,
        employees: [],
        presenze: new Map(),
        tipiPresenza: [],
        activeCell: null,
        isLoadingMore: false,
    },

    dom: {},

    async init() {
        this.dom.timelineContainer = document.querySelector('.timeline-container');
        this.dom.headerRow = document.getElementById('header-row');
        this.dom.timelineBody = document.getElementById('timeline-body');
        this.dom.currentMonthDisplay = document.getElementById('current-month-display');
        this.dom.searchNotesInput = document.getElementById('search-notes');
        
        // --- INIZIO TEST ---
        // Aggiungiamo il riferimento al pulsante di aiuto
        this.dom.helpButton = document.querySelector('[data-legend="presenzeLegend"]');
        // --- FINE TEST ---

        const today = new Date();
        this.state.startDate = DateUtils.addDays(today, -15);
        this.state.endDate = DateUtils.addDays(today, +15);

        await this.loadInitialData();
        await this.loadPresenzeForDateRange(this.state.startDate, this.state.endDate);
        
        this.renderInitialTable();
        this.scrollToToday();
        
        this.addEventListeners();
    },

    addEventListeners() {
        let scrollTimeout;
        this.dom.timelineContainer.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => TimelineApp.handleScroll(), 100);
        });
        
        this.dom.timelineBody.addEventListener('click', (event) => {
            const cell = event.target.closest('td');
            if (cell && !cell.classList.contains('editing')) {
                TimelineApp.handleCellClick(cell);
            }
        });

        if (this.dom.helpButton) {
            this.dom.helpButton.addEventListener('click', () => {
                const legend = document.getElementById('presenzeLegend');
                if (legend) {
                    legend.style.display = legend.style.display === 'block' ? 'none' : 'block';
                }
            });
        }

        // --- AGGIUNGI QUESTO BLOCCO ---
        let searchTimeout;
        this.dom.searchNotesInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            // Attende 300ms prima di avviare la ricerca per non appesantire il browser
            searchTimeout = setTimeout(() => TimelineApp.filterTimeline(), 300);
        });
        // --- FINE BLOCCO ---
    },
    
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
    
    async loadPresenzeForDateRange(start, end) {
        if (!start || !end) return;
        try {
            const presenzeResponse = await apiFetch(`/api/presenze?startDate=${DateUtils.toYYYYMMDD(start)}&endDate=${DateUtils.toYYYYMMDD(end)}`);
            if (!presenzeResponse.ok) throw new Error('Errore caricamento presenze.');
            
            const presenzeData = await presenzeResponse.json();
            presenzeData.forEach(p => {
                const key = `${p.id_personale_fk}_${p.data}`;
                this.state.presenze.set(key, p);
            });
        } catch (error) { console.error("Errore durante il caricamento delle presenze:", error); }
    },

    renderInitialTable() {
        this.dom.headerRow.innerHTML = '<th style="position: sticky; left: 0; z-index: 15;">Operatore</th>';
        this.dom.timelineBody.innerHTML = '';

        this.state.employees.forEach(employee => {
            const tr = document.createElement('tr');
            tr.dataset.personaleId = employee.id_personale;
            const thName = document.createElement('th');
            thName.textContent = employee.nome_cognome;
            tr.appendChild(thName);
            this.dom.timelineBody.appendChild(tr);
        });

        this.appendDays(this.state.startDate, this.state.endDate);
        this.updateMonthDisplay();
    },

    appendDays(start, end) {
        let currentDate = new Date(start);
        while (currentDate <= end) {
            const dateString = DateUtils.toYYYYMMDD(currentDate);
            const th = this.createHeaderCell(currentDate, dateString);
            this.dom.headerRow.appendChild(th);
            this.dom.timelineBody.querySelectorAll('tr').forEach(tr => {
                const td = this.createDataCell(tr.dataset.personaleId, dateString);
                tr.appendChild(td);
            });
            currentDate = DateUtils.addDays(currentDate, 1);
        }
    },

    prependDays(start, end) {
        let currentDate = new Date(end);
        while (currentDate >= start) {
            const dateString = DateUtils.toYYYYMMDD(currentDate);
            const th = this.createHeaderCell(currentDate, dateString);
            this.dom.headerRow.insertBefore(th, this.dom.headerRow.children[1]);
             this.dom.timelineBody.querySelectorAll('tr').forEach(tr => {
                const td = this.createDataCell(tr.dataset.personaleId, dateString);
                tr.insertBefore(td, tr.children[1]);
            });
            currentDate = DateUtils.addDays(currentDate, -1);
        }
    },

    createHeaderCell(date, dateString) {
        const today = new Date();
        const todayString = DateUtils.toYYYYMMDD(today);
        const dayOfWeek = date.toLocaleString('it-IT', { weekday: 'short' });
        const dayNumber = String(date.getDate()).padStart(2, '0');
        const th = document.createElement('th');
        th.textContent = `${dayOfWeek} ${dayNumber}`;
        th.dataset.date = dateString;
        if (dateString === todayString) th.classList.add('today-column');
        const dayIndex = date.getDay();
        if (dayIndex === 0 || dayIndex === 6) { // 0 = Domenica, 6 = Sabato
            th.classList.add('weekend-column');
        }
        return th;
    },

    createDataCell(personaleId, dateString) {
        const today = new Date();
        const todayString = DateUtils.toYYYYMMDD(today);
        const td = document.createElement('td');
        td.dataset.date = dateString;
        const cellDate = new Date(dateString + 'T12:00:00'); // Creiamo un oggetto data per controllarne il giorno
        const dayIndex = cellDate.getDay();
        if (dayIndex === 0 || dayIndex === 6) {
            td.classList.add('weekend-column');
        if (dateString === todayString) td.classList.add('today-column');
        const presenceKey = `${personaleId}_${dateString}`;
        const presenceData = this.state.presenze.get(presenceKey);
        this.updateCellDisplay(td, presenceData);
        return td;
    },

    async handleScroll() {
        if (this.state.isLoadingMore) return;
        this.updateMonthDisplay();
        const container = this.dom.timelineContainer;
        const { scrollLeft, scrollWidth, clientWidth } = container;
        const threshold = 300;

        if (scrollLeft + clientWidth >= scrollWidth - threshold) {
            this.state.isLoadingMore = true;
            const newStartDate = DateUtils.addDays(this.state.endDate, 1);
            const newEndDate = DateUtils.addDays(this.state.endDate, 30);
            await this.loadPresenzeForDateRange(newStartDate, newEndDate);
            this.appendDays(newStartDate, newEndDate);
            this.state.endDate = newEndDate;
            this.state.isLoadingMore = false;
        }

        if (scrollLeft <= threshold) {
            this.state.isLoadingMore = true;
            const oldScrollWidth = container.scrollWidth;
            const newEndDate = DateUtils.addDays(this.state.startDate, -1);
            const newStartDate = DateUtils.addDays(this.state.startDate, -30);
            await this.loadPresenzeForDateRange(newStartDate, newEndDate);
            this.prependDays(newStartDate, newEndDate);
            this.state.startDate = newStartDate;
            container.scrollLeft = (container.scrollWidth - oldScrollWidth) + scrollLeft;
            this.state.isLoadingMore = false;
        }
    },
    
    updateMonthDisplay() {
        const container = this.dom.timelineContainer;
        const centerPosition = container.scrollLeft + (container.clientWidth / 2);
        const headers = Array.from(this.dom.headerRow.querySelectorAll('th[data-date]'));
        if (headers.length === 0) return;
        const centerHeader = headers.reduce((prev, curr) => {
            return (Math.abs(curr.offsetLeft - centerPosition) < Math.abs(prev.offsetLeft - centerPosition) ? curr : prev);
        });

        if (centerHeader) {
            const centerDate = new Date(centerHeader.dataset.date + 'T12:00:00');
            const monthName = centerDate.toLocaleString('it-IT', { month: 'long' });
            const year = centerDate.getFullYear();
            this.dom.currentMonthDisplay.textContent = `${monthName.toUpperCase()} ${year}`;
        }
    },

    scrollToToday() {
        const todayHeader = this.dom.headerRow.querySelector('.today-column');
        if (todayHeader) {
            setTimeout(() => {
                const container = this.dom.timelineContainer;
                const containerWidth = container.offsetWidth;
                const scrollTarget = todayHeader.offsetLeft - (containerWidth / 2) + (todayHeader.offsetWidth / 2);
                container.scrollTo({ left: scrollTarget, behavior: 'smooth' });
            }, 100);
        }
    },

    filterTimeline() {
        const searchTerm = this.dom.searchNotesInput.value.toLowerCase().trim();
        const allCells = this.dom.timelineBody.querySelectorAll('td');

        // Se la ricerca è vuota, mostra di nuovo tutte le celle
        if (!searchTerm) {
            allCells.forEach(cell => cell.classList.remove('dimmed'));
            return;
        }

        // Altrimenti, applica il filtro
        allCells.forEach(cell => {
            const key = `${cell.parentElement.dataset.personaleId}_${cell.dataset.date}`;
            const data = this.state.presenze.get(key);

            // Se la cella ha una nota e la nota include il termine di ricerca...
            if (data && data.note && data.note.toLowerCase().includes(searchTerm)) {
                cell.classList.remove('dimmed'); // ...mostrala normalmente
            } else {
                cell.classList.add('dimmed'); // ...altrimenti, sfumala
            }
        });
    },
    
    updateCellDisplay(cell, data) {
        cell.innerHTML = '';
        cell.classList.remove('editing');
        this.state.activeCell = null;
        if (!data) return;

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'cell-content-wrapper';
        let chipsHtml = '';
        if (data.numero_ore != null) {
            chipsHtml += `<span class="chip ore">${data.numero_ore}</span>`;
        }
        if (data.id_tipo_presenza_fk && this.state.tipiPresenza.length > 0) {
            const tipo = this.state.tipiPresenza.find(t => t.id_tipo === data.id_tipo_presenza_fk);
            if (tipo) {
                chipsHtml += `<span class="chip" style="background-color:${tipo.colore_hex}; color:white;">${tipo.icona || ''} ${tipo.etichetta}</span>`;
            }
        }
        contentWrapper.innerHTML = chipsHtml;
        
        cell.appendChild(contentWrapper);
        
        if (data.note) {
            cell.title = data.note;
            const noteIndicator = document.createElement('span');
            noteIndicator.className = 'note-indicator';
            cell.appendChild(noteIndicator);
        } else {
            cell.title = '';
        }
    },

    handleCellClick(cell) {
        if (TimelineApp.state.activeCell && TimelineApp.state.activeCell !== cell) {
            TimelineApp.saveCellFromInput(TimelineApp.state.activeCell);
        }
        TimelineApp.state.activeCell = cell;
        cell.classList.add('editing');
        const presenceKey = `${cell.parentElement.dataset.personaleId}_${cell.dataset.date}`;
        const currentData = TimelineApp.state.presenze.get(presenceKey);
        const currentValue = TimelineApp.dataToString(currentData);
        cell.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'edit-container';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'cell-input';
        input.value = currentValue;
        const optionsBtn = document.createElement('button');
        optionsBtn.className = 'options-btn';
        optionsBtn.textContent = '...';
        container.appendChild(input);
        container.appendChild(optionsBtn);
        cell.appendChild(container);
        input.focus();
        input.select();
        input.addEventListener('blur', () => TimelineApp.saveCellFromInput(cell));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') TimelineApp.saveCellFromInput(cell);
            if (e.key === 'Escape') TimelineApp.updateCellDisplay(cell, currentData);
        });
        optionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            TimelineApp.showVisualPopup(cell, currentData);
        });
    },

    showVisualPopup(cell, currentData) {
        document.querySelector('.visual-popup')?.remove();
        const popup = document.createElement('div');
        popup.className = 'visual-popup';
        const oreHtml = `<div><h4>Ore Lavorate</h4><input type="number" class="popup-ore" step="0.5" value="${currentData?.numero_ore || ''}"></div>`;
        let statusHtml = '<div><h4>Stato</h4><div class="status-buttons-container">';
        this.state.tipiPresenza.forEach(tipo => {
            const isActive = currentData?.id_tipo_presenza_fk === tipo.id_tipo;
            statusHtml += `<button class="status-btn ${isActive ? 'active' : ''}" data-id="${tipo.id_tipo}" style="background-color:${tipo.colore_hex}20; border-color:${tipo.colore_hex};">
                            ${tipo.icona || ''} ${tipo.etichetta}
                           </button>`;
        });
        statusHtml += '</div></div>';
        const noteHtml = `<div><h4>Note (commento)</h4><textarea class="popup-note">${currentData?.note || ''}</textarea></div>`;
        const actionsHtml = `<div class="popup-actions">
                                <button class="delete">🗑️ Elimina</button>
                                <div class="main-actions">
                                    <button class="cancel">Annulla</button>
                                    <button class="save">Salva</button>
                                </div>
                             </div>`;
        popup.innerHTML = oreHtml + statusHtml + noteHtml + actionsHtml;
        document.body.appendChild(popup);
        const cellRect = cell.getBoundingClientRect();
        popup.style.top = `${cellRect.bottom + window.scrollY}px`;
        popup.style.left = `${cellRect.left + window.scrollX}px`;
        const statusContainer = popup.querySelector('.status-buttons-container');
        statusContainer.addEventListener('click', e => {
            if (e.target.classList.contains('status-btn')) {
                const alreadyActive = e.target.classList.contains('active');
                statusContainer.querySelector('.active')?.classList.remove('active');
                if (!alreadyActive) e.target.classList.add('active');
            }
        });
        popup.querySelector('.save').addEventListener('click', () => {
            const ore = popup.querySelector('.popup-ore').value;
            const activeStatusBtn = popup.querySelector('.status-btn.active');
            const note = popup.querySelector('.popup-note').value;
            const payload = {
                numero_ore: ore ? parseFloat(ore) : null,
                id_tipo_presenza_fk: activeStatusBtn ? parseInt(activeStatusBtn.dataset.id) : null,
                note: note || null
            };
            TimelineApp.saveCellWithPayload(cell, payload);
            popup.remove();
        });
        popup.querySelector('.cancel').addEventListener('click', () => {
            TimelineApp.updateCellDisplay(cell, currentData);
            popup.remove();
        });
        popup.querySelector('.delete').addEventListener('click', () => {
            TimelineApp.handleDelete(cell);
            popup.remove();
        });
    },

    async saveCellFromInput(cell) {
        if (!cell || !cell.classList.contains('editing')) return;
        const input = cell.querySelector('.cell-input');
        if (!input) return;
        const rawText = input.value;
        const payload = TimelineApp.parseInput(rawText);
        TimelineApp.saveCellWithPayload(cell, payload);
    },

    async saveCellWithPayload(cell, payload) {
        const fullPayload = {
            id_personale_fk: parseInt(cell.parentElement.dataset.personaleId),
            data: cell.dataset.date,
            ...payload
        };
        try {
            const response = await apiFetch('/api/presenze', {
                method: 'POST',
                body: JSON.stringify(fullPayload),
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error('Salvataggio fallito');
            const savedData = await response.json();
            const key = `${savedData.id_personale_fk}_${savedData.data}`;
            this.state.presenze.set(key, savedData);
            this.updateCellDisplay(cell, savedData);
        } catch (error) {
            console.error("Errore durante il salvataggio:", error);
            const presenceKey = `${cell.parentElement.dataset.personaleId}_${cell.dataset.date}`;
            const originalData = this.state.presenze.get(presenceKey);
            this.updateCellDisplay(cell, originalData);
        }
    },

    async handleDelete(cell) {
        const confirmDelete = confirm("Sei sicuro di voler eliminare questa registrazione?");
        if (!confirmDelete) return;
        const payload = { numero_ore: null, id_tipo_presenza_fk: null, note: null };
        await TimelineApp.saveCellWithPayload(cell, payload);
    },

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

    parseInput(text) {
        const data = {
            numero_ore: null,
            id_tipo_presenza_fk: null,
            note: null
        };
        if (!text) return data;
        const noteMatch = text.match(/\+(.*)/);
        if (noteMatch) {
            data.note = noteMatch[1].trim();
            text = text.replace(noteMatch[0], '').trim();
        }
        const parts = text.split(' ');
        parts.forEach(part => {
            if (/^\d+(\.\d+)?$/.test(part)) {
                data.numero_ore = parseFloat(part);
            } else if (part.startsWith('\\') && part.length === 2) {
                const shortcut = part.substring(1);
                const tipo = this.state.tipiPresenza.find(t => t.shortcut_key === shortcut);
                if (tipo) data.id_tipo_presenza_fk = tipo.id_tipo;
            }
        });
        return data;
    },
};

document.addEventListener('DOMContentLoaded', () => {
    TimelineApp.init();
});