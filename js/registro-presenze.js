//registro-presenze.js

import { apiFetch } from './api-client.js';
import { IsAdmin } from './core-init.js';

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

    // 2. BLOCCO DI SICUREZZA
    if (!IsAdmin) {
        window.location.replace('index.html');
        return;
    }
    // ---------------------

    // --- VARIABILI GLOBALI ---
    let typesById = {};
    let shortcutMap = {};
    let personnelData = [];
    let loadedDataMap = {};

    let currentStartDate = new Date();
    let currentEndDate = new Date();
    let isLoading = false;
    let lastUpdatedMonth = "";

    let activePopup = null;
    let activeHeaderDate = null;

    let detailCurrentPerson = null;
    let detailCurrentDate = new Date();

    const LOAD_BATCH_DAYS = 15; // Richiesto 15gg su scroll
    const PRE_LOAD_DAYS = 7;    // Richiesto 7gg indietro
    const POST_LOAD_DAYS = 7;   // Richiesto 7gg avanti
    const COLUMN_WIDTH = 75;    // Aggiornato per coerenza con CSS

    const ROLE_PRIORITY = {
        "addetto taglio": 1, "carpentiere": 2, "saldatore": 3, "tornitore": 4,
        "impiegato": 5, "addetto al montaggio": 6, "elettricista": 7
    };

    // DOM Elements
    const headerRow = document.getElementById('header-row');
    const timelineBody = document.getElementById('timeline-body');
    const container = document.querySelector('.timeline-container');
    const currentMonthDisplay = document.getElementById('current-month-display');
    const searchInput = document.getElementById('search-notes');

    const detailModal = document.getElementById('personnelDetailModal');
    const detailTitle = document.getElementById('personnelDetailTitle');
    const detailMonthLabel = document.getElementById('detailMonthLabel');
    const modalOverlay = document.getElementById('modalOverlay');
    const colorPickerPopup = document.getElementById('colorPickerPopup');

    // --- INIT ---
    initGlobalEvents();
    await loadTypes();
    await initialLoad();

    // --- SCORRIMENTO & AGGIORNAMENTO ---
    container.addEventListener('scroll', () => {
        if (isLoading) return;
        updateVisibleMonthHeader();
        const scrollLeft = container.scrollLeft;
        const maxScroll = container.scrollWidth - container.clientWidth;
        if (scrollLeft >= maxScroll - 200) loadMoreDays('forward');
        else if (scrollLeft < 50) loadMoreDays('backward');
    });

    function updateVisibleMonthHeader() {
        const checkPoint = container.scrollLeft + 180 + 20;
        const headers = headerRow.querySelectorAll('th[data-date]');
        let targetDate = null;
        for (const th of headers) {
            if (th.offsetLeft + th.offsetWidth > checkPoint) {
                targetDate = th.dataset.date;
                break;
            }
        }
        if (targetDate) {
            const dateObj = new Date(targetDate);
            const monthLabel = dateObj.toLocaleString('it-IT', { month: 'long', year: 'numeric' }).toUpperCase();
            if (monthLabel !== lastUpdatedMonth) {
                currentMonthDisplay.textContent = monthLabel;
                lastUpdatedMonth = monthLabel;
            }
        }
    }

    // --- CARICAMENTO ---
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
        await fetchAndRenderData(currentStartDate, currentEndDate, 'forward');
        setTimeout(() => { scrollToToday(); updateVisibleMonthHeader(); }, 100);
    }

    async function loadMoreDays(direction) {
        if (isLoading) return;
        isLoading = true;
        let start, end;
        if (direction === 'forward') {
            start = new Date(currentEndDate); start.setDate(start.getDate() + 1);
            end = new Date(start); end.setDate(end.getDate() + LOAD_BATCH_DAYS);
            currentEndDate = end;
        } else {
            end = new Date(currentStartDate); end.setDate(end.getDate() - 1);
            start = new Date(end); start.setDate(start.getDate() - LOAD_BATCH_DAYS);
            currentStartDate = start;
        }
        await fetchAndRenderData(start, end, direction);
        isLoading = false;
    }

    async function fetchAndRenderData(start, end, direction) {
        const sStr = formatDateISO(start);
        const eStr = formatDateISO(end);
        try {
            const presenzeRes = await apiClient.get(`/presenze?startDate=${sStr}&endDate=${eStr}`);
            const newData = presenzeRes || [];
            newData.forEach(rec => { loadedDataMap[`${rec.id_personale_fk}_${rec.data}`] = rec; });
            if (direction === 'forward') appendColumns(start, end);
            else prependColumns(start, end);
        } catch (err) { console.error("Errore fetch dati:", err); }
    }

    // --- MODIFICA QUI: AGGIUNTA DOPPIO BOTTONE NELLA COLONNA NOME ---
    function renderBaseGridRows() {
        timelineBody.innerHTML = '';
        const fragment = document.createDocumentFragment();

        personnelData.forEach(person => {
            const tr = document.createElement('tr');
            tr.dataset.personId = person.id_personale;

            const th = document.createElement('th');
            th.style.display = 'flex';
            th.style.justifyContent = 'space-between';
            th.style.alignItems = 'center';

            // 1. Nome Utente
            const nameSpan = document.createElement('span');
            nameSpan.textContent = person.nome_cognome;
            nameSpan.title = person.nome_cognome;
            nameSpan.style.cursor = 'pointer';
            nameSpan.style.overflow = 'hidden';
            nameSpan.style.textOverflow = 'ellipsis';
            nameSpan.style.flexGrow = '1';
            nameSpan.addEventListener('click', () => openPersonnelDetail(person));

            // 2. Contenitore Icone (Matita + Stampante)
            const actionsDiv = document.createElement('div');
            actionsDiv.style.display = 'flex';
            actionsDiv.style.gap = '2px';
            actionsDiv.style.flexShrink = '0';

            // A. Bottone Modifica (Matita) -> inserimento-ore.html
            const editLink = document.createElement('a');
            editLink.className = 'user-action-btn'; // Classe CSS aggiornata
            editLink.innerHTML = '✏️';
            editLink.title = `Inserisci ore per ${person.nome_cognome}`;
            editLink.href = `inserimento-ore.html?adminMode=true&targetUserId=${person.id_personale}&targetUserName=${encodeURIComponent(person.nome_cognome)}`;
            editLink.target = '_blank';
            editLink.addEventListener('click', (e) => e.stopPropagation());

            // B. Bottone Report (Stampante) -> stampa-ore.html
            const reportLink = document.createElement('a');
            reportLink.className = 'user-action-btn';
            reportLink.innerHTML = '📄';
            reportLink.title = `Report Mensile per ${person.nome_cognome}`;
            // NOTA: Qui costruiamo l'URL per l'accesso ADMIN
            reportLink.href = `stampa-ore.html?adminMode=true&targetUserId=${person.id_personale}&targetUserName=${encodeURIComponent(person.nome_cognome)}`;
            reportLink.target = '_blank';
            reportLink.addEventListener('click', (e) => e.stopPropagation());

            actionsDiv.appendChild(editLink);
            actionsDiv.appendChild(reportLink);

            th.appendChild(nameSpan);
            th.appendChild(actionsDiv);
            tr.appendChild(th);

            fragment.appendChild(tr);
        });

        timelineBody.appendChild(fragment);
    }

    function appendColumns(start, end) {
        const datesToAdd = generateDateRange(start, end);
        const todayStr = formatDateISO(new Date());
        datesToAdd.forEach(d => headerRow.appendChild(createHeaderCell(d, todayStr)));
        const rows = Array.from(timelineBody.querySelectorAll('tr'));
        rows.forEach(tr => {
            const pid = parseInt(tr.dataset.personId);
            datesToAdd.forEach(d => tr.appendChild(createBodyCell(d, pid)));
        });
    }

    function prependColumns(start, end) {
        const datesToAdd = generateDateRange(start, end);
        const todayStr = formatDateISO(new Date());
        const addedWidth = datesToAdd.length * COLUMN_WIDTH;
        const currentScroll = container.scrollLeft;
        const firstDayHeader = headerRow.children[1];

        datesToAdd.forEach(d => headerRow.insertBefore(createHeaderCell(d, todayStr), firstDayHeader));

        const rows = Array.from(timelineBody.querySelectorAll('tr'));
        rows.forEach(tr => {
            const pid = parseInt(tr.dataset.personId);
            const firstDataCell = tr.children[1];
            datesToAdd.forEach(d => tr.insertBefore(createBodyCell(d, pid), firstDataCell));
        });
        container.scrollLeft = currentScroll + addedWidth;
    }

    function generateDateRange(start, end) {
        const arr = [];
        let dt = new Date(start);
        while (dt <= end) { arr.push(new Date(dt)); dt.setDate(dt.getDate() + 1); }
        return arr;
    }

    function createHeaderCell(d, todayStr) {
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

        th.addEventListener('click', (e) => openColorPicker(e, dateStr));

        return th;
    }

    function calculateStatusClass(record, isWeekend) {
        let realWorkHours = 0;
        if (record && record.ore_effettive !== undefined && record.ore_effettive !== null) {
            realWorkHours = parseFloat(record.ore_effettive);
        }

        if (realWorkHours >= 8) return 'status-ok';
        else if (realWorkHours > 0) return 'status-warning';
        else if (!isWeekend) return 'status-missing';
        return null;
    }

    function createBodyCell(d, pid) {
        const dateStr = formatDateISO(d);
        const isWeekend = (d.getDay() === 0 || d.getDay() === 6);
        const td = document.createElement('td');
        td.dataset.date = dateStr;
        td.dataset.personId = pid;

        if (isWeekend) {
            td.dataset.isWeekend = "true";
            td.classList.add('weekend-column');
        }

        const record = loadedDataMap[`${pid}_${dateStr}`];

        if (record) renderCellContent(td, record);

        const statusClass = calculateStatusClass(record, isWeekend);
        if (statusClass) {
            const indicator = document.createElement('div');
            indicator.className = `status-indicator ${statusClass}`;
            td.appendChild(indicator);
        }

        td.addEventListener('click', (e) => handleQuickEdit(e, td));
        td.addEventListener('contextmenu', (e) => { e.preventDefault(); handleVisualEdit(e, td); });

        return td;
    }

    function scrollToToday() {
        const todayStr = formatDateISO(new Date());
        const todayHeader = headerRow.querySelector(`th[data-date="${todayStr}"]`);
        if (todayHeader) {
            const containerCenter = container.clientWidth / 2;
            const headerLeft = todayHeader.offsetLeft;
            const headerWidth = todayHeader.offsetWidth;
            container.scrollLeft = headerLeft - containerCenter + (headerWidth / 2) - 180;
        }
    }

    // ... (Resto delle funzioni: openColorPicker, DetailModal, VisualEdit, QuickEdit, etc. rimangono invariate) ...

    function openColorPicker(e, dateStr) {
        e.stopPropagation();
        activeHeaderDate = dateStr;
        colorPickerPopup.style.left = `${e.pageX}px`;
        colorPickerPopup.style.top = `${e.pageY + 10}px`;
        colorPickerPopup.style.display = 'block';
    }

    async function applyColumnColor(dateStr, color) {
        try {
            await apiClient.post('/presenze/colore-colonna', { data: dateStr, colore: color });
            alert("Colore aggiornato. La pagina verrà ricaricata.");
            location.reload();
        } catch (e) { console.error(e); alert("Errore aggiornamento colonna."); }
    }

    function openPersonnelDetail(person) {
        detailCurrentPerson = person;
        detailCurrentDate = new Date();
        detailCurrentDate.setDate(1);
        detailTitle.textContent = person.nome_cognome;
        updateDetailModal();
        detailModal.style.display = 'block';
        modalOverlay.style.display = 'block';
    }

    document.getElementById('btnDetailPrev').addEventListener('click', () => { detailCurrentDate.setMonth(detailCurrentDate.getMonth() - 1); updateDetailModal(); });
    document.getElementById('btnDetailNext').addEventListener('click', () => { detailCurrentDate.setMonth(detailCurrentDate.getMonth() + 1); updateDetailModal(); });

    async function updateDetailModal() {
        if (!detailCurrentPerson) return;
        const monthLabel = detailCurrentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' }).toUpperCase();
        detailMonthLabel.textContent = monthLabel;
        const modalBodyContainer = document.querySelector('#personnelDetailModal .modal-body');
        modalBodyContainer.innerHTML = '<div style="text-align:center; padding:20px;">Caricamento...</div>';

        const year = detailCurrentDate.getFullYear();
        const month = detailCurrentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const sStr = formatDateISO(firstDay);
        const eStr = formatDateISO(lastDay);

        try {
            const res = await apiClient.get(`/presenze?startDate=${sStr}&endDate=${eStr}`);
            const dataList = res || [];
            const personRecords = dataList.filter(r => r.id_personale_fk === detailCurrentPerson.id_personale);
            const recordMap = {};
            personRecords.forEach(r => recordMap[r.data] = r);

            let leftRowsHtml = ''; let rightRowsHtml = '';
            for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
                const dayNum = d.getDate();
                const dateStr = formatDateISO(d);
                const dayName = d.toLocaleString('it-IT', { weekday: 'short' });
                const isWeekend = (d.getDay() === 0 || d.getDay() === 6);
                const rec = recordMap[dateStr] || {};
                let rowClass = '';
                if (rec.colore && rec.colore !== 'none') rowClass = `detail-row-${rec.colore}`;
                else if (isWeekend) rowClass = 'detail-row-weekend';

                let tipoHtml = '';
                if (rec.id_tipo_presenza_fk && typesById[rec.id_tipo_presenza_fk]) {
                    const t = typesById[rec.id_tipo_presenza_fk];
                    if (t.etichetta) {
                        const bg = t.colore_hex || '#999';
                        tipoHtml = `<span class="detail-badge" style="background-color:${bg}">${t.etichetta}</span>`;
                    }
                }
                const rowHtml = `
                    <tr class="${rowClass}">
                        <td class="detail-col-day"><strong>${dayNum}</strong> <small>${dayName}</small></td>
                        <td class="detail-col-hours"><strong>${rec.numero_ore || ''}</strong></td>
                        <td class="detail-col-status">${tipoHtml}</td>
                        <td class="detail-col-notes"><div class="detail-note-text">${rec.note || ''}</div></td>
                    </tr>`;
                if (dayNum <= 15) leftRowsHtml += rowHtml; else rightRowsHtml += rowHtml;
            }
            const tableHeader = `<thead><tr><th class="detail-col-day">G</th><th class="detail-col-hours">H</th><th class="detail-col-status">St</th><th class="detail-col-notes">Note</th></tr></thead>`;
            modalBodyContainer.innerHTML = `<div class="modal-split-container"><div class="split-column"><table class="detail-table">${tableHeader}<tbody>${leftRowsHtml}</tbody></table></div><div class="split-column"><table class="detail-table">${tableHeader}<tbody>${rightRowsHtml}</tbody></table></div></div>`;
        } catch (err) { console.error(err); modalBodyContainer.innerHTML = '<div style="color:red; text-align:center;">Errore caricamento dati.</div>'; }
    }

    function handleVisualEdit(e, td) {
        if (activePopup) activePopup.remove();
        const pid = td.dataset.personId;
        const date = td.dataset.date;
        const record = loadedDataMap[`${pid}_${date}`] || {};
        const popup = document.createElement('div');
        popup.className = 'visual-popup';
        let leftPos = e.pageX;
        if (e.pageX + 300 > window.innerWidth) leftPos = e.pageX - 300;
        popup.style.top = `${e.pageY}px`;
        popup.style.left = `${leftPos}px`;

        let gridHtml = `<div class="type-option-btn ${!record.id_tipo_presenza_fk ? 'selected' : ''}" data-id=""><span class="type-option-icon">⬜</span><span class="type-option-label">Standard</span></div>`;
        Object.values(typesById).sort((a, b) => (a.etichetta || '').localeCompare(b.etichetta || '')).forEach(t => {
            const isSel = (record.id_tipo_presenza_fk === t.id_tipo);
            const icon = t.icona || '❓';
            gridHtml += `<div class="type-option-btn ${isSel ? 'selected' : ''}" data-id="${t.id_tipo}" title="${t.nome_tipo}"><span class="type-option-icon">${icon}</span><span class="type-option-label">${t.etichetta}</span></div>`;
        });

        let colorHtml = '';
        ['none', 'red', 'yellow', 'green', 'blue'].forEach(c => {
            const sel = (record.colore === c || (!record.colore && c === 'none')) ? 'selected' : '';
            colorHtml += `<div class="color-dot-sm ${sel}" data-color="${c}"></div>`;
        });

        popup.innerHTML = `
            <h4>${date}</h4>
            <div class="type-grid-container" id="v-type-grid">${gridHtml}</div>
            <hr style="margin: 5px 0; border:0; border-top:1px solid #eee;">
            <div class="popup-input-row"><label>Ore:</label><input type="number" id="v-ore" value="${record.numero_ore || ''}" step="0.5"></div>
            <div class="popup-color-row" id="v-color-row">${colorHtml}</div>
            <textarea id="v-note" placeholder="Note...">${record.note || ''}</textarea>
            <div class="popup-footer"><button class="btn-save" id="v-save">Salva</button><button class="btn-close" id="v-close">Chiudi</button></div>
            <input type="hidden" id="v-tipo-val" value="${record.id_tipo_presenza_fk || ''}">
            <input type="hidden" id="v-color-val" value="${record.colore || 'none'}">
        `;
        document.body.appendChild(popup);
        activePopup = popup;

        popup.querySelectorAll('.type-option-btn').forEach(btn => { btn.onclick = () => { popup.querySelectorAll('.type-option-btn').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); popup.querySelector('#v-tipo-val').value = btn.dataset.id; }; });
        popup.querySelectorAll('.color-dot-sm').forEach(dot => { dot.onclick = () => { popup.querySelectorAll('.color-dot-sm').forEach(d => d.classList.remove('selected')); dot.classList.add('selected'); popup.querySelector('#v-color-val').value = dot.dataset.color; }; });
        popup.querySelector('#v-save').onclick = async () => {
            const ore = popup.querySelector('#v-ore').value;
            const tipo = popup.querySelector('#v-tipo-val').value;
            const note = popup.querySelector('#v-note').value;
            const color = popup.querySelector('#v-color-val').value;
            const payload = { id_personale_fk: parseInt(pid), data: date, numero_ore: ore ? parseFloat(ore) : null, id_tipo_presenza_fk: tipo ? parseInt(tipo) : null, note: note, colore: color };
            await saveData(payload, td);
            popup.remove(); activePopup = null;
        };
        popup.querySelector('#v-close').onclick = () => { popup.remove(); activePopup = null; };
    }

    function handleQuickEdit(e, td) {
        if (td.querySelector('input')) return;
        if (activePopup) activePopup.remove();
        const pid = td.dataset.personId;
        const date = td.dataset.date;
        const record = loadedDataMap[`${pid}_${date}`] || {};
        let initVal = "";
        if (record.numero_ore) initVal += record.numero_ore;
        if (record.id_tipo_presenza_fk && typesById[record.id_tipo_presenza_fk]?.shortcut_key) initVal += " \\" + typesById[record.id_tipo_presenza_fk].shortcut_key;
        if (record.note) initVal += " +" + record.note;
        td.innerHTML = '';
        const input = document.createElement('input');
        input.className = 'cell-input';
        input.value = initVal.trim();
        input.onblur = async () => {
            const p = parseQuickCommand(input.value);
            const payload = { id_personale_fk: parseInt(pid), data: date, numero_ore: p.ore, id_tipo_presenza_fk: p.idTipo, note: p.note, colore: record.colore };
            await saveData(payload, td);
        };
        input.onkeydown = (ev) => { if (ev.key === 'Enter') input.blur(); };
        input.onclick = (ev) => ev.stopPropagation();
        td.appendChild(input);
        input.focus();
    }

    async function saveData(payload, td) {
        try {
            const res = await apiClient.post('/presenze', payload);
            loadedDataMap[`${payload.id_personale_fk}_${payload.data}`] = res;
            updateCellVisuals(td, res);
        } catch (err) {
            console.error(err);
            alert("Errore salvataggio");
            const old = loadedDataMap[`${payload.id_personale_fk}_${payload.data}`];
            if (old) updateCellVisuals(td, old); else td.innerHTML = '';
        }
    }

    function renderCellContent(td, record) {
        if (record.colore && record.colore !== 'none') td.classList.add(`cell-color-${record.colore}`);
        const wrapper = document.createElement('div');
        wrapper.className = 'cell-content-wrapper';
        if (record.id_tipo_presenza_fk && typesById[record.id_tipo_presenza_fk]) {
            const t = typesById[record.id_tipo_presenza_fk];
            if (t.etichetta) {
                const badge = document.createElement('span');
                badge.className = 'chip';
                badge.textContent = t.etichetta;
                if (t.colore_hex) badge.style.backgroundColor = t.colore_hex; else badge.style.backgroundColor = '#ccc';
                wrapper.appendChild(badge);
            }
        }
        if (record.numero_ore) { const chip = document.createElement('span'); chip.className = 'chip ore'; chip.textContent = record.numero_ore; wrapper.appendChild(chip); }
        td.appendChild(wrapper);
        if (record.note) { const ind = document.createElement('div'); ind.className = 'note-indicator'; ind.title = record.note; td.appendChild(ind); }
    }

    function updateCellVisuals(td, record) {
        td.innerHTML = '';
        td.className = '';
        if (td.dataset.isWeekend === "true") td.classList.add('weekend-column');
        if (record) renderCellContent(td, record);
        const statusClass = calculateStatusClass(record, td.dataset.isWeekend === "true");
        if (statusClass) { const indicator = document.createElement('div'); indicator.className = `status-indicator ${statusClass}`; td.appendChild(indicator); }
    }

    async function loadTypes() {
        try {
            const res = await apiClient.get('/presenze/tipi');
            (res || []).forEach(t => { typesById[t.id_tipo] = t; if (t.shortcut_key) shortcutMap[t.shortcut_key.toLowerCase().trim()] = t.id_tipo; });
        } catch (e) { console.error(e); }
    }

    function sortPersonnel(list) {
        list.sort((a, b) => {
            const pA = ROLE_PRIORITY[a.ruoli?.nome_ruolo?.toLowerCase()] || 99;
            const pB = ROLE_PRIORITY[b.ruoli?.nome_ruolo?.toLowerCase()] || 99;
            return pA - pB || a.nome_cognome.localeCompare(b.nome_cognome);
        });
    }

    function parseQuickCommand(text) {
        let ore = null, idTipo = null, note = null;
        if (!text) return { ore, idTipo, note };
        const noteM = text.match(/\+(.*)/);
        if (noteM) { note = noteM[1].trim(); text = text.replace(noteM[0], ''); }
        const cmdM = text.match(/\\([a-zA-Z0-9])/);
        if (cmdM) { const code = cmdM[1].toLowerCase(); if (shortcutMap[code]) idTipo = shortcutMap[code]; text = text.replace(cmdM[0], ''); }
        const numM = text.match(/(\d+(\.\d+)?)/);
        if (numM) ore = parseFloat(numM[0]);
        return { ore, idTipo, note };
    }

    function formatDateISO(d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function initGlobalEvents() {
        document.querySelectorAll('.close-button, .modal-overlay').forEach(el => { el.addEventListener('click', () => { detailModal.style.display = 'none'; modalOverlay.style.display = 'none'; if (colorPickerPopup) colorPickerPopup.style.display = 'none'; }); });
        if (document.getElementById('closeColorPicker')) document.getElementById('closeColorPicker').addEventListener('click', () => { colorPickerPopup.style.display = 'none'; });
        document.querySelectorAll('.color-dot').forEach(dot => { dot.addEventListener('click', async (e) => { const color = e.target.dataset.color; if (activeHeaderDate) { await applyColumnColor(activeHeaderDate, color); } colorPickerPopup.style.display = 'none'; }); });
        searchInput.addEventListener('input', (e) => { const term = e.target.value.toLowerCase(); document.querySelectorAll('td[data-date]').forEach(td => { const note = td.querySelector('.note-indicator')?.title?.toLowerCase() || ''; td.style.opacity = (term && !note.includes(term)) ? '0.2' : '1'; }); });
    }
});