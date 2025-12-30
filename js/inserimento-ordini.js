import { apiFetch } from './api-client.js';
import { showSuccessFeedbackModal, showModal } from './shared-ui.js';

// Stato locale
const State = {
    commesseList: [], // { id, label, vo }
    ruoliList: [],    // { id, label }
    stagedRows: []    // Dati letti in attesa di conferma
};

// ============================================================
// 1. INIZIALIZZAZIONE & CARICAMENTO DATI
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Configurazione Drop Zone
    setupDragAndDrop();
    
    // 2. Caricamento dati di riferimento per le select
    await loadReferenceData();
    
    // 3. Listener Pulsanti
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    document.getElementById('clearBtn').addEventListener('click', clearPreview);
    document.getElementById('confirmBtn').addEventListener('click', saveProductionRows);
});

async function loadReferenceData() {
    try {
        // Carica Commesse (per associare il VO)
        const commRes = await apiFetch('/api/commesse/view?limit=1000&status=In Lavorazione');
        const commData = await commRes.json();
        
        State.commesseList = (commData.data || []).map(c => ({
            id: c.id_commessa,
            label: `${c.vo || '???'} - ${c.clienti?.ragione_sociale || ''} (${c.impianto || ''})`,
            vo: c.vo // Ci serve per il matching automatico
        }));

        // Carica Ruoli (per assegnare il reparto)
        const ruoliRes = await apiFetch('/api/admin/init-data'); // Endpoint che usavamo in admin, contiene i ruoli
        const ruoliData = await ruoliRes.json();
        
        State.ruoliList = (ruoliData.ruoli || []).map(r => ({
            id: r.id_ruolo,
            label: r.nome_ruolo
        }));

        console.log("✅ Dati caricati:", State.commesseList.length, "commesse,", State.ruoliList.length, "ruoli.");

    } catch (error) {
        console.error("Errore caricamento dati:", error);
        showModal({ title: "Errore", message: "Impossibile caricare le anagrafiche. Ricarica la pagina." });
    }
}

// ============================================================
// 2. GESTIONE DRAG & DROP
// ============================================================
function setupDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', handleDrop, false);
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
}

async function handleFiles(files) {
    const spinner = document.getElementById('upload-spinner');
    spinner.style.display = 'block';
    
    // Converte FileList in Array
    const fileArray = [...files];
    
    let processedCount = 0;

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

    spinner.style.display = 'none';
    
    if (processedCount > 0) {
        renderPreviewTable();
        document.getElementById('preview-section').style.display = 'block';
        document.getElementById('drop-zone').style.display = 'none'; // Nasconde drop zone per focus su dati
        
        // Scroll verso la tabella
        document.getElementById('preview-section').scrollIntoView({ behavior: 'smooth' });
    } else {
        showModal({ title: "Attenzione", message: "Nessun dato valido trovato nei PDF." });
    }
}

// ============================================================
// 3. PARSING PDF (Il cuore della logica)
// ============================================================
async function parsePDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = "";
    
    // Leggiamo tutte le pagine (il PDF potrebbe essere lungo)
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Uniamo i token di testo con uno spazio
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += " " + pageText;
    }

    // --- REGEX EXTRACTION STRATEGY ---
    
    // 1. Trova Numero OP (Es. "Ordine di Produzione n. OP25-0614")
    const opMatch = fullText.match(/Ordine di Produzione n\.\s*([A-Z0-9-]+)/i);
    const opNumber = opMatch ? opMatch[1].trim() : "OP-???";

    // 2. Trova Commessa VO (Es. "Commessa VO25-0217")
    const voMatch = fullText.match(/Commessa\s*([A-Z0-9-]+)/i);
    const voNumber = voMatch ? voMatch[1].trim() : null;

    // 3. Trova le Righe Articoli
    // Cerchiamo pattern tipo: "Codice" (6 cifre) ... "Descrizione" ... "UM" ... "Qta"
    // Esempio dal tuo PDF: "106234 ...testo... No NR 3,00 M20"
    // Regex Spiegazione:
    // (\d{6})       -> Codice articolo (6 cifre)
    // \s+           -> Spazio
    // (.+?)         -> Descrizione (lazy capture)
    // \s+No\s+      -> Il "No" del "Cert." (sembra costante)
    // [A-Z]{2}      -> UM (NR, MT, KG)
    // \s+           -> Spazio
    // ([\d,.]+)     -> Quantità (es. 1,00 o 1.00)
    
    const rowRegex = /(\d{5,7})\s+(.+?)\s+No\s+([A-Z]{2})\s+([\d,.]+)/g;
    
    let match;
    let foundRows = 0;

    while ((match = rowRegex.exec(fullText)) !== null) {
        const codice = match[1];
        let descrizione = match[2];
        const qtyRaw = match[4];

        // Pulizia Descrizione (toglie "Qtà riordino fissa" o codici spuri se presenti)
        descrizione = descrizione.replace("Qtà riordino fissa", "").trim();
        // Se la descrizione contiene il codice alternativo (es. "70001539"), puliamolo se vogliamo
        // Per ora lo teniamo, male non fa.

        // Pulizia Quantità (virgola -> punto)
        const qta = parseFloat(qtyRaw.replace(',', '.'));

        // Matching Automatico Commessa
        // Cerchiamo l'ID commessa che ha il VO trovato
        let preselectedCommessaId = "";
        if (voNumber) {
            const found = State.commesseList.find(c => c.vo && c.vo.toUpperCase() === voNumber.toUpperCase());
            if (found) preselectedCommessaId = found.id;
        }

        State.stagedRows.push({
            op: opNumber,
            vo_detected: voNumber,
            commessa_id: preselectedCommessaId, // ID se trovato, vuoto se no
            codice_articolo: codice,
            descrizione: descrizione,
            qta: qta,
            reparto_id: "" // Di default vuoto, l'utente sceglierà
        });
        
        foundRows++;
    }
    
    console.log(`File ${file.name}: Trovate ${foundRows} righe.`);
}

// ============================================================
// 4. RENDER ANTEPRIMA (HTML Table)
// ============================================================
function renderPreviewTable() {
    const tbody = document.getElementById('preview-body');
    tbody.innerHTML = '';

    State.stagedRows.forEach((row, index) => {
        const tr = document.createElement('tr');
        
        // 1. STATO (Badge)
        // Se manca la commessa, segnalalo in rosso
        const statusHtml = row.commessa_id 
            ? `<span class="badge-ok">OK</span>` 
            : `<span class="badge-new">Check</span>`; // Giallo/Blu, richiede attenzione
        
        if (!row.commessa_id) tr.classList.add('row-error'); // Evidenzia riga

        // 2. SELECT COMMESSA
        const commessaOptions = State.commesseList.map(c => 
            `<option value="${c.id}" ${c.id == row.commessa_id ? 'selected' : ''}>${c.label}</option>`
        ).join('');
        
        // 3. SELECT REPARTO (Default: vuoto o logica smart futura)
        const repartiOptions = `<option value="" selected>-- Assegna --</option>` + 
            State.ruoliList.map(r => `<option value="${r.id}">${r.label}</option>`).join('');

        tr.innerHTML = `
            <td>${statusHtml}</td>
            <td><input type="text" value="${row.op}" class="input-flat" readonly style="width:100px; background:#eee;"></td>
            <td>
                <select class="input-select commessa-select" data-idx="${index}" style="width: 250px;">
                    <option value="">-- Seleziona Commessa --</option>
                    ${commessaOptions}
                </select>
                ${!row.commessa_id && row.vo_detected ? `<div style="font-size:0.75em; color:red;">VO non trovato: ${row.vo_detected}</div>` : ''}
            </td>
            <td><input type="text" value="${row.codice_articolo}" class="input-flat code-input" data-idx="${index}" style="width: 80px;"></td>
            <td><input type="text" value="${row.descrizione}" class="input-flat desc-input" data-idx="${index}"></td>
            <td><input type="number" value="${row.qta}" class="input-flat qty-input" data-idx="${index}" style="width: 60px;"></td>
            <td>
                <select class="input-select role-select" data-idx="${index}">
                    ${repartiOptions}
                </select>
            </td>
            <td style="text-align:center;">
                <button class="btn-icon delete-row-btn" data-idx="${index}">🗑️</button>
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Listener per eliminazione riga
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
    document.getElementById('preview-section').style.display = 'none';
    document.getElementById('drop-zone').style.display = 'block';
    document.getElementById('fileInput').value = ''; // Reset input file
}

// ============================================================
// 5. SALVATAGGIO DATI (POST al Backend)
// ============================================================
async function saveProductionRows() {
    const rows = document.querySelectorAll('#preview-body tr');
    const payload = [];
    let hasErrors = false;

    // Leggiamo i valori ATTUALI dagli input (l'utente potrebbe averli modificati)
    rows.forEach(tr => {
        const idx = tr.querySelector('.commessa-select').dataset.idx; // Indice originale
        
        const commessaId = tr.querySelector('.commessa-select').value;
        const codice = tr.querySelector('.code-input').value;
        const descrizione = tr.querySelector('.desc-input').value;
        const qta = tr.querySelector('.qty-input').value;
        const op = tr.querySelector('input[readonly]').value; // Numero OP
        const ruoloId = tr.querySelector('.role-select').value;

        // Validazione
        if (!commessaId || !codice || !qta) {
            tr.style.backgroundColor = '#ffecec'; // Evidenzia errore
            hasErrors = true;
            return;
        }

        payload.push({
            numero_op: op,
            id_commessa: parseInt(commessaId),
            codice_articolo: codice,
            descrizione: descrizione, // Servirà al backend per creare l'anagrafica se non esiste
            qta_richiesta: parseInt(qta),
            id_ruolo: ruoloId ? parseInt(ruoloId) : null
        });
    });

    if (hasErrors) {
        showModal({ title: "Dati Incompleti", message: "Assicurati di aver selezionato la Commessa per tutte le righe evidenziate in rosso." });
        return;
    }

    if (payload.length === 0) return;

    // Invio al Backend
    const btn = document.getElementById('confirmBtn');
    btn.textContent = "Salvataggio in corso...";
    btn.disabled = true;

    try {
        // NOTA: Qui ipotizziamo un endpoint 'bulk' o chiamate singole.
        // Per performance, meglio un endpoint bulk. Creerò '/api/produzione/import'
        const res = await apiFetch('/api/produzione/import', {
            method: 'POST',
            body: JSON.stringify({ righe: payload })
        });

        if (!res.ok) throw new Error("Errore durante il salvataggio");

        const result = await res.json();
        
        showSuccessFeedbackModal("Importazione Completata", `Importate correttamente ${result.imported} righe.`);
        
        setTimeout(() => {
            window.location.href = 'index.html'; // O dove preferisci
        }, 2000);

    } catch (error) {
        console.error(error);
        showModal({ title: "Errore", message: "Errore durante il salvataggio dei dati: " + error.message });
        btn.textContent = "✅ Conferma e Salva";
        btn.disabled = false;
    }
}