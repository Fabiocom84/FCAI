// js/dev-tools.js — Import massivo commesse con Tabella di Conversione dinamica

import { apiFetch } from './api-client.js';
import { IsAdmin } from './core-init.js';

const DevTools = {
    data: {
        parsedRows: [],       // Righe parsate dal file Excel
        existingRifs: [],     // riferimenti_tecnici già nel DB (duplicati)
        validRows: [],        // Righe valide pronte per l'import
        clientiMap: {},       // ragione_sociale -> id_cliente (DB)
        modelliMap: {},       // nome_modello -> id_modello (DB)
        ubicazioniMap: {},    // nome_ubicazione -> id_ubicazione (DB)
        
        // Mappe di conversione utente salvate in localStorage
        userClientiMap: {},
        userModelliMap: {},
        userUbicazioniMap: {},

        // Liste reali dal database
        clientiList: [],
        modelliList: [],
        ubicazioniList: []
    },

    // Mapping colonne Excel (Foglio1 del file) -> campi DB
    COLUMN_MAP: {
        'Cliente': { dbField: 'id_cliente_fk', type: 'fk_cliente' },
        'Cantiere': { dbField: 'impianto', type: 'text' },
        'Modello': { dbField: 'id_modello_fk', type: 'fk_modello' },
        'Anno': { dbField: 'anno', type: 'text' },
        'VO': { dbField: 'vo', type: 'text' },
        'Commessa': { dbField: 'riferimento_tecnico', type: 'text' },
        'Regione': { dbField: 'provincia', type: 'text' },
        'Paese': { dbField: 'paese', type: 'text' },
        'Matricola': { dbField: 'matricola', type: 'text' },
        'Note': { dbField: 'note', type: 'text' },
        'Posizione': { dbField: 'id_ubicazione_fk', type: 'fk_ubicazione' },
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

    // === CARICA USER MAPPINGS (localStorage) ===
    loadSavedUserMappings: function() {
        try {
            this.data.userClientiMap = JSON.parse(localStorage.getItem('commesse_import_clienti_map')) || {};
            this.data.userModelliMap = JSON.parse(localStorage.getItem('commesse_import_modelli_map')) || {};
            this.data.userUbicazioniMap = JSON.parse(localStorage.getItem('commesse_import_ubicazioni_map')) || {};
        } catch (e) {
            console.error("Errore nel caricamento dei mapping utente:", e);
            this.data.userClientiMap = {};
            this.data.userModelliMap = {};
            this.data.userUbicazioniMap = {};
        }
    },

    saveUserMapping: function(category, excelVal, dbId) {
        let storageKey = '';
        let mapRef = null;
        if (category === 'cliente') {
            storageKey = 'commesse_import_clienti_map';
            mapRef = this.data.userClientiMap;
        } else if (category === 'modello') {
            storageKey = 'commesse_import_modelli_map';
            mapRef = this.data.userModelliMap;
        } else if (category === 'ubicazione') {
            storageKey = 'commesse_import_ubicazioni_map';
            mapRef = this.data.userUbicazioniMap;
        }

        if (mapRef && storageKey) {
            if (dbId) {
                mapRef[excelVal.toLowerCase()] = Number(dbId);
            } else {
                delete mapRef[excelVal.toLowerCase()];
            }
            localStorage.setItem(storageKey, JSON.stringify(mapRef));
        }
    },

    // === CARICA LOOKUP (clienti, modelli, ubicazioni) ===
    loadLookups: async function() {
        try {
            const [clientiRes, modelliRes, ubicazioniRes] = await Promise.all([
                apiFetch('/api/simple/clienti'),
                apiFetch('/api/simple/modelli'),
                apiFetch('/api/simple/ubicazioni')
            ]);

            const clienti = await clientiRes.json();
            const modelli = await modelliRes.json();
            const ubicazioni = await ubicazioniRes.json();

            this.data.clientiList = (clienti || []).sort((a, b) => (a.ragione_sociale || '').localeCompare(b.ragione_sociale || ''));
            this.data.modelliList = (modelli || []).sort((a, b) => (a.nome_modello || '').localeCompare(b.nome_modello || ''));
            this.data.ubicazioniList = (ubicazioni || []).sort((a, b) => (a.nome_ubicazione || '').localeCompare(b.nome_ubicazione || ''));

            // Crea mappe: nome (lowercase) -> id per corrispondenza automatica esatta
            this.data.clientiList.forEach(c => {
                if (c.ragione_sociale) {
                    this.data.clientiMap[c.ragione_sociale.trim().toLowerCase()] = c.id_cliente;
                }
            });
            this.data.modelliList.forEach(m => {
                if (m.nome_modello) {
                    this.data.modelliMap[m.nome_modello.trim().toLowerCase()] = m.id_modello;
                }
            });
            this.data.ubicazioniList.forEach(u => {
                if (u.nome_ubicazione) {
                    this.data.ubicazioniMap[u.nome_ubicazione.trim().toLowerCase()] = u.id_ubicazione;
                }
            });

            this.loadSavedUserMappings();

            console.log(`📋 Lookups: ${this.data.clientiList.length} clienti, ${this.data.modelliList.length} modelli, ${this.data.ubicazioniList.length} ubicazioni`);
        } catch (e) {
            console.error("Errore caricamento lookups:", e);
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
                const firstSheetName = workbook.SheetNames[0];
                const firstSheet = workbook.Sheets[firstSheetName];
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

        // 1. Rileva anagrafiche uniche non riconosciute nel file Excel
        const unmappedClients = new Set();
        const unmappedModels = new Set();
        const unmappedUbicazioni = new Set();

        rows.forEach(row => {
            // Cliente
            const cliVal = String(row['Cliente'] || '').trim();
            if (cliVal) {
                const lowerCli = cliVal.toLowerCase();
                const matchedId = this.data.clientiMap[lowerCli] || this.data.userClientiMap[lowerCli];
                if (!matchedId) {
                    unmappedClients.add(cliVal);
                }
            }

            // Modello
            const modVal = String(row['Modello'] || '').trim();
            if (modVal) {
                const lowerMod = modVal.toLowerCase();
                const matchedId = this.data.modelliMap[lowerMod] || this.data.userModelliMap[lowerMod];
                if (!matchedId) {
                    unmappedModels.add(modVal);
                }
            }

            // Posizione (Ubicazione)
            const posVal = String(row['Posizione'] || '').trim();
            if (posVal) {
                const lowerPos = posVal.toLowerCase();
                const matchedId = this.data.ubicazioniMap[lowerPos] || this.data.userUbicazioniMap[lowerPos];
                if (!matchedId) {
                    unmappedUbicazioni.add(posVal);
                }
            }
        });

        // 2. Renderizza/Visualizza il pannello di mappatura
        const hasUnmapped = unmappedClients.size > 0 || unmappedModels.size > 0 || unmappedUbicazioni.size > 0;
        const mappingPanel = document.getElementById('mappingPanel');
        
        if (hasUnmapped) {
            mappingPanel.style.display = 'block';
            this.renderMappingPanel(unmappedClients, unmappedModels, unmappedUbicazioni);
        } else {
            mappingPanel.style.display = 'none';
        }

        // 3. Mappa le righe dell'Excel ai campi del DB
        const mapped = rows.map((row, idx) => {
            const result = { _rowIdx: idx + 2, _status: 'ok', _errors: [] };

            for (const [excelLabel, config] of Object.entries(this.COLUMN_MAP)) {
                const rawVal = String(row[excelLabel] || '').trim();

                if (config.type === 'fk_cliente') {
                    if (rawVal) {
                        const lowerVal = rawVal.toLowerCase();
                        const id = this.data.clientiMap[lowerVal] || this.data.userClientiMap[lowerVal];
                        if (id) {
                            result[config.dbField] = id;
                            const dbObj = this.data.clientiList.find(c => c.id_cliente === id);
                            result._clienteNome = dbObj ? dbObj.ragione_sociale : rawVal;
                        } else {
                            result[config.dbField] = null;
                            result._clienteNome = rawVal;
                            result._errors.push(`Cliente "${rawVal}" non associato`);
                            result._status = 'error';
                        }
                    } else {
                        result[config.dbField] = null;
                        result._clienteNome = '—';
                    }
                } else if (config.type === 'fk_modello') {
                    if (rawVal) {
                        const lowerVal = rawVal.toLowerCase();
                        const id = this.data.modelliMap[lowerVal] || this.data.userModelliMap[lowerVal];
                        if (id) {
                            result[config.dbField] = id;
                            const dbObj = this.data.modelliList.find(m => m.id_modello === id);
                            result._modelloNome = dbObj ? dbObj.nome_modello : rawVal;
                        } else {
                            result[config.dbField] = null;
                            result._modelloNome = rawVal;
                            result._errors.push(`Modello "${rawVal}" non associato`);
                            result._status = 'error';
                        }
                    } else {
                        result[config.dbField] = null;
                        result._modelloNome = '—';
                    }
                } else if (config.type === 'fk_ubicazione') {
                    if (rawVal) {
                        const lowerVal = rawVal.toLowerCase();
                        const id = this.data.ubicazioniMap[lowerVal] || this.data.userUbicazioniMap[lowerVal];
                        if (id) {
                            result[config.dbField] = id;
                            const dbObj = this.data.ubicazioniList.find(u => u.id_ubicazione === id);
                            result._ubicazioneNome = dbObj ? dbObj.nome_ubicazione : rawVal;
                        } else {
                            result[config.dbField] = null;
                            result._ubicazioneNome = rawVal;
                            result._errors.push(`Posizione "${rawVal}" non associata`);
                            result._status = 'error';
                        }
                    } else {
                        // Default ARMADIO (id 1) come da richiesta utente
                        result[config.dbField] = 1;
                        result._ubicazioneNome = 'ARMADIO (Default)';
                    }
                } else {
                    result[config.dbField] = rawVal || null;
                }
            }

            // Validazione: riferimento_tecnico obbligatorio
            if (!result.riferimento_tecnico) {
                result._errors.push('Codice Commessa mancante');
                result._status = 'error';
            }

            return result;
        });

        // 4. Check duplicati con il DB
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

        // 5. Check duplicati interni al file
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
        this.renderPreview(hasUnmapped);
    },

    // === RENDERING PANEL DI ASSOCIAZIONE ===
    renderMappingPanel: function(unmappedClients, unmappedModels, unmappedUbicazioni) {
        const container = document.getElementById('mappingLists');
        container.innerHTML = '';

        // Sezione Clienti
        if (unmappedClients.size > 0) {
            let html = `
                <div class="mapping-group">
                    <h4>Associazione Clienti (${unmappedClients.size})</h4>
            `;
            Array.from(unmappedClients).sort().forEach(clientName => {
                const savedMap = this.data.userClientiMap[clientName.toLowerCase()] || '';
                html += `
                    <div class="mapping-row">
                        <span class="mapping-label">Excel: "<strong>${clientName}</strong>"</span>
                        <span class="mapping-arrow">➡️</span>
                        <select class="mapping-select ${savedMap ? 'mapped' : ''}" data-category="cliente" data-excel="${clientName}">
                            <option value="">-- Seleziona Cliente --</option>
                            ${this.data.clientiList.map(c => `
                                <option value="${c.id_cliente}" ${Number(savedMap) === c.id_cliente ? 'selected' : ''}>
                                    ${c.ragione_sociale} (${c.codice_cliente || 'N/A'})
                                </option>
                            `).join('')}
                        </select>
                    </div>
                `;
            });
            html += `</div>`;
            container.innerHTML += html;
        }

        // Sezione Modelli
        if (unmappedModels.size > 0) {
            let html = `
                <div class="mapping-group">
                    <h4>Associazione Modelli (${unmappedModels.size})</h4>
            `;
            Array.from(unmappedModels).sort().forEach(modelName => {
                const savedMap = this.data.userModelliMap[modelName.toLowerCase()] || '';
                html += `
                    <div class="mapping-row">
                        <span class="mapping-label">Excel: "<strong>${modelName}</strong>"</span>
                        <span class="mapping-arrow">➡️</span>
                        <select class="mapping-select ${savedMap ? 'mapped' : ''}" data-category="modello" data-excel="${modelName}">
                            <option value="">-- Seleziona Modello --</option>
                            ${this.data.modelliList.map(m => `
                                <option value="${m.id_modello}" ${Number(savedMap) === m.id_modello ? 'selected' : ''}>
                                    ${m.nome_modello}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                `;
            });
            html += `</div>`;
            container.innerHTML += html;
        }

        // Sezione Ubicazioni
        if (unmappedUbicazioni.size > 0) {
            let html = `
                <div class="mapping-group">
                    <h4>Associazione Posizioni (${unmappedUbicazioni.size})</h4>
            `;
            Array.from(unmappedUbicazioni).sort().forEach(posName => {
                const savedMap = this.data.userUbicazioniMap[posName.toLowerCase()] || '';
                html += `
                    <div class="mapping-row">
                        <span class="mapping-label">Excel: "<strong>${posName}</strong>"</span>
                        <span class="mapping-arrow">➡️</span>
                        <select class="mapping-select ${savedMap ? 'mapped' : ''}" data-category="ubicazione" data-excel="${posName}">
                            <option value="">-- Seleziona Posizione --</option>
                            ${this.data.ubicazioniList.map(u => `
                                <option value="${u.id_ubicazione}" ${Number(savedMap) === u.id_ubicazione ? 'selected' : ''}>
                                    ${u.nome_ubicazione}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                `;
            });
            html += `</div>`;
            container.innerHTML += html;
        }

        // Event handler sui select di mappatura
        container.querySelectorAll('.mapping-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const category = e.target.dataset.category;
                const excelVal = e.target.dataset.excel;
                const dbId = e.target.value;

                if (dbId) {
                    e.target.classList.add('mapped');
                } else {
                    e.target.classList.remove('mapped');
                }

                this.saveUserMapping(category, excelVal, dbId);
                
                // Rielabora tutto per ricalcolare errori e stato righe
                this.validateAndPreview();
            });
        });
    },

    // === RENDER ANTEPRIMA RIGHE ===
    renderPreview: function(hasUnmapped) {
        const rows = this.data.validRows;
        const okCount = rows.filter(r => r._status === 'ok').length;
        const skipCount = rows.filter(r => r._status === 'skip').length;
        const errorCount = rows.filter(r => r._status === 'error').length;

        // Stats
        document.getElementById('previewStats').innerHTML = `
            <span class="stat-badge stat-badge--info">📄 Totale: ${rows.length}</span>
            <span class="stat-badge stat-badge--success">✅ Da importare: ${okCount}</span>
            <span class="stat-badge stat-badge--warning">⏭️ Duplicati (skip): ${skipCount}</span>
            <span class="stat-badge stat-badge--danger">❌ Errori/Da associare: ${errorCount}</span>
        `;

        // Table headers
        const headers = ['#', 'Stato', 'Commessa', 'Cliente', 'Cantiere', 'Modello', 'VO', 'Anno', 'Regione/Prov', 'Paese', 'Ubicazione', 'Matricola', 'Errori'];
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
                <td>${r.provincia || '—'}</td>
                <td>${r.paese || '—'}</td>
                <td>${r._ubicazioneNome || '—'}</td>
                <td>${r.matricola || '—'}</td>
                <td style="color: #c0392b; font-size: 0.82em;">${r._errors.join(', ') || '—'}</td>
            </tr>`;
        });

        // Mostra pannello e gestisci stato bottone conferma
        document.getElementById('previewPanel').style.display = 'block';
        
        const btn = document.getElementById('btnConfirmImport');
        if (hasUnmapped) {
            btn.disabled = true;
            btn.innerHTML = '⚠️ Completa Associazione Anagrafiche';
            btn.classList.add('dev-btn--danger');
            btn.classList.remove('dev-btn--success');
        } else {
            btn.disabled = okCount === 0;
            btn.innerHTML = '✅ Conferma Import';
            btn.classList.remove('dev-btn--danger');
            btn.classList.add('dev-btn--success');
        }
    },

    // === RESET ===
    resetImport: function() {
        this.data.parsedRows = [];
        this.data.validRows = [];
        this.data.existingRifs = new Set();
        document.getElementById('previewPanel').style.display = 'none';
        document.getElementById('mappingPanel').style.display = 'none';
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
            // Rimuovi proprietà interne che iniziano con _
            const cleanRows = toImport.map(r => {
                const clean = {};
                for (const [key, val] of Object.entries(r)) {
                    if (!key.startsWith('_')) clean[key] = val;
                }
                return clean;
            });

            // Invio a lotti (lotti da 100 per non saturare la richiesta HTTP)
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

            // Visualizza il risultato finale
            this.showResult(totalInserted, totalSkipped, totalErrors, cleanRows.length);

        } catch (e) {
            console.error("Errore durante l'importazione:", e);
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
                    <strong>${inserted}</strong> commesse storiche inserite su <strong>${total}</strong> totali.<br>
                    ${skipped > 0 ? `<strong>${skipped}</strong> duplicate già presenti a database (saltate).<br>` : ''}
                    ${errors.length > 0 ? `<strong>${errors.length}</strong> errori di inserimento.` : ''}
                </p>
                ${errors.length > 0 ? `
                    <div class="result-detail">
                        <strong>Dettagli errori riscontrati:</strong>
                        <ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul>
                    </div>
                ` : ''}
            </div>
        `;

        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

document.addEventListener('DOMContentLoaded', () => { DevTools.init(); });

