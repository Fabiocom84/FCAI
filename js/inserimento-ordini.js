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
    
    // Binding
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
        // Mostra il nome del primo file + conteggio altri
        const fileName = fileArray[0].name;
        const extra = fileArray.length > 1 ? ` (+ altri ${fileArray.length - 1})` : '';
        
        // Sostituiamo il contenuto con il nome file stilizzato
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
    
    // Iteriamo su OGNI pagina perché ogni pagina è un ordine a sé
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
        descrizione = descrizione.replace("Qtà riordino fissa", "").trim();

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
                manual: false // Indica che viene dal PDF -> OP non modificabile
            });
        }
    }
}

// ============================================================
// 4. FUNZIONI UI TABELLA
// ============================================================

function addManualRow() {
    State.stagedRows.push({
        op: "", // Vuoto per permettere l'inserimento
        vo_detected: null,
        commessa_id: "",
        codice_articolo: "",
        descrizione: "",
        qta: 1,
        manual: true // Indica riga manuale -> OP modificabile
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
        tbody.innerHTML = `<tr class="empty-state-row"><td colspan="8">Nessun dato. Carica un PDF o aggiungi una riga manuale.</td></tr>`;
        return;
    }

    State.stagedRows.forEach((row, index) => {
        const tr = document.createElement('tr');
        const defaultRoleId = State.knownDefaults[row.codice_articolo] || "";

        // --- GESTIONE CAMPO OP (MODIFICA QUI) ---
        // Se è manuale: sfondo bianco, modificabile. Se PDF: sfondo grigio, readonly.
        const opReadonly = row.manual ? '' : 'readonly';
        const opBg = row.manual ? '#ffffff' : '#f9f9f9';
        
        // --- GESTIONE CAMPO CODICE ---
        const codeReadonly = row.manual ? '' : 'readonly';
        const codeBg = row.manual ? '#ffffff' : '#f9f9f9';

        const statusHtml = row.commessa_id 
            ? `<span class="badge-ok">OK</span>` 
            : `<span class="badge-new">Check</span>`;
        
        if (!row.commessa_id) tr.style.backgroundColor = '#fff5f5';

        // Select Commessa
        const commessaOptions = State.commesseList.map(c => 
            `<option value="${c.id}" ${c.id == row.commessa_id ? 'selected' : ''}>${c.label}</option>`
        ).join('');
        
        // Select Reparto
        const repartiOptions = `<option value="">-- Assegna --</option>` + 
            State.ruoliList.map(r => {
                const isSelected = String(r.id) === String(defaultRoleId);
                return `<option value="${r.id}" ${isSelected ? 'selected' : ''}>${r.label}</option>`;
            }).join('');

        tr.innerHTML = `
            <td>${statusHtml}</td>
            
            <!-- Campo OP con classe .op-input e logica readonly dinamica -->
            <td><input type="text" value="${row.op}" class="input-flat op-input" ${opReadonly} style="width:100px; background:${opBg}; font-size:0.8rem;"></td>
            
            <td>
                <select class="input-select commessa-select" style="min-width: 200px;">
                    <option value="">-- Seleziona --</option>
                    ${commessaOptions}
                </select>
                ${!row.commessa_id && row.vo_detected ? `<div style="font-size:0.75em; color:red;">VO: ${row.vo_detected}</div>` : ''}
            </td>
            
            <!-- Campo Codice con logica readonly dinamica -->
            <td><input type="text" value="${row.codice_articolo}" class="input-flat code-input" ${codeReadonly} style="background:${codeBg}"></td>
            
            <td><input type="text" value="${row.descrizione}" class="input-flat desc-input"></td>
            <td><input type="number" value="${row.qta}" class="input-flat qty-input"></td>
            <td>
                <select class="input-select role-select" style="min-width: 130px;">
                    ${repartiOptions}
                </select>
            </td>
            <td style="text-align:center;">
                <button class="btn-icon delete-row-btn" data-idx="${index}">🗑️</button>
            </td>
        `;

        tbody.appendChild(tr);
    });

    document.querySelectorAll('.delete-row-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            State.stagedRows.splice(idx, 1);
            renderPreviewTable();
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
        
        // ORA LEGGIAMO DALL'INPUT CON CLASSE .op-input (che ora può essere editabile)
        const op = tr.querySelector('.op-input').value; 
        
        const ruoloId = tr.querySelector('.role-select').value;

        if (!commessaId || !codice || !qta) {
            tr.style.border = '2px solid #e53e3e';
            hasErrors = true;
            return;
        } else {
            tr.style.border = 'none';
        }

        payload.push({
            numero_op: op,
            id_commessa: parseInt(commessaId),
            codice_articolo: codice,
            descrizione: descrizione,
            qta_richiesta: parseInt(qta),
            id_ruolo: ruoloId ? parseInt(ruoloId) : null
        });
    });

    if (hasErrors) {
        showModal({ title: "Dati Incompleti", message: "Assicurati che tutte le righe abbiano Commessa, Codice e Qta." });
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
        showSuccessFeedbackModal("Salvato", `Inserite ${result.imported} righe.`);
        
        setTimeout(() => { window.location.href = 'index.html'; }, 2000);

    } catch (error) {
        console.error(error);
        showModal({ title: "Errore", message: "Errore server: " + error.message });
        btn.textContent = "Salva Ordini";
        btn.disabled = false;
    }
}