// js/admin-config.js

import { apiFetch } from './api-client.js';

const App = {
    data: {
        macros: [],
        ruoli: [],
        fasi: [],
        componentiPage: 1
    },

    init: async function() {
        console.log("🚀 ADMIN CONFIG INIT (Nomi DB Corretti)");
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
        try {
            const res = await apiFetch('/api/admin/init-data');
            if (!res.ok) throw new Error(`API Error ${res.status}`);
            const d = await res.json();
            
            console.log("📦 Dati Ricevuti:", d);

            this.data.macros = d.macros || [];
            this.data.ruoli = d.ruoli || [];
            this.data.fasi = d.fasi || [];
        } catch (e) {
            console.error("Errore loadRefData:", e);
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

    // --- MACRO (Usa 'nome' e 'icona' come da DB) ---
    renderMacros: function() {
        const tbody = document.querySelector('#macrosTable tbody');
        if (!tbody) return;

        if (this.data.macros.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Nessuna macro trovata.</td></tr>';
            return;
        }

        tbody.innerHTML = this.data.macros.map(m => `
            <tr>
                <td>${m.id_macro_categoria}</td>
                <!-- IMPORTANTE: Usa m.nome, non m.nome_macro -->
                <td><strong>${m.nome || m.nome_macro || '???'}</strong></td>
                <td><span style="font-size:1.5em;">${m.icona || m.icona_macro || ''}</span></td>
                <td><button class="action-btn" disabled>✏️</button></td>
            </tr>
        `).join('');
    },

    addMacro: async function() {
        const nome = document.getElementById('newMacroName').value;
        const icona = document.getElementById('newMacroIcon').value;
        
        if(!nome) return alert("Nome obbligatorio");
        
        // CORREZIONE FONDAMENTALE: Invio le chiavi che il Backend (e il DB) si aspettano
        const payload = { 
            nome: nome, 
            icona: icona 
        };

        try {
            const res = await apiFetch('/api/admin/macro', { 
                method: 'POST', 
                body: JSON.stringify(payload) 
            });
            
            if(!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Errore sconosciuto");
            }

            await this.loadRefData();
            this.renderMacros();
            document.getElementById('newMacroName').value = '';
            document.getElementById('newMacroIcon').value = '';
        } catch (e) {
            alert("Errore salvataggio: " + e.message);
        }
    },

    // ... (Mantieni le altre funzioni loadComponents, addComponent, loadOrders come nell'ultima versione funzionante) ...
    // Se ti servono te le rimetto qui sotto per completezza:
    
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
                    <td style="vertical-align: top;"><input type="text" class="edit-name" value="${comp.nome_componente || ''}" style="width:100%;"><input type="text" class="edit-code" value="${comp.codice_componente || ''}" style="width:100%;"></td>
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

    changeCompPage: function(delta) {
        const newPage = this.data.componentiPage + delta;
        if(newPage > 0) this.loadComponents(newPage);
    },

    loadOrders: async function() {
        try {
            const res = await apiFetch('/api/commesse/view?limit=50&status=In Lavorazione'); 
            const json = await res.json();
            const data = json.data || [];
            const tbody = document.querySelector('#ordersTable tbody');
            tbody.innerHTML = '';
            if(data.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Nessuna commessa.</td></tr>'; return; }

            data.forEach(comm => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td><strong>${comm.impianto}</strong><br><small>${comm.codice_commessa||''}</small></td><td><select class="choice-macro-comm" multiple></select></td><td style="text-align: center;"><button class="action-btn save-btn">💾</button></td>`;
                tbody.appendChild(tr);
                const macroSelect = new Choices(tr.querySelector('.choice-macro-comm'), { removeItemButton: true, itemSelectText: '' });
                macroSelect.setChoices(this.data.macros.map(m => ({ value: m.id_macro_categoria, label: m.nome, selected: (comm.ids_macro_categorie_attive || []).includes(m.id_macro_categoria) })), 'value', 'label', false);
                tr.querySelector('.save-btn').addEventListener('click', async (e) => {
                    const btn = e.currentTarget; btn.textContent = "⏳";
                    try { await apiFetch(`/api/admin/commesse/${comm.id_commessa}`, { method: 'PUT', body: JSON.stringify({ ids_macro_categorie_attive: macroSelect.getValue(true) }) }); btn.textContent = "✅"; setTimeout(() => btn.textContent = "💾", 1000); } 
                    catch(err) { alert("Errore: " + err.message); btn.textContent = "❌"; }
                });
            });
        } catch(e) { console.error(e); }
    }
};

document.addEventListener('DOMContentLoaded', () => { App.init(); });