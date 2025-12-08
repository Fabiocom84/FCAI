import apiClient from './api-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // --- VARIABILI DI STATO ---
    let currentDate = new Date();
    let currentData = [];
    let personnelData = [];
    let activePopup = null;
    let activeCell = null;
    let activeHeaderDate = null; // Per il colore colonna

    // Mappa Priorità Ruoli (Esatta come da DB/Richiesta)
    const ROLE_PRIORITY = {
        "addetto taglio": 1,
        "carpentiere": 2,
        "saldatore": 3,
        "tornitore": 4,
        "impiegato": 5,
        "addetto al montaggio": 6,
        "elettricista": 7
    };

    // --- ELEMENTI DOM ---
    const headerRow = document.getElementById('header-row');
    const timelineBody = document.getElementById('timeline-body');
    const currentMonthDisplay = document.getElementById('current-month-display');
    const searchInput = document.getElementById('search-notes');
    
    // Modale Dettaglio
    const detailModal = document.getElementById('personnelDetailModal');
    const detailBody = document.getElementById('personnelDetailBody');
    const detailTitle = document.getElementById('personnelDetailTitle');
    const modalOverlay = document.getElementById('modalOverlay');

    // Popup Colore
    const colorPickerPopup = document.getElementById('colorPickerPopup');

    // --- INIZIALIZZAZIONE ---
    initMonthNavigation();
    initGlobalEvents();
    await loadData();

    // --- NAVIGAZIONE MESE ---
    function initMonthNavigation() {
        document.getElementById('prev-month-btn').addEventListener('click', () => changeMonth(-1));
        document.getElementById('next-month-btn').addEventListener('click', () => changeMonth(1));
    }

    function changeMonth(delta) {
        currentDate.setMonth(currentDate.getMonth() + delta);
        loadData();
    }

    function initGlobalEvents() {
        // Chiudi modali su click overlay o X
        document.querySelectorAll('.close-button, .modal-overlay').forEach(el => {
            el.addEventListener('click', () => {
                detailModal.style.display = 'none';
                modalOverlay.style.display = 'none';
                if(colorPickerPopup) colorPickerPopup.style.display = 'none';
                if(activePopup) activePopup.remove();
            });
        });

        // Gestione Click per Colore Colonna (Header)
        // Delegato nel rendering dell'header

        // Gestione Colore nel Popup Picker
        document.querySelectorAll('.color-dot').forEach(dot => {
            dot.addEventListener('click', async (e) => {
                const color = e.target.dataset.color;
                
                if (activeHeaderDate) {
                    // Stiamo colorando una colonna intera
                    await applyColumnColor(activeHeaderDate, color);
                } else if (activeCell) {
                    // Stiamo colorando una singola cella (dal menu ...)
                    await applyCellColor(activeCell, color);
                }
                colorPickerPopup.style.display = 'none';
            });
        });

        document.getElementById('closeColorPicker').addEventListener('click', () => {
            colorPickerPopup.style.display = 'none';
        });

        // Ricerca Note
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.timeline-table td').forEach(td => {
                if (term && td.dataset.note && td.dataset.note.toLowerCase().includes(term)) {
                    td.classList.remove('dimmed');
                    td.style.backgroundColor = '#fff3cd'; // Highlight result
                } else if (term) {
                    td.classList.add('dimmed');
                    td.style.backgroundColor = '';
                } else {
                    td.classList.remove('dimmed');
                    td.style.backgroundColor = ''; // Reset
                    // Riapplica classi colore se presenti
                    const colorClass = Array.from(td.classList).find(c => c.startsWith('cell-color-'));
                    if(!colorClass && td.dataset.originalBg) td.style.backgroundColor = td.dataset.originalBg; 
                }
            });
        });
    }

    // --- CARICAMENTO DATI ---
    async function loadData() {
        // 1. Calcola range date
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Aggiorna titolo
        const monthName = firstDay.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
        currentMonthDisplay.textContent = monthName.toUpperCase();

        const startDateStr = formatDateISO(firstDay);
        const endDateStr = formatDateISO(lastDay);

        try {
            // 2. Fetch Parallela
            const [presenzeRes, personaleRes] = await Promise.all([
                apiClient.get(`/presenze?startDate=${startDateStr}&endDate=${endDateStr}`),
                apiClient.get('/personale?attivo=true&limit=1000') // Prendi solo attivi
            ]);

            currentData = presenzeRes || [];
            personnelData = personaleRes.data || [];

            // 3. Ordinamento Personale Custom
            sortPersonnel(personnelData);

            // 4. Render
            renderGrid(firstDay, lastDay);

        } catch (error) {
            console.error("Errore caricamento:", error);
            alert("Errore nel caricamento dei dati.");
        }
    }

    function sortPersonnel(list) {
        list.sort((a, b) => {
            const roleA = a.ruoli?.nome_ruolo?.toLowerCase() || '';
            const roleB = b.ruoli?.nome_ruolo?.toLowerCase() || '';

            const prioA = ROLE_PRIORITY[roleA] || 99;
            const prioB = ROLE_PRIORITY[roleB] || 99;

            if (prioA !== prioB) return prioA - prioB;
            return a.nome_cognome.localeCompare(b.nome_cognome);
        });
    }

    // --- RENDERING GRIGLIA ---
    function renderGrid(firstDay, lastDay) {
        // Pulisce
        headerRow.innerHTML = '<th style="position: sticky; left: 0; z-index: 15; background-color: #f8f9fa;">Operatore</th>';
        timelineBody.innerHTML = '';

        const daysInMonth = [];
        const tempDate = new Date(firstDay);
        
        // 1. Genera Header Giorni
        while (tempDate <= lastDay) {
            const dateStr = formatDateISO(tempDate);
            const dayNum = tempDate.getDate();
            const dayName = tempDate.toLocaleString('it-IT', { weekday: 'short' });
            const isWeekend = (tempDate.getDay() === 0 || tempDate.getDay() === 6);

            const th = document.createElement('th');
            th.innerHTML = `${dayNum}<br><small>${dayName}</small>`;
            th.dataset.date = dateStr;
            
            if (isWeekend) th.classList.add('weekend-column');

            // Evento Click su Header per Colore
            th.addEventListener('click', (e) => openColorPicker(e, dateStr, 'column'));

            headerRow.appendChild(th);
            daysInMonth.push({ dateStr, isWeekend });
            tempDate.setDate(tempDate.getDate() + 1);
        }

        // 2. Genera Righe Personale
        personnelData.forEach(person => {
            const tr = document.createElement('tr');
            
            // Cella Nome (Sticky)
            const thName = document.createElement('th');
            thName.textContent = person.nome_cognome;
            thName.addEventListener('click', () => openPersonnelDetail(person));
            tr.appendChild(thName);

            // Celle Giorni
            daysInMonth.forEach(dayInfo => {
                const td = document.createElement('td');
                td.dataset.date = dayInfo.dateStr;
                td.dataset.personId = person.id_personale;
                
                if (dayInfo.isWeekend) td.classList.add('weekend-column');

                // Cerca dati presenza
                const record = currentData.find(r => r.id_personale_fk === person.id_personale && r.data === dayInfo.dateStr);

                if (record) {
                    renderCellContent(td, record);
                }

                // Evento Click Cella per Modifica
                td.addEventListener('click', (e) => handleCellClick(e, td, person.id_personale, dayInfo.dateStr));

                tr.appendChild(td);
            });

            timelineBody.appendChild(tr);
        });
    }

    function renderCellContent(td, record) {
        td.innerHTML = ''; // Reset
        
        // Colore Sfondo
        if (record.colore && record.colore !== 'none') {
            td.classList.add(`cell-color-${record.colore}`);
        }

        // Ore
        if (record.numero_ore) {
            const chip = document.createElement('span');
            chip.className = 'chip ore';
            chip.textContent = record.numero_ore;
            td.appendChild(chip);
        }

        // Simboli Tipi Presenza (es. Ferie, Malattia)
        // (Qui assumiamo logica esistente o ID fissi, semplifico per brevità)
        if (record.id_tipo_presenza_fk && record.id_tipo_presenza_fk !== 1) { // 1 = standard
             const chip = document.createElement('span');
             chip.className = 'chip';
             chip.textContent = getTipoSymbol(record.id_tipo_presenza_fk); 
             td.appendChild(chip);
        }

        // Note
        if (record.note) {
            const indicator = document.createElement('div');
            indicator.className = 'note-indicator';
            indicator.title = record.note;
            td.dataset.note = record.note;
            td.appendChild(indicator);
        }
    }

    function getTipoSymbol(id) {
        // Mappa provvisoria, da sostituire con chiamata API se dinamico
        const map = { 2: 'F', 3: 'M', 4: 'P', 5: '104' }; // IDs ipotetici
        return map[id] || '?';
    }

    // --- GESTIONE CLICK E MODALI ---

    function openColorPicker(e, targetId, mode) {
        e.stopPropagation();
        
        // Posiziona popup vicino al mouse
        colorPickerPopup.style.left = `${e.pageX}px`;
        colorPickerPopup.style.top = `${e.pageY}px`;
        colorPickerPopup.style.display = 'block';

        if (mode === 'column') {
            activeHeaderDate = targetId;
            activeCell = null;
        } else {
            activeCell = targetId; // targetId qui è l'elemento TD
            activeHeaderDate = null;
        }
    }

    async function applyColumnColor(dateStr, color) {
        try {
            await apiClient.post('/presenze/colore-colonna', {
                data: dateStr,
                colore: color
            });
            // Ricarica tutto per vedere l'effetto su tutti
            loadData();
        } catch (err) {
            alert('Errore aggiornamento colonna');
        }
    }

    async function applyCellColor(td, color) {
        const pid = td.dataset.personId;
        const date = td.dataset.date;
        
        // Upsert singolo
        try {
            const res = await apiClient.post('/presenze', {
                id_personale_fk: pid,
                data: date,
                colore: color
                // Nota: non mandiamo ore/note, il backend gestisce il merge (vedi presenze.py)
            });
            
            // Aggiorna solo la cella
            // Rimuovi vecchie classi colore
            td.classList.forEach(c => { if(c.startsWith('cell-color-')) td.classList.remove(c); });
            if (color !== 'none') td.classList.add(`cell-color-${color}`);
            
            // Aggiorna record in memoria locale per coerenza
            let record = currentData.find(r => r.id_personale_fk == pid && r.data == date);
            if(record) record.colore = color;

        } catch (err) {
            console.error(err);
        }
    }

    function openPersonnelDetail(person) {
        detailTitle.textContent = `Dettaglio: ${person.nome_cognome}`;
        detailBody.innerHTML = '';
        
        // Filtra dati del mese corrente per questa persona
        const personRecords = currentData
            .filter(r => r.id_personale_fk === person.id_personale)
            .sort((a, b) => a.data.localeCompare(b.data));

        if (personRecords.length === 0) {
            detailBody.innerHTML = '<tr><td colspan="3">Nessuna presenza registrata in questo mese.</td></tr>';
        } else {
            personRecords.forEach(rec => {
                const tr = document.createElement('tr');
                const dateObj = new Date(rec.data);
                const dayStr = dateObj.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', weekday: 'short' });
                
                tr.innerHTML = `
                    <td>${dayStr}</td>
                    <td><strong>${rec.numero_ore || '-'}</strong></td>
                    <td>${rec.note || ''}</td>
                `;
                detailBody.appendChild(tr);
            });
        }
        
        detailModal.style.display = 'block';
        modalOverlay.style.display = 'block';
    }

    // --- GESTIONE MODIFICA CELLA (Popup Esistente + Opzione Colore) ---
    function handleCellClick(e, td, personId, dateStr) {
        // Se si clicca su chip o indicatore, bubbola su TD
        if (activePopup) activePopup.remove();

        const rect = td.getBoundingClientRect();
        const record = currentData.find(r => r.id_personale_fk === personId && r.data === dateStr) || {};

        const popup = document.createElement('div');
        popup.className = 'visual-popup';
        popup.style.top = `${window.scrollY + rect.bottom + 5}px`;
        popup.style.left = `${window.scrollX + rect.left}px`;
        
        popup.innerHTML = `
            <h4>${dateStr}</h4>
            <input type="number" id="edit-ore" step="0.5" placeholder="Ore" value="${record.numero_ore || ''}">
            <textarea id="edit-note" placeholder="Note...">${record.note || ''}</textarea>
            
            <div class="popup-actions">
                <button class="status-btn" id="btn-color-opts">🎨 Colore</button>
                <div class="main-actions">
                    <button class="save" id="btn-save">Salva</button>
                    <button class="delete" id="btn-delete">🗑️</button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);
        activePopup = popup;

        // Focus su ore
        setTimeout(() => popup.querySelector('#edit-ore').focus(), 50);

        // Eventi Popup
        popup.querySelector('#btn-save').onclick = async () => {
            const ore = popup.querySelector('#edit-ore').value;
            const note = popup.querySelector('#edit-note').value;
            
            try {
                const res = await apiClient.post('/presenze', {
                    id_personale_fk: personId,
                    data: dateStr,
                    numero_ore: ore ? parseFloat(ore) : null,
                    note: note,
                    colore: record.colore // Mantiene colore esistente
                });
                
                // Aggiorna UI locale veloce
                renderCellContent(td, res);
                // Aggiorna array dati
                const idx = currentData.findIndex(r => r.id_personale_fk === personId && r.data === dateStr);
                if(idx >= 0) currentData[idx] = res; else currentData.push(res);
                
                popup.remove();
                activePopup = null;
            } catch(err) { alert("Errore salvataggio"); }
        };

        popup.querySelector('#btn-delete').onclick = async () => {
             // Logica elimina (update a null o delete row)
             // ... implementare se necessario, per ora chiude
             popup.remove();
             activePopup = null;
        };

        // Apre il color picker "sottostante" o lo integra
        popup.querySelector('#btn-color-opts').onclick = (evt) => {
            popup.remove(); // Chiude popup edit
            openColorPicker(e, td, 'cell'); // Apre color picker su cella
        };

        // Chiudi se click fuori (gestito globalmente o qui)
        // ...
    }

    // Helper Date
    function formatDateISO(d) {
        return d.toISOString().split('T')[0];
    }
});
