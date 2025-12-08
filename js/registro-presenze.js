import { apiFetch } from './api-client.js';

// --- ADAPTER ---
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
    
    // --- VARIABILI GLOBALI ---
    let typesById = {};
    let shortcutMap = {};
    let personnelData = [];
    let loadedDataMap = {}; 
    
    let currentStartDate = new Date();
    let currentEndDate = new Date();   
    let isLoading = false;

    let activePopup = null;
    let activeCell = null;
    
    const LOAD_BATCH_DAYS = 30;
    const PRE_LOAD_DAYS = 15;
    const POST_LOAD_DAYS = 45;

    const ROLE_PRIORITY = {
        "addetto taglio": 1, "carpentiere": 2, "saldatore": 3, "tornitore": 4,
        "impiegato": 5, "addetto al montaggio": 6, "elettricista": 7
    };

    // DOM Elements
    const headerRow = document.getElementById('header-row');
    const timelineBody = document.getElementById('timeline-body');
    const container = document.querySelector('.timeline-container');
    const searchInput = document.getElementById('search-notes');
    const detailModal = document.getElementById('personnelDetailModal');
    const detailBody = document.getElementById('personnelDetailBody');
    const detailTitle = document.getElementById('personnelDetailTitle');
    const modalOverlay = document.getElementById('modalOverlay');

    // --- INIT ---
    initGlobalEvents();
    await loadTypes();
    await initialLoad();

    // --- SCORRIMENTO INFINITO ---
    container.addEventListener('scroll', () => {
        if (isLoading) return;
        if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 200) {
            loadMoreDays('forward');
        }
    });

    // --- CARICAMENTO INIZIALE ---
    async function initialLoad() {
        const today = new Date();
        currentStartDate = new Date(today);
        currentStartDate.setDate(today.getDate() - PRE_LOAD_DAYS);
        currentEndDate = new Date(today);
        currentEndDate.setDate(today.getDate() + POST_LOAD_DAYS);

        const persRes = await apiClient.get('/personale?attivo=true&limit=1000');
        personnelData = persRes.data || [];
        sortPersonnel(personnelData);

        renderBaseGridRows();
        await fetchAndAppendData(currentStartDate, currentEndDate);
        setTimeout(scrollToToday, 100);
    }

    async function loadMoreDays(direction) {
        if (isLoading) return;
        isLoading = true;

        let start, end;
        if (direction === 'forward') {
            start = new Date(currentEndDate);
            start.setDate(start.getDate() + 1);
            end = new Date(start);
            end.setDate(end.getDate() + LOAD_BATCH_DAYS);
            currentEndDate = end;
        }

        await fetchAndAppendData(start, end);
        isLoading = false;
    }

    async function fetchAndAppendData(start, end) {
        const sStr = formatDateISO(start);
        const eStr = formatDateISO(end);
        
        try {
            const presenzeRes = await apiClient.get(`/presenze?startDate=${sStr}&endDate=${eStr}`);
            const newData = presenzeRes || [];
            
            newData.forEach(rec => {
                loadedDataMap[`${rec.id_personale_fk}_${rec.data}`] = rec;
            });

            appendColumns(start, end);

        } catch (err) { console.error("Errore fetch dati:", err); }
    }

    function renderBaseGridRows() {
        timelineBody.innerHTML = '';
        personnelData.forEach(person => {
            const tr = document.createElement('tr');
            tr.dataset.personId = person.id_personale;
            
            const th = document.createElement('th');
            th.textContent = person.nome_cognome;
            th.title = person.nome_cognome;
            th.addEventListener('click', () => openPersonnelDetail(person));
            
            tr.appendChild(th);
            timelineBody.appendChild(tr);
        });
    }

    function appendColumns(start, end) {
        const tempDate = new Date(start);
        const todayStr = formatDateISO(new Date());
        const datesToAdd = [];
        
        while (tempDate <= end) {
            datesToAdd.push(new Date(tempDate));
            tempDate.setDate(tempDate.getDate() + 1);
        }

        datesToAdd.forEach(d => {
            const dateStr = formatDateISO(d);
            const dayNum = d.getDate();
            const dayName = d.toLocaleString('it-IT', { weekday: 'short' });
            const isWeekend = (d.getDay() === 0 || d.getDay() === 6);
            const isToday = (dateStr === todayStr);

            const th = document.createElement('th');
            th.innerHTML = `${dayNum}<br><small>${dayName}</small>`;
            th.dataset.date = dateStr;
            if (isWeekend) th.classList.add('weekend-column');
            if (isToday) th.classList.add('is-today');
            th.addEventListener('click', (e) => applyColumnColorPrompt(e, dateStr));
            headerRow.appendChild(th);
        });

        const rows = Array.from(timelineBody.querySelectorAll('tr'));
        rows.forEach(tr => {
            const personId = parseInt(tr.dataset.personId);
            
            datesToAdd.forEach(d => {
                const dateStr = formatDateISO(d);
                const isWeekend = (d.getDay() === 0 || d.getDay() === 6);
                
                const td = document.createElement('td');
                td.dataset.date = dateStr;
                td.dataset.personId = personId;
                if (isWeekend) td.classList.add('weekend-column');

                const record = loadedDataMap[`${personId}_${dateStr}`];
                if (record) renderCellContent(td, record);

                td.addEventListener('click', (e) => handleQuickEdit(e, td));
                td.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    handleVisualEdit(e, td);
                });

                tr.appendChild(td);
            });
        });
    }

    function scrollToToday() {
        const todayStr = formatDateISO(new Date());
        const todayHeader = headerRow.querySelector(`th[data-date="${todayStr}"]`);
        if (todayHeader) {
            const containerCenter = container.clientWidth / 2;
            const headerLeft = todayHeader.offsetLeft;
            const headerWidth = todayHeader.offsetWidth;
            container.scrollLeft = headerLeft - containerCenter + (headerWidth / 2);
        }
    }

    // --- VISUAL POPUP (GRID MODE) ---
    function handleVisualEdit(e, td) {
        if (activePopup) activePopup.remove();
        
        const pid = td.dataset.personId;
        const date = td.dataset.date;
        const record = loadedDataMap[`${pid}_${date}`] || {};

        const popup = document.createElement('div');
        popup.className = 'visual-popup';
        
        // Posizionamento smart (evita bordo destro)
        let leftPos = e.pageX;
        if (e.pageX + 300 > window.innerWidth) leftPos = e.pageX - 300;
        
        popup.style.top = `${e.pageY}px`;
        popup.style.left = `${leftPos}px`;

        let gridHtml = '';
        // Opzione Standard (Reset)
        gridHtml += `
            <div class="type-option-btn ${!record.id_tipo_presenza_fk ? 'selected' : ''}" data-id="">
                <span class="type-option-icon">⬜</span>
                <span class="type-option-label">Standard</span>
            </div>
        `;
        
        Object.values(typesById).sort((a,b)=>(a.etichetta||'').localeCompare(b.etichetta||'')).forEach(t => {
            const isSel = (record.id_tipo_presenza_fk === t.id_tipo);
            const icon = t.icona || '❓';
            gridHtml += `
                <div class="type-option-btn ${isSel ? 'selected' : ''}" data-id="${t.id_tipo}" title="${t.nome_tipo}">
                    <span class="type-option-icon">${icon}</span>
                    <span class="type-option-label">${t.etichetta}</span>
                </div>
            `;
        });

        const colors = ['none', 'red', 'yellow', 'green', 'blue'];
        let colorHtml = '';
        colors.forEach(c => {
            const sel = (record.colore === c || (!record.colore && c==='none')) ? 'selected' : '';
            colorHtml += `<div class="color-dot-sm ${sel}" data-color="${c}"></div>`;
        });

        popup.innerHTML = `
            <h4>${date}</h4>
            <div class="type-grid-container" id="v-type-grid">${gridHtml}</div>
            <hr style="margin: 5px 0; border:0; border-top:1px solid #eee;">
            <div class="popup-input-row">
                <label>Ore:</label>
                <input type="number" id="v-ore" value="${record.numero_ore || ''}" step="0.5">
            </div>
            <div class="popup-color-row" id="v-color-row">${colorHtml}</div>
            <textarea id="v-note" placeholder="Note...">${record.note || ''}</textarea>
            <div class="popup-footer">
                <button class="btn-save" id="v-save">Salva</button>
                <button class="btn-close" id="v-close">Chiudi</button>
            </div>
            <input type="hidden" id="v-tipo-val" value="${record.id_tipo_presenza_fk || ''}">
            <input type="hidden" id="v-color-val" value="${record.colore || 'none'}">
        `;

        document.body.appendChild(popup);
        activePopup = popup;

        popup.querySelectorAll('.type-option-btn').forEach(btn => {
            btn.onclick = () => {
                popup.querySelectorAll('.type-option-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                popup.querySelector('#v-tipo-val').value = btn.dataset.id;
            };
        });

        popup.querySelectorAll('.color-dot-sm').forEach(dot => {
            dot.onclick = () => {
                popup.querySelectorAll('.color-dot-sm').forEach(d => d.classList.remove('selected'));
                dot.classList.add('selected');
                popup.querySelector('#v-color-val').value = dot.dataset.color;
            };
        });

        popup.querySelector('#v-save').onclick = async () => {
            const ore = popup.querySelector('#v-ore').value;
            const tipo = popup.querySelector('#v-tipo-val').value;
            const note = popup.querySelector('#v-note').value;
            const color = popup.querySelector('#v-color-val').value;

            const payload = {
                id_personale_fk: parseInt(pid),
                data: date,
                numero_ore: ore ? parseFloat(ore) : null,
                id_tipo_presenza_fk: tipo ? parseInt(tipo) : null,
                note: note,
                colore: color
            };

            await saveData(payload, td);
            popup.remove();
            activePopup = null;
        };

        popup.querySelector('#v-close').onclick = () => { popup.remove(); activePopup = null; };
    }

    // --- MODIFICA RAPIDA (INPUT) ---
    function handleQuickEdit(e, td) {
        if (td.querySelector('input')) return;
        if (activePopup) activePopup.remove();

        const pid = td.dataset.personId;
        const date = td.dataset.date;
        const record = loadedDataMap[`${pid}_${date}`] || {};

        let initVal = "";
        if (record.numero_ore) initVal += record.numero_ore;
        if (record.id_tipo_presenza_fk && typesById[record.id_tipo_presenza_fk]?.shortcut_key) {
            initVal += " \\" + typesById[record.id_tipo_presenza_fk].shortcut_key;
        }
        if (record.note) initVal += " +" + record.note;

        td.innerHTML = '';
        const input = document.createElement('input');
        input.className = 'cell-input';
        input.value = initVal.trim();
        
        input.onblur = async () => {
            const p = parseQuickCommand(input.value);
            const payload = {
                id_personale_fk: parseInt(pid),
                data: date,
                numero_ore: p.ore,
                id_tipo_presenza_fk: p.idTipo,
                note: p.note,
                colore: record.colore
            };
            await saveData(payload, td);
        };
        input.onkeydown = (ev) => { if(ev.key === 'Enter') input.blur(); };
        input.onclick = (ev) => ev.stopPropagation();

        td.appendChild(input);
        input.focus();
    }

    // --- DATA SAVING ---
    async function saveData(payload, td) {
        try {
            const res = await apiClient.post('/presenze', payload);
            loadedDataMap[`${payload.id_personale_fk}_${payload.data}`] = res;
            renderCellContent(td, res);
        } catch (err) {
            console.error(err);
            alert("Errore salvataggio");
            const old = loadedDataMap[`${payload.id_personale_fk}_${payload.data}`];
            if(old) renderCellContent(td, old); else td.innerHTML='';
        }
    }

    // --- RENDERING CELLA ---
    function renderCellContent(td, record) {
        td.innerHTML = '';
        td.className = '';
        if(td.classList.contains('weekend-column') || new Date(record.data).getDay()%6===0) td.classList.add('weekend-column');
        if(record.colore && record.colore !== 'none') td.classList.add(`cell-color-${record.colore}`);

        // Wrapper per layout orizzontale
        const wrapper = document.createElement('div');
        wrapper.className = 'cell-content-wrapper';

        // 1. Etichetta Tipo (Solo se presente)
        if (record.id_tipo_presenza_fk && typesById[record.id_tipo_presenza_fk]) {
            const t = typesById[record.id_tipo_presenza_fk];
            if (t.etichetta) {
                const badge = document.createElement('span');
                badge.className = 'chip';
                badge.textContent = t.etichetta;
                if(t.colore_hex) badge.style.backgroundColor = t.colore_hex;
                else badge.style.backgroundColor = '#ccc';
                wrapper.appendChild(badge);
            }
        }

        // 2. Ore (Solo se presenti)
        if (record.numero_ore) {
            const chip = document.createElement('span');
            chip.className = 'chip ore';
            chip.textContent = record.numero_ore;
            wrapper.appendChild(chip);
        }

        td.appendChild(wrapper);

        // 3. Nota (Indicatore fuori dal wrapper, posizionato assoluto)
        if (record.note) {
            const ind = document.createElement('div');
            ind.className = 'note-indicator';
            ind.title = record.note;
            td.appendChild(ind);
        }
    }

    // --- HELPERS ---
    async function loadTypes() {
        try {
            const res = await apiClient.get('/presenze/tipi');
            (res || []).forEach(t => {
                typesById[t.id_tipo] = t;
                if(t.shortcut_key) shortcutMap[t.shortcut_key.toLowerCase().trim()] = t.id_tipo;
            });
        } catch(e){ console.error(e); }
    }

    function sortPersonnel(list) {
        list.sort((a,b) => {
            const pA = ROLE_PRIORITY[a.ruoli?.nome_ruolo?.toLowerCase()] || 99;
            const pB = ROLE_PRIORITY[b.ruoli?.nome_ruolo?.toLowerCase()] || 99;
            return pA - pB || a.nome_cognome.localeCompare(b.nome_cognome);
        });
    }

    function parseQuickCommand(text) {
        let ore=null, idTipo=null, note=null;
        if(!text) return {ore,idTipo,note};
        
        const noteM = text.match(/\+(.*)/);
        if(noteM) { note=noteM[1].trim(); text=text.replace(noteM[0],''); }
        
        const cmdM = text.match(/\\([a-zA-Z0-9])/);
        if(cmdM) {
            const code = cmdM[1].toLowerCase();
            if(shortcutMap[code]) idTipo=shortcutMap[code];
            text=text.replace(cmdM[0],'');
        }
        
        const numM = text.match(/(\d+(\.\d+)?)/);
        if(numM) ore=parseFloat(numM[0]);
        
        return {ore,idTipo,note};
    }

    function formatDateISO(d) { return d.toISOString().split('T')[0]; }

    async function applyColumnColorPrompt(e, dateStr) {
        const color = prompt("Scrivi colore (red, yellow, green, blue, none):");
        if(color) {
            try {
                await apiClient.post('/presenze/colore-colonna', {data:dateStr, colore});
                alert("Colore aggiornato. Scorri per aggiornare o ricarica.");
            } catch(e) { alert("Errore"); }
        }
    }

    function openPersonnelDetail(p) { 
        detailTitle.textContent = p.nome_cognome;
        detailModal.style.display = 'block'; 
        modalOverlay.style.display = 'block';
    }
    
    function initGlobalEvents() {
        document.querySelectorAll('.close-button, .modal-overlay').forEach(el=>{
            el.addEventListener('click', ()=>{
                detailModal.style.display='none'; modalOverlay.style.display='none';
            });
        });
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('td[data-date]').forEach(td => {
                const note = td.querySelector('.note-indicator')?.title?.toLowerCase() || '';
                td.style.opacity = (term && !note.includes(term)) ? '0.2' : '1';
            });
        });
    }
});