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
        if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            throw new Error(errJson.error || `Errore API: ${response.status}`);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    
    // --- VARIABILI ---
    let currentDate = new Date();
    let currentData = [];
    let personnelData = [];
    
    let typesById = {};      
    let shortcutMap = {};    
    
    let activePopup = null;
    let activeHeaderDate = null; 
    let activeCell = null;

    const ROLE_PRIORITY = {
        "addetto taglio": 1,
        "carpentiere": 2,
        "saldatore": 3,
        "tornitore": 4,
        "impiegato": 5,
        "addetto al montaggio": 6,
        "elettricista": 7
    };

    // --- DOM ---
    const headerRow = document.getElementById('header-row');
    const timelineBody = document.getElementById('timeline-body');
    const currentMonthDisplay = document.getElementById('current-month-display');
    const searchInput = document.getElementById('search-notes');
    
    const detailModal = document.getElementById('personnelDetailModal');
    const detailBody = document.getElementById('personnelDetailBody');
    const detailTitle = document.getElementById('personnelDetailTitle');
    const modalOverlay = document.getElementById('modalOverlay');
    const colorPickerPopup = document.getElementById('colorPickerPopup');

    // --- INIT ---
    initMonthNavigation();
    initGlobalEvents();
    
    await loadTipiPresenza(); 
    await loadData();

    // --- LOGICA TIPI ---
    async function loadTipiPresenza() {
        try {
            const res = await apiClient.get('/presenze/tipi'); 
            const tipiList = res || [];
            
            typesById = {};
            shortcutMap = {};

            tipiList.forEach(t => {
                typesById[t.id_tipo] = t;
                if (t.shortcut_key) {
                    shortcutMap[t.shortcut_key.toLowerCase().trim()] = t.id_tipo;
                }
            });
        } catch (err) {
            console.error("Errore caricamento tipi:", err);
        }
    }

    // --- NAVIGATION ---
    function initMonthNavigation() {
        document.getElementById('prev-month-btn').addEventListener('click', () => changeMonth(-1));
        document.getElementById('next-month-btn').addEventListener('click', () => changeMonth(1));
    }

    function changeMonth(delta) {
        currentDate.setMonth(currentDate.getMonth() + delta);
        loadData();
    }

    function initGlobalEvents() {
        document.addEventListener('click', (e) => {
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

        if(document.getElementById('closeColorPicker')) {
            document.getElementById('closeColorPicker').addEventListener('click', () => {
                colorPickerPopup.style.display = 'none';
            });
        }
        
        // Header Color Picker (quello vecchio per le colonne)
        document.querySelectorAll('.color-dot').forEach(dot => {
            dot.addEventListener('click', async (e) => {
                if(!colorPickerPopup.style.display || colorPickerPopup.style.display === 'none') return; // Ignora click nel popup visuale
                const color = e.target.dataset.color;
                if (activeHeaderDate) await applyColumnColor(activeHeaderDate, color);
                colorPickerPopup.style.display = 'none';
            });
        });

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

    // --- DATI ---
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

    // --- RENDER ---
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

                td.addEventListener('click', (e) => handleQuickEdit(e, td, person.id_personale, dayInfo.dateStr));
                
                td.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    handleVisualEdit(e, td, person.id_personale, dayInfo.dateStr);
                });

                tr.appendChild(td);
            });
            timelineBody.appendChild(tr);
        });
    }

    function renderCellContent(td, record) {
        td.innerHTML = ''; 
        td.className = ''; 
        if (td.dataset.isWeekend) td.classList.add('weekend-column'); 

        if (record.colore && record.colore !== 'none') {
            td.classList.add(`cell-color-${record.colore}`);
        }

        if (record.id_tipo_presenza_fk && typesById[record.id_tipo_presenza_fk]) {
            const tipoInfo = typesById[record.id_tipo_presenza_fk];
            if (tipoInfo.etichetta) {
                const badge = document.createElement('span');
                badge.className = 'chip';
                
                if (tipoInfo.colore_hex) {
                    badge.style.backgroundColor = tipoInfo.colore_hex;
                    badge.style.color = '#fff';
                } else {
                    badge.style.backgroundColor = '#ccc';
                }
                
                badge.textContent = tipoInfo.etichetta;
                if (record.numero_ore) badge.style.marginRight = '5px';
                td.appendChild(badge);
            }
        }

        if (record.numero_ore !== null && record.numero_ore !== undefined) {
            const chip = document.createElement('span');
            chip.className = 'chip ore';
            chip.textContent = record.numero_ore;
            td.appendChild(chip);
        }

        if (record.note) {
            const indicator = document.createElement('div');
            indicator.className = 'note-indicator';
            indicator.title = record.note;
            td.dataset.note = record.note;
            td.appendChild(indicator);
        }
    }

    // --- MODIFICA RAPIDA ---
    function handleQuickEdit(e, td, personId, dateStr) {
        if (td.querySelector('input')) return;
        if (activePopup) activePopup.remove();

        const record = currentData.find(r => r.id_personale_fk === personId && r.data === dateStr) || {};
        
        let initialValue = "";
        if (record.numero_ore) initialValue += record.numero_ore;
        
        if (record.id_tipo_presenza_fk) {
            const tipo = typesById[record.id_tipo_presenza_fk];
            if (tipo && tipo.shortcut_key) initialValue += " \\" + tipo.shortcut_key;
        }
        if (record.note) initialValue += " +" + record.note;

        td.innerHTML = '';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'cell-input';
        input.value = initialValue.trim();
        
        const save = async () => {
            const val = input.value.trim();
            const parsed = parseQuickCommand(val);
            
            const payload = {
                id_personale_fk: personId,
                data: dateStr,
                numero_ore: parsed.ore, 
                id_tipo_presenza_fk: parsed.idTipo, 
                note: parsed.note,
                colore: record.colore
            };

            try {
                const res = await apiClient.post('/presenze', payload);
                const idx = currentData.findIndex(r => r.id_personale_fk === personId && r.data === dateStr);
                if(idx >= 0) currentData[idx] = res; else currentData.push(res);
                renderCellContent(td, res);
            } catch(err) {
                console.error(err);
                renderCellContent(td, record); 
            }
        };

        input.addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter') { input.blur(); }
        });
        input.addEventListener('blur', save);
        input.addEventListener('click', (ev) => ev.stopPropagation()); 

        td.appendChild(input);
        input.focus();
    }

    function parseQuickCommand(text) {
        let ore = null;
        let idTipo = null;
        let note = null;

        if (!text) return { ore, idTipo, note };

        const noteMatch = text.match(/\+(.*)/);
        if (noteMatch) {
            note = noteMatch[1].trim();
            text = text.replace(noteMatch[0], ''); 
        }

        const cmdMatch = text.match(/\\([a-zA-Z0-9])/);
        if (cmdMatch) {
            const code = cmdMatch[1].toLowerCase();
            if (shortcutMap[code]) idTipo = shortcutMap[code];
            text = text.replace(cmdMatch[0], '');
        }

        const numMatch = text.match(/(\d+(\.\d+)?)/);
        if (numMatch) ore = parseFloat(numMatch[0]);

        return { ore, idTipo, note };
    }

    // --- MODIFICA VISUALE (Tasto Destro) ---
    function handleVisualEdit(e, td, personId, dateStr) {
        if (activePopup) activePopup.remove();
        
        const record = currentData.find(r => r.id_personale_fk === personId && r.data === dateStr) || {};
        const popup = document.createElement('div');
        popup.className = 'visual-popup';
        
        // Smart Position
        const topPos = (window.scrollY + e.pageY + 400 > document.body.scrollHeight) ? e.pageY - 350 : e.pageY;
        popup.style.top = `${topPos}px`;
        popup.style.left = `${e.pageX}px`;

        // Genera Griglia Tipi
        let buttonsHtml = '';
        // Aggiungi pulsante "Reset/Ordinario"
        const isOrd = (!record.id_tipo_presenza_fk);
        buttonsHtml += `
            <div class="type-btn ${isOrd ? 'selected' : ''}" data-id="">
                <span style="font-size:0.8em;">(Ord)</span>
            </div>
        `;

        Object.values(typesById).sort((a,b)=>(a.etichetta||'').localeCompare(b.etichetta||'')).forEach(t => {
            const isSel = (record.id_tipo_presenza_fk === t.id_tipo);
            const style = t.colore_hex ? `border-left: 3px solid ${t.colore_hex};` : '';
            buttonsHtml += `
                <div class="type-btn ${isSel ? 'selected' : ''}" data-id="${t.id_tipo}" style="${style}">
                    <span class="icon">${t.icona || ''}</span>
                    <span>${t.etichetta || t.codice}</span>
                </div>
            `;
        });

        // Color Picker HTML interno
        const colors = ['none', 'red', 'yellow', 'green', 'blue'];
        let colorHtml = '<div class="color-picker-row">';
        colors.forEach(c => {
            const sel = (record.colore === c || (!record.colore && c==='none')) ? 'selected' : '';
            colorHtml += `<div class="color-dot ${sel}" data-color="${c}" data-bg="${c}"></div>`;
        });
        colorHtml += '</div>';

        popup.innerHTML = `
            <h4>${dateStr}</h4>
            <div>
                <label>Ore:</label>
                <input type="number" id="v-ore" value="${record.numero_ore || ''}" step="0.5">
            </div>
            <div style="margin-top:10px;">
                <label>Tipo Presenza:</label>
                <div class="type-grid" id="type-grid">
                    ${buttonsHtml}
                </div>
                <input type="hidden" id="v-tipo" value="${record.id_tipo_presenza_fk || ''}">
            </div>
            <div style="margin-top:10px;">
                <label>Colore Sfondo:</label>
                ${colorHtml}
                <input type="hidden" id="v-color" value="${record.colore || 'none'}">
            </div>
            <div style="margin-top:10px;">
                <label>Note:</label>
                <textarea id="v-note">${record.note || ''}</textarea>
            </div>
            <div class="popup-actions">
                <button id="v-save" class="save">Salva</button>
                <button id="v-cancel" class="cancel">Chiudi</button>
            </div>
        `;

        document.body.appendChild(popup);
        activePopup = popup;

        // Gestione Click Pulsanti Tipo
        popup.querySelectorAll('.type-btn').forEach(btn => {
            btn.onclick = () => {
                popup.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                popup.querySelector('#v-tipo').value = btn.dataset.id;
            };
        });

        // Gestione Click Colore
        popup.querySelectorAll('.color-dot').forEach(dot => {
            dot.onclick = () => {
                popup.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
                dot.classList.add('selected');
                popup.querySelector('#v-color').value = dot.dataset.color;
            };
        });

        popup.querySelector('#v-save').onclick = async () => {
            const ore = popup.querySelector('#v-ore').value;
            const tipo = popup.querySelector('#v-tipo').value;
            const note = popup.querySelector('#v-note').value;
            const color = popup.querySelector('#v-color').value;

            const payload = {
                id_personale_fk: personId,
                data: dateStr,
                numero_ore: ore ? parseFloat(ore) : null,
                id_tipo_presenza_fk: tipo ? parseInt(tipo) : null,
                note: note,
                colore: color
            };
            
            try {
                const res = await apiClient.post('/presenze', payload);
                const idx = currentData.findIndex(r => r.id_personale_fk === personId && r.data === dateStr);
                if(idx >= 0) currentData[idx] = res; else currentData.push(res);
                renderCellContent(td, res);
                popup.remove();
                activePopup = null;
            } catch(e) { alert("Errore: " + e.message); }
        };

        popup.querySelector('#v-cancel').onclick = () => {
            popup.remove();
            activePopup = null;
        };
    }

    function openColorPicker(e, dateStr) {
        e.stopPropagation();
        colorPickerPopup.style.left = `${e.pageX}px`;
        colorPickerPopup.style.top = `${e.pageY}px`;
        colorPickerPopup.style.display = 'block';
        activeHeaderDate = dateStr;
    }

    async function applyColumnColor(dateStr, color) {
        try {
            await apiClient.post('/presenze/colore-colonna', { data: dateStr, colore: color });
            loadData();
        } catch (err) { alert('Errore colonna'); }
    }

    function openPersonnelDetail(person) {
        detailTitle.textContent = person.nome_cognome;
        detailBody.innerHTML = '';
        const records = currentData.filter(r => r.id_personale_fk === person.id_personale).sort((a,b)=>a.data.localeCompare(b.data));
        records.forEach(r => {
            const tr = document.createElement('tr');
            let tipoLabel = '';
            if (r.id_tipo_presenza_fk && typesById[r.id_tipo_presenza_fk]) {
                tipoLabel = typesById[r.id_tipo_presenza_fk].etichetta;
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