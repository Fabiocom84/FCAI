// js/admin-config.js

import { apiFetch } from './api-client.js';
import { IsAdmin } from './core-init.js';

const App = {
    data: {
        macros: [],
        ruoli: [],
        fasi: [],
        allComponents: [],
        componentiPage: 1
    },

    init: async function() {
        console.log("🚀 ADMIN CONFIG INIT");
        // 2. BLOCCO DI SICUREZZA
        if (!IsAdmin) {
            window.location.replace('index.html');
            return;
        }
        // ---------------------
        if (!document.getElementById('macrosTable')) return;

        try {
            await this.loadRefData();
            this.setupTabs();
            this.renderMacros();
            this.loadComponents(1);
            this.loadOrders();
            this.bindEvents();
        } catch (e) {
            console.error("❌ CRASH INIT:", e);
        }
    },

    bindEvents: function() {
        document.getElementById('addMacroBtn')?.addEventListener('click', () => this.addMacro());
        // Ora queste chiamate funzioneranno perché changeCompPage esiste
        document.getElementById('prevCompPage')?.addEventListener('click', () => this.changeCompPage(-1));
        document.getElementById('nextCompPage')?.addEventListener('click', () => this.changeCompPage(1));
        document.getElementById('addCompBtn')?.addEventListener('click', () => this.addComponent());
    },

    // --- NUOVA FUNZIONE PER LA PAGINAZIONE ---
    changeCompPage: function(delta) {
        const newPage = this.data.componentiPage + delta;
        if (newPage < 1) return; // Non andare sotto pagina 1
        
        // Carichiamo la nuova pagina
        this.loadComponents(newPage);
    },

    loadRefData: async function() {
        console.log("🔄 Caricamento dati...");
        
        try {
            const res = await apiFetch('/api/admin/init-data');
            
            if (!res.ok) {
                throw new Error(`Errore API: ${res.status}`);
            }
            
            const d = await res.json();
            console.log("📦 RISPOSTA SERVER COMPLETA:", d);

            const rawMacros = d.macros || d.macro_categorie || d.data?.macros || [];
            this.data.macros = Array.isArray(rawMacros) ? rawMacros : [];
            this.data.ruoli = Array.isArray(d.ruoli) ? d.ruoli : [];
            this.data.fasi = Array.isArray(d.fasi) ? d.fasi : [];
            this.data.allComponents = Array.isArray(d.componenti) ? d.componenti : []; 
            
            console.log(`✅ ANALISI DATI: Macro ${this.data.macros.length}, Ruoli ${this.data.ruoli.length}`);

        } catch (e) {
            console.error("❌ Errore loadRefData:", e);
            const tbody = document.querySelector('#macrosTable tbody');
            if(tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Errore: ${e.message}</td></tr>`;
            throw e;
        }
    },

    setupTabs: function() {
        const tabs = document.querySelectorAll('.config-tab');
        const contents = document.querySelectorAll('.tab-pane');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.target)?.classList.add('active');
            });
        });
    },

    renderMacros: function() {
        const tbody = document.querySelector('#macrosTable tbody');
        if (!tbody) return;

        if (this.data.macros.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Nessuna macro trovata.</td></tr>';
            return;
        }

        this.data.macros.sort((a, b) => (a.nome || a.nome_macro || '').toLowerCase().localeCompare((b.nome || b.nome_macro || '').toLowerCase()));
        tbody.innerHTML = '';

        this.data.macros.forEach(m => {
            const tr = document.createElement('tr');
            const valNome = m.nome || m.nome_macro || '';
            const valIcona = m.icona || m.icona_macro || '';

            tr.innerHTML = `
                <td style="text-align: center; color: #888;">${m.id_macro_categoria}</td>
                <td><input type="text" class="edit-macro-name" value="${valNome}" style="width: 100%; font-weight: 500;"></td>
                <td><input type="text" class="edit-macro-icon" value="${valIcona}" style="width: 50px; text-align: center; font-size: 1.2em;"></td>
                <td><select class="choice-macro-comps" multiple></select></td>
                <td style="text-align: center; white-space: nowrap;">
                    <button class="action-btn save-macro-btn" data-id="${m.id_macro_categoria}" title="Salva">💾</button>
                    <button class="action-btn delete-macro-btn" data-id="${m.id_macro_categoria}" title="Elimina" style="color: #dc3545; border-color: #dc3545;">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);

            // Setup Choices.js (omesso per brevità, logica identica a prima)
            const selectEl = tr.querySelector('.choice-macro-comps');
            const choices = new Choices(selectEl, { removeItemButton: true, itemSelectText: '', position: 'bottom', shouldSort: false });
            const options = this.data.allComponents.map(comp => ({
                value: comp.id_componente,
                label: comp.nome_componente,
                selected: (comp.ids_macro_categorie || []).includes(m.id_macro_categoria)
            }));
            choices.setChoices(options, 'value', 'label', true);

            // Bind Save
            tr.querySelector('.save-macro-btn').addEventListener('click', async (e) => {
                const btn = e.currentTarget; btn.textContent = "⏳";
                try {
                    const payload = {
                        nome: tr.querySelector('.edit-macro-name').value,
                        icona: tr.querySelector('.edit-macro-icon').value,
                        ids_componenti: choices.getValue(true)
                    };
                    await apiFetch(`/api/admin/macro/${m.id_macro_categoria}`, { method: 'PUT', body: JSON.stringify(payload) });
                    btn.textContent = "✅"; setTimeout(() => btn.textContent = "💾", 1000);
                    await App.loadRefData();
                } catch (e) { alert("Errore: " + e.message); btn.textContent = "❌"; }
            });

            // Bind Delete
            tr.querySelector('.delete-macro-btn').addEventListener('click', async () => {
                if(!confirm(`Eliminare macro "${valNome}"?`)) return;
                try {
                    await apiFetch(`/api/admin/macro/${m.id_macro_categoria}`, { method: 'DELETE' });
                    tr.remove();
                } catch (e) { alert("Errore cancellazione"); }
            });
        });
    },

    addMacro: async function() {
        const nome = document.getElementById('newMacroName').value;
        const icona = document.getElementById('newMacroIcon').value;
        if(!nome) return alert("Nome obbligatorio");
        
        try {
            await apiFetch('/api/admin/macro', { method: 'POST', body: JSON.stringify({ nome: nome, icona: icona }) });
            await this.loadRefData();
            this.renderMacros();
            document.getElementById('newMacroName').value = '';
            document.getElementById('newMacroIcon').value = '';
        } catch (e) { alert("Errore: " + e.message); }
    },

    // --- COMPONENTI ---
    addComponent: async function() {
        const nome = document.getElementById('newCompName').value;
        const codice = document.getElementById('newCompCode').value;
        if (!nome) return alert("Inserisci il nome.");
        
        const btn = document.getElementById('addCompBtn');
        btn.disabled = true; btn.textContent = "⏳";
        
        try {
            await apiFetch('/api/admin/componenti', { method: 'POST', body: JSON.stringify({ nome_componente: nome, codice_componente: codice }) });
            document.getElementById('newCompName').value = '';
            document.getElementById('newCompCode').value = '';
            this.loadComponents(1); // Ricarica prima pagina
        } catch (error) { alert("Errore: " + error.message); } 
        finally { btn.disabled = false; btn.textContent = "+ Aggiungi Componente"; }
    },

    loadComponents: async function(page) {
        this.data.componentiPage = page;
        const indicator = document.getElementById('compPageIndicator');
        if(indicator) indicator.innerText = `Pagina ${page}`;
        
        try {
            const res = await apiFetch(`/api/admin/componenti?page=${page}`);
            const json = await res.json();
            const data = json.data || [];
            const tbody = document.querySelector('#componentsTable tbody');
            tbody.innerHTML = '';
            
            if (data.length === 0) { 
                // Se la pagina è > 1 e non ci sono dati, potremmo tornare indietro, 
                // ma per ora mostriamo solo il messaggio.
                if (page > 1) {
                    // Opzionale: torna indietro automaticamente
                    // this.changeCompPage(-1); 
                    // return;
                }
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nessun componente trovato in questa pagina.</td></tr>'; 
                return; 
            }

            data.forEach(comp => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="vertical-align: top;">
                        <input type="text" class="edit-name" value="${comp.nome_componente || ''}" style="width:100%; margin-bottom:5px;" placeholder="Nome">
                        <input type="text" class="edit-code" value="${comp.codice_componente || ''}" style="width:100%; font-size:0.85em; color:#666;" placeholder="Codice">
                    </td>
                    <td style="vertical-align: top;"><select class="choice-macro" multiple></select></td>
                    <td style="vertical-align: top;"><select class="choice-ruoli" multiple></select></td>
                    <td style="vertical-align: top;"><select class="choice-fasi" multiple></select></td>
                    
                    <!-- MODIFICATA ULTIMA COLONNA CON I DUE TASTI -->
                    <td style="vertical-align: top; text-align: center; white-space: nowrap;">
                        <button class="action-btn save-btn" data-id="${comp.id_componente}" title="Salva">💾</button>
                        <button class="action-btn delete-btn" data-id="${comp.id_componente}" title="Elimina" style="color: #dc3545; border-color: #dc3545; margin-left: 5px;">🗑️</button>
                    </td>
                `;
                tbody.appendChild(tr);
                
                // Config Choices (identico a prima)
                const config = { removeItemButton: true, itemSelectText: '', position: 'bottom', shouldSort: false, searchEnabled: false };
                const macroSelect = new Choices(tr.querySelector('.choice-macro'), config);
                const ruoliSelect = new Choices(tr.querySelector('.choice-ruoli'), config);
                const fasiSelect  = new Choices(tr.querySelector('.choice-fasi'), config);
                
                const mapOpts = (src, valK, lblK, selArr) => src.map(i => ({ value: i[valK], label: i[lblK] || i.nome || '?', selected: (selArr || []).includes(i[valK]) }));
                macroSelect.setChoices(mapOpts(this.data.macros, 'id_macro_categoria', 'nome', comp.ids_macro_categorie), 'value', 'label', false);
                ruoliSelect.setChoices(mapOpts(this.data.ruoli, 'id_ruolo', 'nome_ruolo', comp.ids_ruoli_abilitati), 'value', 'label', false);
                fasiSelect.setChoices(mapOpts(this.data.fasi, 'id_fase', 'nome_fase', comp.ids_fasi_abilitate), 'value', 'label', false);

                // --- GESTIONE SALVATAGGIO ---
                tr.querySelector('.save-btn').addEventListener('click', async (e) => {
                    const btn = e.currentTarget; btn.textContent = "⏳";
                    const payload = {
                        nome_componente: tr.querySelector('.edit-name').value,
                        codice_componente: tr.querySelector('.edit-code').value,
                        ids_macro_categorie: macroSelect.getValue(true),
                        ids_ruoli_abilitati: ruoliSelect.getValue(true),
                        ids_fasi_abilitate: fasiSelect.getValue(true)
                    };
                    try { await apiFetch(`/api/admin/componenti/${btn.dataset.id}`, { method: 'PUT', body: JSON.stringify(payload) }); btn.textContent = "✅"; setTimeout(() => btn.textContent = "💾", 1500); } 
                    catch(err) { alert("Errore: " + err.message); btn.textContent = "❌"; }
                });

                // --- GESTIONE ELIMINAZIONE (NUOVO) ---
                tr.querySelector('.delete-btn').addEventListener('click', async (e) => {
                    const btn = e.currentTarget;
                    const compName = tr.querySelector('.edit-name').value;
                    if(!confirm(`Sei sicuro di voler eliminare il componente "${compName}"?`)) return;

                    btn.textContent = "⏳";
                    try {
                        const res = await apiFetch(`/api/admin/componenti/${btn.dataset.id}`, { method: 'DELETE' });
                        if(!res.ok) throw new Error("Errore durante l'eliminazione");
                        tr.remove(); // Rimuove la riga dalla tabella visivamente
                    } catch (err) {
                        alert("Impossibile eliminare: " + err.message);
                        btn.textContent = "🗑️";
                    }
                });
            });
        } catch (e) { console.error(e); }
    },

    // --- COMMESSE ---
    loadOrders: async function() {
        try {
            // Nota: Se hai cambiato lo status per i test, rimetti quello che preferisci (es. status=In Lavorazione)
            const res = await apiFetch('/api/commesse/view?limit=50&status=In Lavorazione'); 
            const json = await res.json();
            const data = json.data || [];
            const tbody = document.querySelector('#ordersTable tbody');
            tbody.innerHTML = '';
            
            if(data.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Nessuna commessa attiva trovata.</td></tr>'; return; }

            data.forEach(comm => {
                // --- Calcolo etichette ---
                let nomeCliente = 'Cliente Sconosciuto';
                if (comm.clienti && comm.clienti.ragione_sociale) {
                    nomeCliente = comm.clienti.ragione_sociale;
                } else if (comm.nome_cliente) {
                    nomeCliente = comm.nome_cliente;
                }
                
                const labelImpianto = comm.impianto || '';
                // Fix per VO che abbiamo fatto prima
                const labelOdv = comm.vo || comm.ordine_vendita || comm.odv || '-';
                const labelRif = comm.riferimento_tecnico || '-';
                const labelCodice = comm.codice_commessa || '';

                // --- Creazione Riga ---
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div style="font-weight: 700; color: #2c3e50; font-size: 1.05em;">${nomeCliente} - ${labelImpianto}</div>
                        <div style="color: #666; font-size: 0.9em; margin-top: 4px;">OV: <strong>${labelOdv}</strong> | Rif: <strong>${labelRif}</strong></div>
                        <div style="font-size: 0.8em; color: #999; margin-top: 2px;">${labelCodice}</div>
                    </td>
                    <td style="overflow: visible;"><select class="choice-macro-comm" multiple></select></td>
                    <td style="text-align: center; white-space: nowrap;">
                        <!-- NUOVO BOTTONE ANTEPRIMA -->
                        <button class="action-btn view-preview-btn" title="Vedi Anteprima Componenti" style="margin-right: 5px; color: #007bff; border-color: #007bff;">👁️</button>
                        <button class="action-btn save-btn" title="Salva Modifiche">💾</button>
                    </td>
                `;
                tbody.appendChild(tr);

                // --- Inizializzazione Choices.js ---
                const macroSelectElement = tr.querySelector('.choice-macro-comm');
                const macroSelect = new Choices(macroSelectElement, { removeItemButton: true, itemSelectText: '', position: 'bottom' });
                
                macroSelect.setChoices(this.data.macros.map(m => ({ 
                    value: m.id_macro_categoria, 
                    label: m.nome || m.nome_macro, 
                    selected: (comm.ids_macro_categorie_attive || []).includes(m.id_macro_categoria) 
                })), 'value', 'label', false);

                // --- EVENTO 1: SALVATAGGIO (Già esistente, aggiornato url se necessario) ---
                tr.querySelector('.save-btn').addEventListener('click', async (e) => {
                    const btn = e.currentTarget; btn.textContent = "⏳";
                    try { 
                        // Assicurati che il backend abbia la rotta PUT /api/admin/commesse/:id creata prima
                        await apiFetch(`/api/admin/commesse/${comm.id_commessa}`, { 
                            method: 'PUT', 
                            body: JSON.stringify({ ids_macro_categorie_attive: macroSelect.getValue(true) }) 
                        }); 
                        btn.textContent = "✅"; setTimeout(() => btn.textContent = "💾", 1000); 
                    } catch(err) { alert("Errore: " + err.message); btn.textContent = "❌"; }
                });

                // --- EVENTO 2: ANTEPRIMA ESPLOSA (LAYOUT INTUITIVO) ---
                tr.querySelector('.view-preview-btn').addEventListener('click', () => {
                    const selectedMacroIds = macroSelect.getValue(true);

                    if (selectedMacroIds.length === 0) {
                        alert("Seleziona almeno una macro per vedere i componenti.");
                        return;
                    }

                    let htmlContent = `<div style="margin-bottom:15px; color:#555;">Anteprima configurazione per: <strong>${labelOdv}</strong></div>`;
                    let hasAnyContent = false;

                    // 1. CICLO SULLE MACRO SELEZIONATE
                    selectedMacroIds.forEach(mId => {
                        const macroObj = this.data.macros.find(m => m.id_macro_categoria == mId);
                        if (!macroObj) return;

                        // Filtra componenti che appartengono a questa macro
                        const componentsInMacro = this.data.allComponents.filter(comp => {
                            const cMacros = comp.ids_macro_categorie || [];
                            return cMacros.includes(parseInt(mId));
                        });

                        // Se la macro non ha componenti, saltala (opzionale, o mostra messaggio)
                        if (componentsInMacro.length === 0) return;
                        hasAnyContent = true;

                        htmlContent += `
                            <div class="exploded-macro-container">
                                <div class="exploded-macro-header">
                                    <span>${macroObj.icona || '📦'}</span>
                                    <span>Macro: ${macroObj.nome}</span>
                                </div>
                                <div class="exploded-grid">
                        `;

                        // 2. CICLO SULLE FASI (Es. Cablaggio, Collaudo)
                        // Ordiniamo le fasi per ID per coerenza cronologica
                        const fasiOrdinate = [...this.data.fasi].sort((a,b) => a.id_fase - b.id_fase);
                        
                        let fasiTrovate = 0;

                        fasiOrdinate.forEach(fase => {
                            // C'è almeno un componente in questa macro che usa questa fase?
                            // Un componente è "visibile" se ha l'ID della fase nel suo array ids_fasi_abilitate
                            const compsInFase = componentsInMacro.filter(c => 
                                (c.ids_fasi_abilitate || []).includes(fase.id_fase)
                            );

                            if (compsInFase.length > 0) {
                                fasiTrovate++;
                                htmlContent += `
                                    <div class="phase-card">
                                        <div class="phase-header">${fase.nome_fase}</div>
                                `;

                                // 3. CICLO SUI RUOLI (Es. Elettricista)
                                const ruoliOrdinati = [...this.data.ruoli].sort((a,b) => a.id_ruolo - b.id_ruolo);
                                let ruoliTrovati = 0;

                                ruoliOrdinati.forEach(ruolo => {
                                    // Quali componenti, in QUESTA fase e in QUESTA macro, vede QUESTO ruolo?
                                    const compsForRole = compsInFase.filter(c => 
                                        (c.ids_ruoli_abilitati || []).includes(ruolo.id_ruolo)
                                    );

                                    if (compsForRole.length > 0) {
                                        ruoliTrovati++;
                                        htmlContent += `
                                            <div class="role-block">
                                                <div class="role-title">
                                                    <span class="role-dot"></span> ${ruolo.nome_ruolo}
                                                </div>
                                                <ul class="comp-list-mini">
                                        `;
                                        
                                        compsForRole.forEach(c => {
                                            const codiceHtml = c.codice_componente ? `<span class="comp-code-tag">${c.codice_componente}</span>` : '';
                                            htmlContent += `<li>${c.nome_componente} ${codiceHtml}</li>`;
                                        });

                                        htmlContent += `</ul></div>`;
                                    }
                                });

                                if (ruoliTrovati === 0) {
                                    htmlContent += `<div class="empty-msg">Nessun ruolo abilitato nonostante ci siano componenti.</div>`;
                                }

                                htmlContent += `</div>`; // Chiude phase-card
                            }
                        });

                        if (fasiTrovate === 0) {
                            htmlContent += `<div class="empty-msg" style="grid-column: 1 / -1;">Questa macro contiene componenti (${componentsInMacro.length}), ma nessuno è assegnato a una Fase specifica.</div>`;
                        }

                        htmlContent += `</div></div>`; // Chiude exploded-grid e exploded-macro-container
                    });

                    if (!hasAnyContent) {
                        htmlContent += `<div style="text-align:center; padding:20px; color:#888;">Nessun componente trovato nelle macro selezionate.</div>`;
                    }

                    // Iniezione nel modale
                    document.getElementById('explodedViewContent').innerHTML = htmlContent;
                    document.getElementById('explodedViewModal').style.display = 'block';
                });
            });
        } catch(e) { console.error(e); }
    }
};

document.addEventListener('DOMContentLoaded', () => { App.init(); });