// js/dev-tools.js — Import massivo commesse

import { apiFetch } from './api-client.js';
import { IsAdmin } from './core-init.js';

const DevTools = {
    data: {
        parsedRows: [],       // Righe parsate dal file Excel
        existingRifs: [],     // riferimenti_tecnici già nel DB (duplicati)
        validRows: [],        // Righe valide pronte per l'import
        clientiMap: {},       // ragione_sociale -> id_cliente
        modelliMap: {},       // nome_modello -> id_modello
    },

    // Mapping colonne Excel (label dall'export) -> campi DB
    COLUMN_MAP: {
        'Cliente': { dbField: 'id_cliente_fk', type: 'fk_cliente' },
        'Impianto': { dbField: 'impianto', type: 'text' },
        'Modello': { dbField: 'id_modello_fk', type: 'fk_modello' },
        'Anno': { dbField: 'anno', type: 'text' },
        'VO': { dbField: 'vo', type: 'text' },
        'Rif. Tecnico': { dbField: 'riferimento_tecnico', type: 'text' },
        'Provincia': { dbField: 'provincia', type: 'text' },
        'Paese': { dbField: 'paese', type: 'text' },
        'Matricola': { dbField: 'matricola', type: 'text' },
        'Note': { dbField: 'note', type: 'text' },
    },

    init: async function() {
        console.log("🛠️ DEV TOOLS INIT");
        if (!IsAdmin) {
            window.location.replace('index.html');
            return;
        }

        this.bindEvents();
        await this.loadLookups();
    },

    bindEvents: function() {
        // Tab navigation
        document.querySelectorAll('.dev-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // File upload
        document.getElementById('btnSelectFile').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileUpload(e));

        // Drag & drop
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) this.parseFile(file);
        });

        // Import actions
        document.getElementById('btnResetImport').addEventListener('click', () => this.resetImport());
        document.getElementById('btnConfirmImport').addEventListener('click', () => this.confirmImport());
    },

    switchTab: function(tabId) {
        document.querySelectorAll('.dev-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.dev-tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector(`.dev-tab[data-tab="${tabId}"]`)?.classList.add('active');
        document.getElementById(`tab-${tabId}`)?.classList.add('active');
    },

    // === CARICA LOOKUP (clienti, modelli) ===
    loadLookups: async function() {
        try {
            const [clientiRes, modelliRes] = await Promise.all([
                apiFetch('/api/simple/clienti'),
                apiFetch('/api/simple/modelli')
            ]);

            const clienti = await clientiRes.json();
            const modelli = await modelliRes.json();

            // Crea mappe: nome (lowercase) -> id
            (clienti || []).forEach(c => {
                if (c.ragione_sociale) {
                    this.data.clientiMap[c.ragione_sociale.trim().toLowerCase()] = c.id_cliente;
                }
            });
            (modelli || []).forEach(m => {
                if (m.nome_modello) {
                    this.data.modelliMap[m.nome_modello.trim().toLowerCase()] = m.id_modello;
                }
            });

            console.log(`📋 Lookup: ${Object.keys(this.data.clientiMap).length} clienti, ${Object.keys(this.data.modelliMap).length} modelli`);
        } catch (e) {
            console.error("Errore caricamento lookup:", e);
        }
    },

    // === GESTIONE FILE UPLOAD ===
    handleFileUpload: function(e) {
        const file = e.target.files[0];
        if (!file) return;
        this.parseFile(file);
    },

    parseFile: function(file) {
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileName').classList.add('loaded');

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

                console.log(`📄 File parsato: ${jsonData.length} righe, colonne: ${Object.keys(jsonData[0] || {}).join(', ')}`);

                this.data.parsedRows = jsonData;
                this.validateAndPreview();
            } catch (err) {
                console.error("Errore parsing file:", err);
                alert('Errore nel parsing del file: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    },

    // === VALIDAZIONE E ANTEPRIMA ===
    validateAndPreview: async function() {
        const rows = this.data.parsedRows;
        if (rows.length === 0) {
            alert('Il file è vuoto.');
            return;
        }

        // 1. Mappa le righe ai campi DB
        const mapped = rows.map((row, idx) => {
            const result = { _rowIdx: idx + 2, _status: 'ok', _errors: [] };

            for (const [excelLabel, config] of Object.entries(this.COLUMN_MAP)) {
                const rawVal = String(row[excelLabel] || '').trim();

                if (config.type === 'fk_cliente') {
                    if (rawVal) {
                        const id = this.data.clientiMap[rawVal.toLowerCase()];
                        if (id) {
                            result[config.dbField] = id;
                            result._clienteNome = rawVal;
                        } else {
                            result[config.dbField] = null;
                            result._clienteNome = rawVal;
                            result._errors.push(`Cliente "${rawVal}" non trovato`);
                            result._status = 'error';
                        }
                    }
                } else if (config.type === 'fk_modello') {
                    if (rawVal) {
                        const id = this.data.modelliMap[rawVal.toLowerCase()];
                        if (id) {
                            result[config.dbField] = id;
                            result._modelloNome = rawVal;
                        } else {
                            result[config.dbField] = null;
                            result._modelloNome = rawVal;
                            result._errors.push(`Modello "${rawVal}" non trovato`);
                            result._status = 'error';
                        }
                    }
                } else {
                    result[config.dbField] = rawVal || null;
                }
            }

            // Validazione: riferimento_tecnico obbligatorio
            if (!result.riferimento_tecnico) {
                result._errors.push('Rif. Tecnico mancante');
                result._status = 'error';
            }

            return result;
        });

        // 2. Check duplicati con il DB
        const allRifs = mapped.filter(r => r.riferimento_tecnico).map(r => r.riferimento_tecnico);

        try {
            const res = await apiFetch('/api/dev/check-duplicati-commesse', {
                method: 'POST',
                body: JSON.stringify({ riferimenti_tecnici: allRifs })
            });
            const json = await res.json();
            this.data.existingRifs = new Set(json.duplicati || []);
        } catch (e) {
            console.warn("Impossibile verificare duplicati:", e);
            this.data.existingRifs = new Set();
        }

        // 3. Check duplicati interni (stessa riga ripetuta nel file)
        const seenRifs = new Set();
        mapped.forEach(r => {
            if (r.riferimento_tecnico) {
                if (this.data.existingRifs.has(r.riferimento_tecnico)) {
                    r._status = 'skip';
                    r._errors.push('Già presente nel DB');
                } else if (seenRifs.has(r.riferimento_tecnico)) {
                    r._status = 'skip';
                    r._errors.push('Duplicato nel file');
                }
                seenRifs.add(r.riferimento_tecnico);
            }
        });

        this.data.validRows = mapped;
        this.renderPreview();
    },

    // === RENDER ANTEPRIMA ===
    renderPreview: function() {
        const rows = this.data.validRows;
        const okCount = rows.filter(r => r._status === 'ok').length;
        const skipCount = rows.filter(r => r._status === 'skip').length;
        const errorCount = rows.filter(r => r._status === 'error').length;

        // Stats
        document.getElementById('previewStats').innerHTML = `
            <span class="stat-badge stat-badge--info">📄 Totale: ${rows.length}</span>
            <span class="stat-badge stat-badge--success">✅ Da importare: ${okCount}</span>
            <span class="stat-badge stat-badge--warning">⏭️ Duplicati (skip): ${skipCount}</span>
            <span class="stat-badge stat-badge--danger">❌ Errori: ${errorCount}</span>
        `;

        // Table header
        const headers = ['#', 'Stato', 'Rif. Tecnico', 'Cliente', 'Impianto', 'Modello', 'VO', 'Anno', 'Paese', 'Matricola', 'Errori'];
        document.getElementById('previewHead').innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

        // Table body
        const tbody = document.getElementById('previewBody');
        tbody.innerHTML = '';

        rows.forEach(r => {
            const statusIcon = r._status === 'ok' ? '✅' : r._status === 'skip' ? '⏭️' : '❌';
            const rowClass = r._status === 'ok' ? 'row-ok' : r._status === 'skip' ? 'row-skip' : 'row-error';

            tbody.innerHTML += `<tr class="${rowClass}">
                <td>${r._rowIdx}</td>
                <td class="status-cell">${statusIcon}</td>
                <td><strong>${r.riferimento_tecnico || '—'}</strong></td>
                <td>${r._clienteNome || '—'}</td>
                <td>${r.impianto || '—'}</td>
                <td>${r._modelloNome || '—'}</td>
                <td>${r.vo || '—'}</td>
                <td>${r.anno || '—'}</td>
                <td>${r.paese || '—'}</td>
                <td>${r.matricola || '—'}</td>
                <td style="color: #c0392b; font-size: 0.82em;">${r._errors.join(', ') || '—'}</td>
            </tr>`;
        });

        // Mostra pannello e abilita bottone (solo se ci sono righe ok)
        document.getElementById('previewPanel').style.display = 'block';
        document.getElementById('btnConfirmImport').disabled = okCount === 0;
    },

    // === RESET ===
    resetImport: function() {
        this.data.parsedRows = [];
        this.data.validRows = [];
        this.data.existingRifs = new Set();
        document.getElementById('previewPanel').style.display = 'none';
        document.getElementById('resultPanel').style.display = 'none';
        document.getElementById('fileName').textContent = 'Nessun file selezionato';
        document.getElementById('fileName').classList.remove('loaded');
        document.getElementById('fileInput').value = '';
    },

    // === CONFERMA IMPORT ===
    confirmImport: async function() {
        const toImport = this.data.validRows.filter(r => r._status === 'ok');
        if (toImport.length === 0) return;

        if (!confirm(`Stai per importare ${toImport.length} commesse con status "Chiusa" e prefisso HIST-.\n\nProcedere?`)) return;

        const btn = document.getElementById('btnConfirmImport');
        btn.disabled = true;
        btn.textContent = '⏳ Import in corso...';

        try {
            // Prepara le righe (solo campi DB, rimuovi campi interni _)
            const cleanRows = toImport.map(r => {
                const clean = {};
                for (const [key, val] of Object.entries(r)) {
                    if (!key.startsWith('_')) clean[key] = val;
                }
                return clean;
            });

            // Invio in batch (max 100 alla volta per non sovraccaricare)
            let totalInserted = 0;
            let totalSkipped = 0;
            let totalErrors = [];
            const batchSize = 100;

            for (let i = 0; i < cleanRows.length; i += batchSize) {
                const batch = cleanRows.slice(i, i + batchSize);
                btn.textContent = `⏳ ${i + batch.length}/${cleanRows.length}...`;

                const res = await apiFetch('/api/dev/import-commesse', {
                    method: 'POST',
                    body: JSON.stringify({ righe: batch })
                });
                const json = await res.json();

                totalInserted += json.inserted || 0;
                totalSkipped += json.skipped || 0;
                if (json.errors) totalErrors = totalErrors.concat(json.errors);
            }

            // Mostra risultato
            this.showResult(totalInserted, totalSkipped, totalErrors, cleanRows.length);

        } catch (e) {
            console.error("Errore import:", e);
            this.showResult(0, 0, [e.message], toImport.length);
        } finally {
            btn.disabled = false;
            btn.textContent = '✅ Conferma Import';
        }
    },

    showResult: function(inserted, skipped, errors, total) {
        const panel = document.getElementById('resultPanel');
        const result = document.getElementById('importResult');
        panel.style.display = 'block';

        const resultClass = errors.length > 0 ? (inserted > 0 ? 'partial' : 'error') : 'success';
        const icon = resultClass === 'success' ? '✅' : resultClass === 'partial' ? '⚠️' : '❌';

        result.innerHTML = `
            <div class="import-result ${resultClass}">
                <h4>${icon} Import completato</h4>
                <p>
                    <strong>${inserted}</strong> commesse inserite su <strong>${total}</strong> inviate.<br>
                    ${skipped > 0 ? `<strong>${skipped}</strong> duplicate (saltate).<br>` : ''}
                    ${errors.length > 0 ? `<strong>${errors.length}</strong> errori.` : ''}
                </p>
                ${errors.length > 0 ? `
                    <div class="result-detail">
                        <strong>Dettaglio errori:</strong>
                        <ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul>
                    </div>
                ` : ''}
            </div>
        `;

        // Scroll al risultato
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

document.addEventListener('DOMContentLoaded', () => { DevTools.init(); });
