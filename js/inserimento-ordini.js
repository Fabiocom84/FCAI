import { apiFetch } from './api-client.js';
import { showSuccessFeedbackModal, showModal } from './shared-ui.js';

// Stato locale
const State = {
    commesseList: [], 
    ruoliList: [],
    stagedRows: [],
    knownDefaults: {}
};

// ============================================================
// 1. INIZIALIZZAZIONE
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    setupDragAndDrop();
    await loadReferenceData();
    
    // Binding Pulsanti
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

        const ruoliRes = await apiFetch('/api/admin/init-data');
        const ruoliData = await ruoliRes.json();
        
        State.ruoliList = (ruoliData.ruoli || []).map(r => ({
            id: r.id_ruolo,
            label: r.nome_ruolo
        }));

        console.log("✅ Dati caricati:", State.commesseList.length, "commesse,", State.ruoliList.length, "ruoli.");
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
    
    if (processedCount > 0) {
        dropZone.classList.add('file-loaded');
        subtitle.textContent = "Righe aggiunte alla tabella sottostante";
        renderPreviewTable();
    } else {
        title.textContent = "Errore o File non valido";
        subtitle.textContent = "Riprova con un PDF valido";
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
        const opMatch = pageText.match(/Ordine di Produzione n\.\s*(?:OP)?([\d-]+)/i);
        const opNumber = opMatch ? opMatch[1].trim() : "???";

        // 2. Commessa
        const voMatch = pageText.match(/Commessa\s*(?:VO)?([\d-]+)/i);
        const voNumber = voMatch ? voMatch[1].trim() : null;

        // 3. Codice Articolo
        const codeMatch = pageText.match(/Nr\. Articolo\s+(\d+)/i);
        const codice = codeMatch ? codeMatch[1].trim() : "";

        // 4. Quantità
        const qtyMatch = pageText.match(/Quantità\s+(\d+)/i);
        const qta = qtyMatch ? parseFloat(qtyMatch[1]) : 1;

        // 5. Descrizione
        const descMatch = pageText.match(/Descrizione\s+(.+?)\s+(?=Magazzino|Data Inizio)/i);
        let descrizione = descMatch ? descMatch[1].trim() : "";
        // Pulizia e Minuscolo forzato
        descrizione = descrizione.replace("Qtà riordino fissa", "").trim().toLowerCase();

        // 6. DATA INTESTAZIONE (Modificato: cerca 4 cifre per l'anno es. 23/12/2025)
        // La regex cerca una data DD/MM/YYYY. Nel PDF la data del titolo ha l'anno a 4 cifre.
        const dateMatch = pageText.match(/(\d{2}\/\d{2}\/\d{4})/);
        let dataRicezione = new Date().toISOString().split('T')[0]; // Default Oggi
        
        if (dateMatch) {
            const rawDate = dateMatch[1]; // es: 23/12/2025
            const parts = rawDate.split('/');
            if (parts.length === 3) {
                // Formato DB: YYYY-MM-DD
                dataRicezione = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }

        // Matching Commessa
        let preselectedCommessaId = "";
        if (voNumber) {
            const found = State.commesseList.find(c => c.vo && c.vo.includes(voNumber));
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
                data_ricezione: dataRicezione, // Usiamo la data del titolo
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
        data_ricezione: new Date().toISOString().split('T')[0], // Default Oggi
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
        const defaultRoleId = State.knownDefaults[row.codice_articolo] || "";

        // UI Stati
        const opReadonly = row.manual ? '' : 'readonly';
        const opBg = row.manual ? '#ffffff' : '#f9f9f9';
        const codeReadonly = row.manual ? '' : 'readonly';
        const codeBg = row.manual ? '#ffffff' : '#f9f9f9';

        const statusHtml = row.commessa_id 
            ? `<span class="badge-ok">OK</span>` 
            : `<span class="badge-new">Check</span>`;
        
        if (!row.commessa_id) tr.style.backgroundColor = '#fff5f5';

        // Select Options
        const commessaOptions = State.commesseList.map(c => 
            `<option value="${c.id}" ${c.id == row.commessa_id ? 'selected' : ''}>${c.label}</option>`
        ).join('');
        
        const repartiOptions = `<option value="">-- Assegna --</option>` + 
            State.ruoliList.map(r => {
                const isSelected = String(r.id) === String(defaultRoleId);
                return `<option value="${r.id}" ${isSelected ? 'selected' : ''}>${r.label}</option>`;
            }).join('');

        tr.innerHTML = `
            <td>${statusHtml}</td>
            
            <!-- OP -->
            <td><input type="text" value="${row.op}" class="input-flat op-input" ${opReadonly} 
                style="width:90px; background:${opBg}; font-size:0.85rem; font-weight:500;" 
                placeholder="00-0000" maxlength="7"></td>
            
            <!-- Commessa -->
            <td>
                <select class="input-select commessa-select" style="min-width: 180px;">
                    <option value="">-- Seleziona --</option>
                    ${commessaOptions}
                </select>
                ${!row.commessa_id && row.vo_detected ? `<div style="font-size:0.75em; color:red;">VO: ${row.vo_detected}</div>` : ''}
            </td>
            
            <!-- Data -->
            <td><input type="date" value="${row.data_ricezione}" class="input-flat date-input" style="width:110px;"></td>

            <!-- Codice -->
            <td><input type="text" value="${row.codice_articolo}" class="input-flat code-input" ${codeReadonly} 
                style="background:${codeBg}; width:80px;" placeholder="000000" maxlength="6"></td>
            
            <!-- Descrizione -->
            <td><input type="text" value="${row.descrizione}" class="input-flat desc-input" style="text-transform:lowercase;"></td>
            
            <!-- Q.tà -->
            <td><input type="number" value="${row.qta}" class="input-flat qty-input" style="width:50px;"></td>
            
            <!-- Reparto -->
            <td>
                <select class="input-select role-select" style="min-width: 130px;">
                    ${repartiOptions}
                </select>
            </td>
            
            <!-- Azioni -->
            <td style="text-align:center;">
                <button class="btn-icon delete-row-btn" data-idx="${index}">🗑️</button>
            </td>
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

    // Masking OP
    document.querySelectorAll('.op-input:not([readonly])').forEach(input => {
        input.addEventListener('input', (e) => {
            let val = e.target.value.replace(/[^0-9]/g, '');
            if (val.length > 6) val = val.substring(0, 6);
            if (val.length > 2) {
                e.target.value = val.substring(0, 2) + '-' + val.substring(2);
            } else {
                e.target.value = val;
            }
        });
    });

    // Masking Codice
    document.querySelectorAll('.code-input:not([readonly])').forEach(input => {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').substring(0, 6);
        });
    });

    // Masking Descrizione
    document.querySelectorAll('.desc-input').forEach(input => {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.toLowerCase();
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
    let errorMsg = "";

    rows.forEach(tr => {
        const commessaId = tr.querySelector('.commessa-select').value;
        const codice = tr.querySelector('.code-input').value;
        const descrizione = tr.querySelector('.desc-input').value;
        const qta = tr.querySelector('.qty-input').value;
        const op = tr.querySelector('.op-input').value;
        const dataRicezione = tr.querySelector('.date-input').value;
        const ruoloId = tr.querySelector('.role-select').value;

        // Reset
        tr.style.border = 'none';

        // Validazione base
        if (!commessaId || !codice || !qta || !op || !dataRicezione) {
            tr.style.border = '2px solid #e53e3e';
            hasErrors = true;
            errorMsg = "Compilare tutti i campi obbligatori.";
            return;
        }

        // Validazione OP (XX-XXXX)
        const opRegex = /^\d{2}-\d{4}$/;
        if (!opRegex.test(op)) {
            tr.style.border = '2px solid #e53e3e';
            hasErrors = true;
            errorMsg = "Formato OP errato (usa XX-XXXX).";
            return;
        }

        // Validazione Codice (6 cifre)
        const codeRegex = /^\d{6}$/;
        if (!codeRegex.test(codice)) {
            tr.style.border = '2px solid #e53e3e';
            hasErrors = true;
            errorMsg = "Il codice articolo deve essere di 6 cifre.";
            return;
        }

        payload.push({
            numero_op: op,
            id_commessa: parseInt(commessaId),
            codice_articolo: codice,
            descrizione: descrizione.toLowerCase(),
            qta_richiesta: parseInt(qta),
            data_ricezione: dataRicezione,
            id_ruolo: ruoloId ? parseInt(ruoloId) : null
        });
    });

    if (hasErrors) {
        showModal({ title: "Dati Non Validi", message: errorMsg });
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
        
        // Messaggio più dettagliato
        let msg = `Inserite: ${result.imported}.`;
        if (result.skipped > 0) {
            msg += ` (Saltati ${result.skipped} duplicati già presenti).`;
        }

        showSuccessFeedbackModal("Operazione Completata", msg);
        
        setTimeout(() => { window.location.href = 'index.html'; }, 2500);

    } catch (error) {
        console.error(error);
        showModal({ title: "Errore", message: "Errore server: " + error.message });
        btn.textContent = "Salva Ordini";
        btn.disabled = false;
    }
}