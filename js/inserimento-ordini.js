// js/inserimento-ordini.js

import { apiFetch } from './api-client.js';
import { showSuccessFeedbackModal, showModal } from './shared-ui.js';
import { IsAdmin } from './core-init.js';

const State = {
    commesseList: [], 
    fasiList: [], // Rinominato da ruoliList
    stagedRows: [],
    knownDefaults: {}
};

document.addEventListener('DOMContentLoaded', async () => {
    // --- AGGIUNTA: Blocco di sicurezza Admin ---
    if (!IsAdmin) {
        window.location.replace('index.html');
        return;
    }
    // ------------------------------------------
    setupDragAndDrop();
    await loadReferenceData();
    
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    document.getElementById('clearBtn').addEventListener('click', clearPreview);
    document.getElementById('confirmBtn').addEventListener('click', saveProductionRows);
    document.getElementById('addManualRowBtn').addEventListener('click', addManualRow);
    
    renderPreviewTable();
});

async function loadReferenceData() {
    try {
        const commRes = await apiFetch('/api/commesse/view?limit=1000&status=In Lavorazione');
        const commData = await commRes.json();
        
        State.commesseList = (commData.data || []).map(c => ({
            id: c.id_commessa,
            label: `${c.vo || '???'} - ${c.clienti?.ragione_sociale || ''} (${c.impianto || ''})`,
            vo: c.vo
        }));

        // MODIFICA: Carichiamo le FASI invece dei ruoli
        const fasiRes = await apiFetch('/api/commesse/fasi'); // Endpoint esistente
        const fasiData = await fasiRes.json();
        
        State.fasiList = (fasiData || []).map(f => ({
            id: f.id_fase,
            label: f.nome_fase
        }));

        console.log("✅ Dati caricati:", State.commesseList.length, "commesse,", State.fasiList.length, "fasi.");
    } catch (error) {
        console.error("Errore caricamento dati:", error);
        showModal({ title: "Errore", message: "Impossibile caricare le anagrafiche." });
    }
}

// ============================================================
// 2. GESTIONE DRAG & DROP & UI
// ============================================================
function setupDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
    });
    
    dropZone.addEventListener('dragenter', () => dropZone.classList.add('dragover'));
    dropZone.addEventListener('dragover', () => dropZone.classList.add('dragover'));
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
}

function handleFileSelect(e) { handleFiles(e.target.files); }

async function handleFiles(files) {
    const spinner = document.getElementById('upload-spinner');
    spinner.style.display = 'block';
    
    const fileArray = [...files];
    let processedCount = 0;
    
    // --- UI Update: Mantieni nome file ---
    const dropZone = document.getElementById('drop-zone');
    const title = document.getElementById('drop-title');
    const subtitle = document.getElementById('drop-subtitle');
    
    if (fileArray.length > 0) {
        const fileName = fileArray[0].name;
        const extra = fileArray.length > 1 ? ` (+ altri ${fileArray.length - 1})` : '';
        title.innerHTML = `<div class="filename-display">📄 ${fileName}${extra}</div>`;
        subtitle.textContent = "Analisi in corso...";
    }

    // --- Parsing ---
    for (const file of fileArray) {
        if (file.type === 'application/pdf') {
            try {
                await parsePDF(file);
                processedCount++;
            } catch (err) {
                console.error(`Errore parsing file ${file.name}:`, err);
                showModal({ title: "Errore Lettura", message: `Impossibile leggere ${file.name}. Verifica che sia un PDF valido.` });
            }
        }
    }

    // --- Check Auto-learning ---
    if (State.stagedRows.length > 0) {
        const uniqueCodes = [...new Set(State.stagedRows.map(r => r.codice_articolo))];
        try {
            const res = await apiFetch('/api/produzione/check-articoli', {
                method: 'POST',
                body: JSON.stringify({ codici: uniqueCodes })
            });
            if (res.ok) {
                State.knownDefaults = await res.json();
            }
        } catch (e) { console.warn(e); }
    }

    spinner.style.display = 'none';
    
    if (processedCount > 0 && State.stagedRows.length > 0) {
        dropZone.classList.add('file-loaded');
        subtitle.textContent = "Righe aggiunte alla tabella sottostante";
        renderPreviewTable();
    } else {
        if (processedCount > 0 && State.stagedRows.length === 0) {
            title.textContent = "Nessun dato trovato nel PDF";
            subtitle.textContent = "Il formato del file potrebbe non essere supportato.";
        } else {
            title.textContent = "Errore o File non valido";
            subtitle.textContent = "Riprova con un PDF valido";
        }
        
        setTimeout(() => {
            if (!dropZone.classList.contains('file-loaded')) {
                title.textContent = "Trascina qui il PDF";
                subtitle.textContent = "oppure clicca per selezionare";
            }
        }, 4000);
    }
}

// ============================================================
// 3. PARSING PDF
// ============================================================
async function parsePDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        
        // 1. OP
        const opMatch = pageText.match(/(?:Ordine\s+di\s+Produzione\s+n\.|OP)\s*[:.]?\s*([0-9-]{6,})/i);
        const opNumber = opMatch ? opMatch[1].trim() : "???";

        // 2. Commessa
        const voMatch = pageText.match(/(?:Commessa|VO)\s*[:.]?\s*(VO\s*[\d-]+|[\d-]{5,})/i);
        let voNumber = voMatch ? voMatch[1].trim() : null;
        
        // 3. Codice Articolo
        const codeMatch = pageText.match(/Nr\.?\s*Articolo\s*[:.]?\s*(\d+)/i);
        const codice = codeMatch ? codeMatch[1].trim() : "";

        // 4. Quantità
        const qtyMatch = pageText.match(/Quantit[àa]\s*[:.]?\s*(\d+)/i);
        const qta = qtyMatch ? parseFloat(qtyMatch[1]) : 1;

        // 5. Data Intestazione
        const dateMatch = pageText.match(/(\d{2}\/\d{2}\/\d{4})/);
        let dataRicezione = new Date().toISOString().split('T')[0];
        
        if (dateMatch) {
            const rawDate = dateMatch[1]; 
            const parts = rawDate.split('/');
            if (parts.length === 3) {
                dataRicezione = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }

        // 6. Descrizione
        const descMatch = pageText.match(/Descrizione\s+(.+?)\s+(?=Magazzino|Data Inizio|ENEL|Cod\.)/i);
        let descrizione = descMatch ? descMatch[1].trim() : "";
        descrizione = descrizione.replace(/Qt[àa] riordino fissa/gi, "").trim().toLowerCase();
        
        if (!descrizione && codice) {
            descrizione = "descrizione non rilevata";
        }

        // Matching Commessa
        let preselectedCommessaId = "";
        if (voNumber) {
            const cleanVO = voNumber.replace(/^VO/i, '').trim(); 
            const found = State.commesseList.find(c => c.vo && c.vo.includes(cleanVO));
            if (found) preselectedCommessaId = found.id;
        }

        if (codice) {
            State.stagedRows.push({
                op: opNumber,
                vo_detected: voNumber,
                commessa_id: preselectedCommessaId,
                codice_articolo: codice,
                descrizione: descrizione,
                qta: qta,
                data_ricezione: dataRicezione,
                manual: false
            });
        }
    }
}

// ============================================================
// 4. FUNZIONI UI TABELLA E INPUT MASKING
// ============================================================

function addManualRow() {
    State.stagedRows.push({
        op: "",
        vo_detected: null,
        commessa_id: "",
        codice_articolo: "",
        descrizione: "",
        qta: 1,
        data_ricezione: new Date().toISOString().split('T')[0],
        manual: true
    });
    renderPreviewTable();
    
    const tableContainer = document.querySelector('.table-responsive');
    if(tableContainer) {
        setTimeout(() => tableContainer.scrollTop = tableContainer.scrollHeight, 100);
    }
}

function renderPreviewTable() {
    const tbody = document.getElementById('preview-body');
    tbody.innerHTML = '';

    if (State.stagedRows.length === 0) {
        tbody.innerHTML = `<tr class="empty-state-row"><td colspan="9">Nessun dato. Carica un PDF o aggiungi una riga manuale.</td></tr>`;
        return;
    }

    State.stagedRows.forEach((row, index) => {
        const tr = document.createElement('tr');
        // Usiamo il default noto (che ora è un ID FASE)
        const defaultFaseId = State.knownDefaults[row.codice_articolo] || "";

        const opReadonly = row.manual ? '' : 'readonly';
        const opBg = row.manual ? '#ffffff' : '#f9f9f9';
        const codeReadonly = row.manual ? '' : 'readonly';
        const codeBg = row.manual ? '#ffffff' : '#f9f9f9';

        const statusHtml = row.commessa_id 
            ? `<span class="badge-ok">OK</span>` 
            : `<span class="badge-new">Check</span>`;
        
        if (!row.commessa_id) tr.style.backgroundColor = '#fff5f5';

        const commessaOptions = State.commesseList.map(c => 
            `<option value="${c.id}" ${c.id == row.commessa_id ? 'selected' : ''}>${c.label}</option>`
        ).join('');
        
        // MODIFICA: Usiamo fasiList
        const fasiOptions = `<option value="">-- Fase --</option>` + 
            State.fasiList.map(f => {
                const isSelected = String(f.id) === String(defaultFaseId);
                return `<option value="${f.id}" ${isSelected ? 'selected' : ''}>${f.label}</option>`;
            }).join('');

        tr.innerHTML = `
            <td>${statusHtml}</td>
            <td><input type="text" value="${row.op}" class="input-flat op-input" ${opReadonly} style="width:90px; background:${opBg}; font-size:0.85rem;" placeholder="00-0000" maxlength="7"></td>
            <td><select class="input-select commessa-select" style="min-width: 180px;"><option value="">-- Seleziona --</option>${commessaOptions}</select></td>
            <td><input type="date" value="${row.data_ricezione}" class="input-flat date-input" style="width:110px;"></td>
            <td><input type="text" value="${row.codice_articolo}" class="input-flat code-input" ${codeReadonly} style="background:${codeBg}; width:80px;" placeholder="000000" maxlength="6"></td>
            <td><input type="text" value="${row.descrizione}" class="input-flat desc-input" style="text-transform:lowercase;"></td>
            <td><input type="number" value="${row.qta}" class="input-flat qty-input" style="width:50px;"></td>
            
            <!-- MODIFICA: Select Fase invece di Ruolo -->
            <td><select class="input-select fase-select" style="min-width: 130px;">${fasiOptions}</select></td>
            
            <td style="text-align:center;"><button class="btn-icon delete-row-btn" data-idx="${index}">🗑️</button></td>
        `;
        tbody.appendChild(tr);
    });

    bindTableEvents();
}

function bindTableEvents() {
    // Delete
    document.querySelectorAll('.delete-row-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            State.stagedRows.splice(idx, 1);
            renderPreviewTable();
        });
    });

    // Masking OP + Update Title
    document.querySelectorAll('.op-input:not([readonly])').forEach(input => {
        input.addEventListener('input', (e) => {
            let val = e.target.value.replace(/[^0-9]/g, '');
            if (val.length > 6) val = val.substring(0, 6);
            if (val.length > 2) {
                e.target.value = val.substring(0, 2) + '-' + val.substring(2);
            } else {
                e.target.value = val;
            }
            // Aggiorna il tooltip col nuovo valore
            e.target.title = e.target.value;
        });
    });

    // Masking Codice + Update Title
    document.querySelectorAll('.code-input:not([readonly])').forEach(input => {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').substring(0, 6);
            e.target.title = e.target.value;
        });
    });

    // Masking Descrizione + Update Title
    document.querySelectorAll('.desc-input').forEach(input => {
        // Al caricamento, setta il title se non c'è (ridondante ma sicuro)
        if(!input.title) input.title = input.value;
        
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.toLowerCase();
            e.target.title = e.target.value;
        });
    });
}

function clearPreview() {
    State.stagedRows = [];
    State.knownDefaults = {};
    const dropZone = document.getElementById('drop-zone');
    dropZone.classList.remove('file-loaded');
    document.getElementById('drop-title').textContent = "Trascina qui il PDF";
    document.getElementById('drop-subtitle').textContent = "oppure clicca per selezionare";
    renderPreviewTable();
}

// ============================================================
// 5. SALVATAGGIO
// ============================================================
async function saveProductionRows() {
    const rows = document.querySelectorAll('#preview-body tr');
    if (rows.length === 1 && rows[0].classList.contains('empty-state-row')) return;

    const payload = [];
    let hasErrors = false;

    rows.forEach(tr => {
        const commessaId = tr.querySelector('.commessa-select').value;
        const codice = tr.querySelector('.code-input').value;
        const descrizione = tr.querySelector('.desc-input').value;
        const qta = tr.querySelector('.qty-input').value;
        const op = tr.querySelector('.op-input').value;
        const dataRicezione = tr.querySelector('.date-input').value;
        
        // MODIFICA: Leggiamo fase-select
        const faseId = tr.querySelector('.fase-select').value;

        tr.style.border = 'none';

        if (!commessaId || !codice || !qta || !op || !dataRicezione) {
            tr.style.border = '2px solid #e53e3e';
            hasErrors = true;
            return;
        }

        payload.push({
            numero_op: op,
            id_commessa: parseInt(commessaId),
            codice_articolo: codice,
            descrizione: descrizione.toLowerCase(),
            qta_richiesta: parseInt(qta),
            data_ricezione: dataRicezione,
            id_fase: faseId ? parseInt(faseId) : null // MODIFICA: id_fase
        });
    });

    if (hasErrors) {
        showModal({ title: "Dati Mancanti", message: "Compilare tutti i campi obbligatori." });
        return;
    }

    if (payload.length === 0) return;

    const btn = document.getElementById('confirmBtn');
    btn.textContent = "Salvataggio...";
    btn.disabled = true;

    try {
        const res = await apiFetch('/api/produzione/import', {
            method: 'POST',
            body: JSON.stringify({ righe: payload })
        });

        if (!res.ok) throw new Error("Errore salvataggio");

        const result = await res.json();
        let msg = `Inserite: ${result.imported}.`;
        if (result.skipped > 0) msg += ` (Saltati ${result.skipped} duplicati).`;

        showSuccessFeedbackModal("Operazione Completata", msg);
        
        setTimeout(() => { 
            clearPreview(); 
            btn.textContent = "Salva Ordini";
            btn.disabled = false;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 2000);

    } catch (error) {
        console.error(error);
        showModal({ title: "Errore", message: error.message });
        btn.textContent = "Salva Ordini";
        btn.disabled = false;
    }
}