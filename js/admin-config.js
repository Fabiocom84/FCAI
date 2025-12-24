// js/admin-config.js

import { apiFetch } from './api-client.js';

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
        document.getElementById('prevCompPage')?.addEventListener('click', () => this.changeCompPage(-1));
        document.getElementById('nextCompPage')?.addEventListener('click', () => this.changeCompPage(1));
        document.getElementById('addCompBtn')?.addEventListener('click', () => this.addComponent());
    },

    loadRefData: async function() {
        console.log("🔄 Caricamento dati di riferimento...");
        
        // Funzione helper per mostrare errori nella tabella
        const showTableError = (msg) => {
            const tbody = document.querySelector('#macrosTable tbody');
            if(tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color: red;">⚠️ ${msg} <br><button onclick="location.reload()" style="margin-top:10px; cursor:pointer;">Ricarica Pagina</button></td></tr>`;
        };

        try {
            const res = await apiFetch('/api/admin/init-data');
            
            if (!res.ok) {
                throw new Error(`Errore API: ${res.status}`);
            }
            
            const d = await res.json();
            
            // Verifica che i dati siano validi array, altrimenti usa array vuoto
            this.data.macros = Array.isArray(d.macros) ? d.macros : [];
            this.data.ruoli = Array.isArray(d.ruoli) ? d.ruoli : [];
            this.data.fasi = Array.isArray(d.fasi) ? d.fasi : [];
            this.data.allComponents = Array.isArray(d.componenti) ? d.componenti : []; 
            
            console.log("✅ Dati caricati:", this.data.macros.length, "macro trovate.");

        } catch (e) {
            console.error("❌ Errore loadRefData:", e);
            // Non resettiamo a vuoto silenziosamente, avvisiamo l'utente
            this.data.macros = []; 
            showTableError("Errore caricamento dati: " + e.message);
            // Rilanciamo l'errore per bloccare il render successivo se necessario
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

        // ORDINAMENTO ALFABETICO
        this.data.macros.sort((a, b) => {
            const na = (a.nome || a.nome_macro || '').toLowerCase();
            const nb = (b.nome || b.nome_macro || '').toLowerCase();
            return na.localeCompare(nb);
        });

        tbody.innerHTML = '';

        this.data.macros.forEach(m => {
            const tr = document.createElement('tr');
            
            const valNome = m.nome || m.nome_macro || '';
            const valIcona = m.icona || m.icona_macro || '';

            tr.innerHTML = `
                <td style="text-align: center; color: #888;">${m.id_macro_categoria}</td>
                <td>
                    <input type="text" class="edit-macro-name" value="${valNome}" style="width: 100%; font-weight: 500;">
                </td>
                <td>
                    <input type="text" class="edit-macro-icon" value="${valIcona}" style="width: 50px; text-align: center; font-size: 1.2em;">
                </td>
                <td>
                    <select class="choice-macro-comps" multiple></select>
                </td>
                <td style="text-align: center; white-space: nowrap;">
                    <button class="action-btn save-macro-btn" data-id="${m.id_macro_categoria}" title="Salva">💾</button>
                    <button class="action-btn delete-macro-btn" data-id="${m.id_macro_categoria}" title="Elimina" style="color: #dc3545; border-color: #dc3545;">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);

            const selectEl = tr.querySelector('.choice-macro-comps');
            const choices = new Choices(selectEl, {
                removeItemButton: true,
                itemSelectText: '',
                position: 'bottom',
                placeholderValue: 'Associa...',
                searchEnabled: true,
                shouldSort: false
            });

            const options = this.data.allComponents.map(comp => {
                const hasMacro = (comp.ids_macro_categorie || []).includes(m.id_macro_categoria);
                return {
                    value: comp.id_componente,
                    label: comp.nome_componente,
                    selected: hasMacro
                };
            });
            choices.setChoices(options, 'value', 'label', true);

            const saveBtn = tr.querySelector('.save-macro-btn');
            saveBtn.addEventListener('click', async () => {
                const newName = tr.querySelector('.edit-macro-name').value;
                const newIcon = tr.querySelector('.edit-macro-icon').value;
                const selectedComponentIds = choices.getValue(true);
                
                saveBtn.textContent = "⏳";
                saveBtn.disabled = true;

                try {
                    const response = await apiFetch(`/api/admin/macro/${m.id_macro_categoria}`, { 
                        method: 'PUT', 
                        body: JSON.stringify({ 
                            nome: newName, 
                            icona: newIcon,
                            ids_componenti: selectedComponentIds 
                        }) 
                    });

                    if (!response.ok) throw new Error("Errore salvataggio.");

                    saveBtn.textContent = "✅";
                    setTimeout(() => { saveBtn.textContent = "💾"; saveBtn.disabled = false; }, 1000);
                    await App.loadRefData();
                } catch (e) {
                    alert("Errore: " + e.message);
                    saveBtn.textContent = "❌";
                    saveBtn.disabled = false;
                }
            });

            const delBtn = tr.querySelector('.delete-macro-btn');
            delBtn.addEventListener('click', async () => {
                if(!confirm(`Eliminare macro "${valNome}"?`)) return;
                delBtn.textContent = "⏳";
                try {
                    const res = await apiFetch(`/api/admin/macro/${m.id_macro_categoria}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error("Errore");
                    tr.remove();
                } catch (e) { alert("Errore"); delBtn.textContent = "🗑️"; }
            });
        });
    },

    addMacro: async function() {
        const nome = document.getElementById('newMacroName').value;
        const icona = document.getElementById('newMacroIcon').value;
        
        if(!nome) return alert("Nome obbligatorio");
        
        try {
            const res = await apiFetch('/api/admin/macro', { 
                method: 'POST', 
                body: JSON.stringify({ nome: nome, icona: icona }) 
            });
            
            if(!res.ok) throw new Error("Errore inserimento");

            await this.loadRefData();
            this.renderMacros();
            document.getElementById('newMacroName').value = '';
            document.getElementById('newMacroIcon').value = '';
        } catch (e) {
            alert("Errore salvataggio: " + e.message);
        }
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
            this.loadComponents(1); 
        } catch (error) { alert("Errore: " + error.message); } 
        finally { btn.disabled = false; btn.textContent = "+ Aggiungi Componente"; }
    },

    loadComponents: async function(page) {
        this.data.componentiPage = page;
        document.getElementById('compPageIndicator').innerText = `Pagina ${page}`;
        try {
            const res = await apiFetch(`/api/admin/componenti?page=${page}`);
            const json = await res.json();
            const data = json.data || [];
            const tbody = document.querySelector('#componentsTable tbody');
            tbody.innerHTML = '';
            
            if (data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nessun componente.</td></tr>'; return; }

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
                    <td style="vertical-align: top; text-align: center;"><button class="action-btn save-btn" data-id="${comp.id_componente}">💾</button></td>
                `;
                tbody.appendChild(tr);
                
                const config = { removeItemButton: true, itemSelectText: '', position: 'bottom', shouldSort: false, searchEnabled: false };
                const macroSelect = new Choices(tr.querySelector('.choice-macro'), config);
                const ruoliSelect = new Choices(tr.querySelector('.choice-ruoli'), config);
                const fasiSelect  = new Choices(tr.querySelector('.choice-fasi'), config);
                
                const mapOpts = (src, valK, lblK, selArr) => src.map(i => ({ value: i[valK], label: i[lblK] || i.nome || '?', selected: (selArr || []).includes(i[valK]) }));
                macroSelect.setChoices(mapOpts(this.data.macros, 'id_macro_categoria', 'nome', comp.ids_macro_categorie), 'value', 'label', false);
                ruoliSelect.setChoices(mapOpts(this.data.ruoli, 'id_ruolo', 'nome_ruolo', comp.ids_ruoli_abilitati), 'value', 'label', false);
                fasiSelect.setChoices(mapOpts(this.data.fasi, 'id_fase', 'nome_fase', comp.ids_fasi_abilitate), 'value', 'label', false);

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
            });
        } catch (e) { console.error(e); }
    },

    // --- COMMESSE ---
    loadOrders: async function() {
        try {
            const res = await apiFetch('/api/commesse/view?limit=50&status=In Lavorazione'); 
            const json = await res.json();
            const data = json.data || [];
            const tbody = document.querySelector('#ordersTable tbody');
            tbody.innerHTML = '';
            
            if(data.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Nessuna commessa attiva trovata.</td></tr>'; return; }

            data.forEach(comm => {
                // CORREZIONE ETICHETTA: Recupero sicuro dei dati del cliente
                let nomeCliente = 'Cliente Sconosciuto';
                if (comm.clienti && comm.clienti.ragione_sociale) {
                    nomeCliente = comm.clienti.ragione_sociale;
                } else if (comm.nome_cliente) {
                    nomeCliente = comm.nome_cliente;
                }

                const labelImpianto = comm.impianto || '';
                const labelOdv = comm.ordine_vendita || comm.odv || '-';
                const labelRif = comm.riferimento_tecnico || '-';
                const labelCodice = comm.codice_commessa || '';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div style="font-weight: 700; color: #2c3e50; font-size: 1.05em;">${nomeCliente} - ${labelImpianto}</div>
                        <div style="color: #666; font-size: 0.9em; margin-top: 4px;">
                            OV: <strong>${labelOdv}</strong> | Rif: <strong>${labelRif}</strong>
                        </div>
                        <div style="font-size: 0.8em; color: #999; margin-top: 2px;">${labelCodice}</div>
                    </td>
                    <td style="overflow: visible;">
                        <select class="choice-macro-comm" multiple></select>
                    </td>
                    <td style="text-align: center;">
                        <button class="action-btn save-btn">💾</button>
                    </td>
                `;
                tbody.appendChild(tr);

                const macroSelect = new Choices(tr.querySelector('.choice-macro-comm'), { 
                    removeItemButton: true, 
                    itemSelectText: '',
                    position: 'bottom'
                });
                
                macroSelect.setChoices(
                    this.data.macros.map(m => ({ 
                        value: m.id_macro_categoria, 
                        label: m.nome || m.nome_macro, 
                        selected: (comm.ids_macro_categorie_attive || []).includes(m.id_macro_categoria) 
                    })), 
                    'value', 
                    'label', 
                    false
                );

                tr.querySelector('.save-btn').addEventListener('click', async (e) => {
                    const btn = e.currentTarget; btn.textContent = "⏳";
                    try { 
                        await apiFetch(`/api/admin/commesse/${comm.id_commessa}`, { 
                            method: 'PUT', 
                            body: JSON.stringify({ ids_macro_categorie_attive: macroSelect.getValue(true) }) 
                        }); 
                        btn.textContent = "✅"; 
                        setTimeout(() => btn.textContent = "💾", 1000); 
                    } 
                    catch(err) { 
                        alert("Errore: " + err.message); 
                        btn.textContent = "❌"; 
                    }
                });
            });
        } catch(e) { console.error(e); }
    }
};

document.addEventListener('DOMContentLoaded', () => { App.init(); });