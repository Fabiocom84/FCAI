import { apiFetch } from './api-client.js';

// --- ADAPTER LOCALE ---
const apiClient = {
    async get(endpoint) {
        const url = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
        const response = await apiFetch(url, { method: 'GET' });
        if (!response.ok) throw new Error(`Errore API: ${response.status}`);
        return await response.json();
    },
    async post(endpoint, body) {
        const url = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
        const response = await apiFetch(url, {
            method: 'POST',
            body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error(`Errore API: ${response.status}`);
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    
    // --- VARIABILI DI STATO ---
    let currentDate = new Date();
    let currentData = [];
    let personnelData = [];
    
    // Mappe per la gestione dinamica dei tipi
    let typesById = {};      // ID -> Oggetto Tipo (per renderizzare colore/icona)
    let shortcutMap = {};    // Tasto (es. 'z') -> ID Tipo (per l'input rapido)
    
    // Variabili UI
    let activePopup = null;
    let activeHeaderDate = null; 
    let activeCell = null;

    // Mappa Priorità Ruoli (Hardcoded come da richiesta)
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
    
    const detailModal = document.getElementById('personnelDetailModal');
    const detailBody = document.getElementById('personnelDetailBody');
    const detailTitle = document.getElementById('personnelDetailTitle');
    const modalOverlay = document.getElementById('modalOverlay');
    const colorPickerPopup = document.getElementById('colorPickerPopup');

    // --- INIZIALIZZAZIONE ---
    initMonthNavigation();
    initGlobalEvents();
    
    // 1. Carica i tipi di presenza (Ferie, Malattia, ecc.)
    await loadTipiPresenza(); 
    // 2. Carica i dati della griglia
    await loadData();

    // --- LOGICA TIPI & COMANDI RAPIDI ---
    async function loadTipiPresenza() {
        try {
            // Chiama l'endpoint backend
            const res = await apiClient.get('/presenze/tipi'); 
            const tipiList = res || [];
            
            typesById = {};
            shortcutMap = {};

            tipiList.forEach(t => {
                // Mappa per ID (visualizzazione veloce)
                typesById[t.id_tipo] = t;

                // Mappa per Shortcut (input rapido)
                // Se nel DB c'è 'shortcut_key', lo usiamo.
                if (t.shortcut_key) {
                    const key = t.shortcut_key.toLowerCase().trim();
                    shortcutMap[key] = t.id_tipo;
                }
            });
            
            console.log("Mappa Shortcut Caricata:", shortcutMap);
        } catch (err) {
            console.error("Errore caricamento tipi presenza:", err);
        }
    }

    // --- NAVIGAZIONE ---
    function initMonthNavigation() {
        document.getElementById('prev-month-btn').addEventListener('click', () => changeMonth(-1));
        document.getElementById('next-month-btn').addEventListener('click', () => changeMonth(1));
    }

    function changeMonth(delta) {
        currentDate.setMonth(currentDate.getMonth() + delta);
        loadData();
    }

    function initGlobalEvents() {
        // Chiudi popup globali al click fuori
        document.addEventListener('click', (e) => {
            // Se clicco fuori da un popup visuale E fuori da una cella (per non chiudere l'input mentre scrivo)
            if (!e.target.closest('.visual-popup') && !e.target.closest('td')) {
                if (activePopup) { activePopup.remove(); activePopup = null; }
            }
        });

        document.querySelectorAll('.close-button, .modal-overlay').forEach(el => {
            el.addEventListener('click', () => {
                detailModal.style.display = 'none';
                modalOverlay.style.display = 'none';
                if(colorPickerPopup) colorPickerPopup.style.display = 'none';
            });
        });

        // Color Picker (Header)
        if(document.getElementById('closeColorPicker')) {
            document.getElementById('closeColorPicker').addEventListener('click', () => {
                colorPickerPopup.style.display = 'none';
            });
        }
        
        document.querySelectorAll('.color-dot').forEach(dot => {
            dot.addEventListener('click', async (e) => {
                const color = e.target.dataset.color;
                if (activeHeaderDate) {
                    await applyColumnColor(activeHeaderDate, color);
                } else if (activeCell) {
                    await applyCellColor(activeCell, color);
                }
                colorPickerPopup.style.display = 'none';
            });
        });

        // Ricerca
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.timeline-table td').forEach(td => {
                if (term && td.dataset.note && td.dataset.note.toLowerCase().includes(term)) {
                    td.classList.remove('dimmed');
                    td.style.backgroundColor = '#fff3cd'; 
                } else if (term) {
                    td.classList.add('dimmed');
                    td.style.backgroundColor = '';
                } else {
                    td.classList.remove('dimmed');
                    td.style.backgroundColor = ''; 
                    const colorClass = Array.from(td.classList).find(c => c.startsWith('cell-color-'));
                    if(!colorClass && td.dataset.originalBg) td.style.backgroundColor = td.dataset.originalBg; 
                }
            });
        });
    }

    // --- CARICAMENTO DATI GRIGLIA ---
    async function loadData() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const monthName = firstDay.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
        currentMonthDisplay.textContent = monthName.toUpperCase();

        const startDateStr = formatDateISO(firstDay);
        const endDateStr = formatDateISO(lastDay);

        try {
            const [presenzeRes, personaleRes] = await Promise.all([
                apiClient.get(`/presenze?startDate=${startDateStr}&endDate=${endDateStr}`),
                apiClient.get('/personale?attivo=true&limit=1000') 
            ]);

            currentData = presenzeRes || [];
            personnelData = personaleRes.data || [];

            sortPersonnel(personnelData);
            renderGrid(firstDay, lastDay);

        } catch (error) {
            console.error("Errore caricamento:", error);
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
        headerRow.innerHTML = '<th style="position: sticky; left: 0; z-index: 15; background-color: #f8f9fa;">Operatore</th>';
        timelineBody.innerHTML = '';

        const daysInMonth = [];
        const tempDate = new Date(firstDay);
        
        while (tempDate <= lastDay) {
            const dateStr = formatDateISO(tempDate);
            const dayNum = tempDate.getDate();
            const dayName = tempDate.toLocaleString('it-IT', { weekday: 'short' });
            const isWeekend = (tempDate.getDay() === 0 || tempDate.getDay() === 6);

            const th = document.createElement('th');
            th.innerHTML = `${dayNum}<br><small>${dayName}</small>`;
            th.dataset.date = dateStr;
            
            if (isWeekend) th.classList.add('weekend-column');
            th.addEventListener('click', (e) => openColorPicker(e, dateStr));

            headerRow.appendChild(th);
            daysInMonth.push({ dateStr, isWeekend });
            tempDate.setDate(tempDate.getDate() + 1);
        }

        personnelData.forEach(person => {
            const tr = document.createElement('tr');
            const thName = document.createElement('th');
            thName.textContent = person.nome_cognome;
            thName.addEventListener('click', () => openPersonnelDetail(person));
            tr.appendChild(thName);

            daysInMonth.forEach(dayInfo => {
                const td = document.createElement('td');
                td.dataset.date = dayInfo.dateStr;
                td.dataset.personId = person.id_personale;
                if (dayInfo.isWeekend) td.classList.add('weekend-column');

                const record = currentData.find(r => r.id_personale_fk === person.id_personale && r.data === dayInfo.dateStr);
                if (record) renderCellContent(td, record);

                // CLICK SINISTRO: Modifica Rapida (Input nella cella)
                td.addEventListener('click', (e) => handleQuickEdit(e, td, person.id_personale, dayInfo.dateStr));
                
                // CLICK DESTRO: Popup Visuale Completo
                td.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    handleVisualEdit(e, td, person.id_personale, dayInfo.dateStr);
                });

                tr.appendChild(td);
            });
            timelineBody.appendChild(tr);
        });
    }

    // --- VISUALIZZAZIONE CELLA ---
    function renderCellContent(td, record) {
        td.innerHTML = ''; 
        td.className = ''; // Reset classi
        if (td.dataset.isWeekend) td.classList.add('weekend-column'); 

        // 1. Colore Sfondo Custom
        if (record.colore && record.colore !== 'none') {
            td.classList.add(`cell-color-${record.colore}`);
        }

        // 2. Badge Tipo Presenza (Se ID presente e diverso da "ordinario")
        // Assumiamo che ID 1 sia Ordinario (da verificare nel tuo DB, o usare logica inversa)
        // Se c'è un tipo associato:
        if (record.id_tipo_presenza_fk && typesById[record.id_tipo_presenza_fk]) {
            const tipoInfo = typesById[record.id_tipo_presenza_fk];
            
            // Mostriamo il badge solo se ha un colore o un'etichetta specifica
            // (Assumiamo che "ordinario" o null non abbia badge o colore)
            if (tipoInfo.colore_hex && tipoInfo.etichetta) {
                const badge = document.createElement('span');
                badge.className = 'chip';
                badge.style.backgroundColor = tipoInfo.colore_hex;
                badge.style.color = 'white'; // Assumiamo testo bianco per contrasto
                badge.style.fontWeight = 'bold';
                // Usa l'etichetta (es. "Fer") o l'icona
                badge.textContent = tipoInfo.etichetta || tipoInfo.icona || '?';
                td.appendChild(badge);
            }
        }

        // 3. Ore (Mostrate sempre se presenti)
        if (record.numero_ore !== null && record.numero_ore !== undefined) {
            const chip = document.createElement('span');
            chip.className = 'chip ore';
            chip.textContent = record.numero_ore;
            td.appendChild(chip);
        }

        // 4. Note (Triangolo rosso)
        if (record.note) {
            const indicator = document.createElement('div');
            indicator.className = 'note-indicator';
            indicator.title = record.note;
            td.dataset.note = record.note;
            td.appendChild(indicator);
        }
    }

    // --- MODIFICA RAPIDA (Input nella cella) ---
    function handleQuickEdit(e, td, personId, dateStr) {
        // Evita riapertura se già attivo
        if (td.querySelector('input')) return;
        if (activePopup) activePopup.remove();

        const record = currentData.find(r => r.id_personale_fk === personId && r.data === dateStr) || {};
        
        // Prepara valore iniziale dell'input per l'utente
        let initialValue = "";
        
        // Se c'è un numero ore, lo mettiamo
        if (record.numero_ore) initialValue += record.numero_ore;
        
        // Se c'è un tipo speciale, cerchiamo il suo shortcut per mostrarlo
        // (Reverse lookup: ID -> Shortcut)
        if (record.id_tipo_presenza_fk) {
            const tipo = typesById[record.id_tipo_presenza_fk];
            if (tipo && tipo.shortcut_key) {
                initialValue += " \\" + tipo.shortcut_key;
            }
        }
        
        // Se c'è una nota
        if (record.note) initialValue += " +" + record.note;

        // Svuota cella e metti input
        td.innerHTML = '';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'cell-input';
        input.value = initialValue.trim();
        
        // Salva su Invio o Blur
        const save = async () => {
            const val = input.value.trim();
            const parsed = parseQuickCommand(val);
            
            // Costruiamo il payload
            const payload = {
                id_personale_fk: personId,
                data: dateStr,
                numero_ore: parsed.ore, // Può essere null
                id_tipo_presenza_fk: parsed.idTipo, // Può essere null (default ordinario backend)
                note: parsed.note,
                colore: record.colore // Preserva colore sfondo
            };

            try {
                const res = await apiClient.post('/presenze', payload);
                
                // Aggiorna dati locali
                const idx = currentData.findIndex(r => r.id_personale_fk === personId && r.data === dateStr);
                if(idx >= 0) currentData[idx] = res; else currentData.push(res);
                
                renderCellContent(td, res);
            } catch(err) {
                console.error(err);
                alert("Errore salvataggio");
                renderCellContent(td, record); // Ripristina vecchio stato
            }
        };

        input.addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter') { 
                input.blur(); // Scatena evento blur che salva
            }
        });

        input.addEventListener('blur', save);
        input.addEventListener('click', (ev) => ev.stopPropagation()); // Evita bubbling

        td.appendChild(input);
        input.focus();
    }

    // Parser Comandi Rapidi: "8 \z +nota"
    function parseQuickCommand(text) {
        let ore = null;
        let idTipo = null; // Se null, il backend o il DB gestiranno il default (spesso ID 1)
        let note = null;

        if (!text) return { ore, idTipo, note };

        // 1. Estrai Note (+...)
        const noteMatch = text.match(/\+(.*)/);
        if (noteMatch) {
            note = noteMatch[1].trim();
            text = text.replace(noteMatch[0], ''); 
        }

        // 2. Estrai Comando Shortcut (\x)
        // Cerca backslash seguito da un carattere
        const cmdMatch = text.match(/\\([a-zA-Z0-9])/);
        if (cmdMatch) {
            const code = cmdMatch[1].toLowerCase(); // Es. 'z'
            
            // Cerca nella mappa caricata dal DB
            if (shortcutMap[code]) {
                idTipo = shortcutMap[code];
            } else {
                console.warn(`Shortcut '\\${code}' non trovata nel DB.`);
            }
            text = text.replace(cmdMatch[0], '');
        }

        // 3. Estrai Ore (Numeri rimasti)
        // Cerca numeri interi o decimali (es. 8, 4.5)
        const numMatch = text.match(/(\d+(\.\d+)?)/);
        if (numMatch) {
            ore = parseFloat(numMatch[0]);
        }

        return { ore, idTipo, note };
    }

    // --- MODIFICA VISUALE (Tasto Destro) ---
    function handleVisualEdit(e, td, personId, dateStr) {
        if (activePopup) activePopup.remove();
        
        const record = currentData.find(r => r.id_personale_fk === personId && r.data === dateStr) || {};
        const popup = document.createElement('div');
        popup.className = 'visual-popup';
        popup.style.top = `${e.pageY}px`;
        popup.style.left = `${e.pageX}px`;

        // Genera Select Tipi dinamicamente
        let optionsHtml = '<option value="">(Ordinario)</option>';
        Object.values(typesById).forEach(t => {
            const sel = (record.id_tipo_presenza_fk === t.id_tipo) ? 'selected' : '';
            optionsHtml += `<option value="${t.id_tipo}" ${sel}>${t.nome_tipo}</option>`;
        });

        popup.innerHTML = `
            <h4>${dateStr}</h4>
            <div style="margin-bottom:10px;">
                <label>Ore:</label>
                <input type="number" id="v-ore" value="${record.numero_ore || ''}" step="0.5">
            </div>
            <div style="margin-bottom:10px;">
                <label>Stato:</label>
                <select id="v-tipo">${optionsHtml}</select>
            </div>
            <div style="margin-bottom:10px;">
                <textarea id="v-note" placeholder="Note...">${record.note || ''}</textarea>
            </div>
            <div class="popup-actions">
                <button id="v-save" class="save">Salva</button>
                <button id="v-cancel" class="cancel">Chiudi</button>
            </div>
        `;

        document.body.appendChild(popup);
        activePopup = popup;

        popup.querySelector('#v-save').onclick = async () => {
            const ore = popup.querySelector('#v-ore').value;
            const tipo = popup.querySelector('#v-tipo').value;
            const note = popup.querySelector('#v-note').value;

            const payload = {
                id_personale_fk: personId,
                data: dateStr,
                numero_ore: ore ? parseFloat(ore) : null,
                id_tipo_presenza_fk: tipo ? parseInt(tipo) : null,
                note: note,
                colore: record.colore
            };
            
            try {
                const res = await apiClient.post('/presenze', payload);
                const idx = currentData.findIndex(r => r.id_personale_fk === personId && r.data === dateStr);
                if(idx >= 0) currentData[idx] = res; else currentData.push(res);
                renderCellContent(td, res);
                popup.remove();
                activePopup = null;
            } catch(e) { alert("Errore"); }
        };

        popup.querySelector('#v-cancel').onclick = () => {
            popup.remove();
            activePopup = null;
        };
    }

    // --- UTILS ---
    function openColorPicker(e, dateStr) {
        e.stopPropagation();
        colorPickerPopup.style.left = `${e.pageX}px`;
        colorPickerPopup.style.top = `${e.pageY}px`;
        colorPickerPopup.style.display = 'block';
        activeHeaderDate = dateStr;
        activeCell = null;
    }

    async function applyColumnColor(dateStr, color) {
        try {
            await apiClient.post('/presenze/colore-colonna', { data: dateStr, colore: color });
            loadData();
        } catch (err) { alert('Errore colonna'); }
    }
    
    // Supporto per colorare singola cella (se necessario da qualche UI futura)
    async function applyCellColor(td, color) {
        // ... (implementazione analoga a applyColumnColor se servisse)
    }

    function openPersonnelDetail(person) {
        detailTitle.textContent = person.nome_cognome;
        detailBody.innerHTML = '';
        const records = currentData.filter(r => r.id_personale_fk === person.id_personale).sort((a,b)=>a.data.localeCompare(b.data));
        
        if (records.length === 0) detailBody.innerHTML = "<tr><td colspan='3'>Nessun dato.</td></tr>";

        records.forEach(r => {
            const tr = document.createElement('tr');
            // Cerca nome tipo
            let tipoLabel = '';
            if (r.id_tipo_presenza_fk && typesById[r.id_tipo_presenza_fk]) {
                tipoLabel = typesById[r.id_tipo_presenza_fk].nome_tipo;
            }
            
            tr.innerHTML = `<td>${r.data}</td><td>${r.numero_ore||''}</td><td>${tipoLabel} ${r.note||''}</td>`;
            detailBody.appendChild(tr);
        });
        detailModal.style.display = 'block';
        modalOverlay.style.display = 'block';
    }

    function formatDateISO(d) {
        return d.toISOString().split('T')[0];
    }
});