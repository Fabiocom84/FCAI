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
        console.log("Admin Config Tool Init");
        
        // Verifica esistenza elementi chiave per evitare errori se la pagina non ha caricato
        if (!document.getElementById('macrosTable')) return;

        try {
            await this.loadRefData();
            
            this.setupTabs();
            this.renderMacros();
            this.loadComponents(1);
            this.loadOrders();
            
            // Event Listeners
            document.getElementById('addMacroBtn').addEventListener('click', () => this.addMacro());
            document.getElementById('prevCompPage').addEventListener('click', () => this.changeCompPage(-1));
            document.getElementById('nextCompPage').addEventListener('click', () => this.changeCompPage(1));
            document.getElementById('addCompBtn').addEventListener('click', () => this.addComponent());
        } catch (e) {
            console.error("Errore inizializzazione admin-config:", e);
            alert("Errore caricamento dati: " + e.message);
        }
    },

    loadRefData: async function() {
        const res = await apiFetch('/api/admin/init-data');
        const d = await res.json();
        this.data.macros = d.macros;
        this.data.ruoli = d.ruoli;
        this.data.fasi = d.fasi;
        console.log("Reference Data Loaded:", this.data);
    },

    setupTabs: function() {
        const tabs = document.querySelectorAll('.config-tab');
        const contents = document.querySelectorAll('.tab-pane');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Rimuovi active da tutti
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));

                // Aggiungi active al cliccato
                tab.classList.add('active');
                const targetId = tab.dataset.target;
                document.getElementById(targetId).classList.add('active');
            });
        });
    },

    // --- MACRO ---
    renderMacros: function() {
        const tbody = document.querySelector('#macrosTable tbody');
        if (!this.data.macros.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nessuna macro trovata</td></tr>';
            return;
        }
        tbody.innerHTML = this.data.macros.map(m => `
            <tr>
                <td>${m.id_macro_categoria}</td>
                <td><strong>${m.nome}</strong></td>
                <td style="font-size:1.5em;">${m.icona || ''}</td>
                <td><button class="action-btn" title="Funzione non attiva">✏️</button></td>
            </tr>
        `).join('');
    },

    addMacro: async function() {
        const nome = document.getElementById('newMacroName').value;
        const icona = document.getElementById('newMacroIcon').value;
        if(!nome) return alert("Nome obbligatorio");
        
        try {
            await apiFetch('/api/admin/macro', { method: 'POST', body: JSON.stringify({ nome, icona }) });
            await this.loadRefData();
            this.renderMacros();
            document.getElementById('newMacroName').value = '';
            document.getElementById('newMacroIcon').value = '';
        } catch (e) {
            alert("Errore aggiunta macro: " + e.message);
        }
    },

    // --- COMPONENTI ---
    addComponent: async function() {
        const nome = document.getElementById('newCompName').value;
        const codice = document.getElementById('newCompCode').value;
        
        if (!nome) return alert("Inserisci almeno il nome del componente.");
        
        const btn = document.getElementById('addCompBtn');
        btn.disabled = true;
        btn.textContent = "Salvataggio...";

        try {
            await apiFetch('/api/admin/componenti', {
                method: 'POST',
                body: JSON.stringify({ 
                    nome_componente: nome, 
                    codice_componente: codice 
                })
            });
            
            document.getElementById('newCompName').value = '';
            document.getElementById('newCompCode').value = '';
            this.loadComponents(1); 
            
        } catch (error) {
            alert("Errore creazione: " + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "+ Aggiungi Componente";
        }
    },

    loadComponents: async function(page) {
        this.data.componentiPage = page;
        const indicator = document.getElementById('compPageIndicator');
        if(indicator) indicator.innerText = `Pagina ${page}`;
        
        try {
            const res = await apiFetch(`/api/admin/componenti?page=${page}`);
            const { data } = await res.json();
            const tbody = document.querySelector('#componentsTable tbody');
            tbody.innerHTML = '';

            data.forEach(comp => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="vertical-align: top;">
                        <input type="text" class="edit-name" value="${comp.nome_componente || ''}" style="width: 100%; margin-bottom: 5px; font-weight:bold;">
                        <input type="text" class="edit-code" value="${comp.codice_componente || ''}" placeholder="Codice" style="width: 100%; font-size: 0.8em; color: #666;">
                    </td>
                    <td style="vertical-align: top;"><select class="choice-macro" multiple></select></td>
                    <td style="vertical-align: top;"><select class="choice-ruoli" multiple></select></td>
                    <td style="vertical-align: top;"><select class="choice-fasi" multiple></select></td>
                    <td style="vertical-align: top; text-align: center;">
                        <button class="action-btn save-btn" data-id="${comp.id_componente}" title="Salva modifiche">💾</button>
                    </td>
                `;
                tbody.appendChild(tr);

                const choicesConfig = { removeItemButton: true, itemSelectText: '', position: 'bottom', shouldSort: false, searchEnabled: false };
                
                const macroSelect = new Choices(tr.querySelector('.choice-macro'), choicesConfig);
                const ruoliSelect = new Choices(tr.querySelector('.choice-ruoli'), choicesConfig);
                const fasiSelect  = new Choices(tr.querySelector('.choice-fasi'), choicesConfig);

                const mapOptions = (sourceData, valueKey, labelKey, selectedArray) => {
                    return sourceData.map(item => ({
                        value: item[valueKey],
                        label: item[labelKey],
                        selected: (selectedArray || []).includes(item[valueKey])
                    }));
                };

                macroSelect.setChoices(mapOptions(this.data.macros, 'id_macro_categoria', 'nome', comp.ids_macro_categorie), 'value', 'label', false);
                ruoliSelect.setChoices(mapOptions(this.data.ruoli, 'id_ruolo', 'nome_ruolo', comp.ids_ruoli_abilitati), 'value', 'label', false);
                fasiSelect.setChoices(mapOptions(this.data.fasi, 'id_fase', 'nome_fase', comp.ids_fasi_abilitate), 'value', 'label', false);

                const saveBtn = tr.querySelector('.save-btn');
                saveBtn.addEventListener('click', async (e) => {
                    const btn = e.currentTarget; 
                    const compId = btn.dataset.id;
                    btn.textContent = "⏳";
                    btn.disabled = true;

                    const payload = {
                        nome_componente: tr.querySelector('.edit-name').value,
                        codice_componente: tr.querySelector('.edit-code').value,
                        ids_macro_categorie: macroSelect.getValue(true),
                        ids_ruoli_abilitati: ruoliSelect.getValue(true),
                        ids_fasi_abilitate: fasiSelect.getValue(true)
                    };

                    try {
                        const response = await apiFetch(`/api/admin/componenti/${compId}`, { 
                            method: 'PUT', body: JSON.stringify(payload) 
                        });
                        if (!response.ok) throw new Error("Errore API");
                        btn.textContent = "✅";
                        setTimeout(() => { btn.textContent = "💾"; btn.disabled = false; }, 1000);
                    } catch (err) {
                        alert("Errore salvataggio: " + err.message);
                        btn.textContent = "❌";
                        btn.disabled = false;
                    }
                });
            });
        } catch (error) {
            console.error("Errore caricamento componenti:", error);
        }
    },

    changeCompPage: function(delta) {
        const newPage = this.data.componentiPage + delta;
        if(newPage > 0) this.loadComponents(newPage);
    },

    // --- COMMESSE ---
    loadOrders: async function() {
        const res = await apiFetch('/api/commesse/view?limit=50&status=In Lavorazione'); 
        const { data } = await res.json();
        const tbody = document.querySelector('#ordersTable tbody');
        tbody.innerHTML = '';

        data.forEach(comm => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${comm.impianto}</strong><br><small style="color:#666;">${comm.codice_commessa || 'N/D'}</small></td>
                <td><select class="choice-macro-comm" multiple></select></td>
                <td style="text-align: center;"><button class="action-btn save-btn">💾</button></td>
            `;
            tbody.appendChild(tr);

            const macroSelect = new Choices(tr.querySelector('.choice-macro-comm'), { removeItemButton: true, itemSelectText: '' });
            
            macroSelect.setChoices(this.data.macros.map(m => ({ 
                value: m.id_macro_categoria, 
                label: m.nome, 
                selected: (comm.ids_macro_categorie_attive || []).includes(m.id_macro_categoria) 
            })), 'value', 'label', false);

            tr.querySelector('.save-btn').addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                btn.textContent = "⏳";
                const payload = { ids_macro_categorie_attive: macroSelect.getValue(true) };
                try {
                    await apiFetch(`/api/admin/commesse/${comm.id_commessa}`, { method: 'PUT', body: JSON.stringify(payload) });
                    btn.textContent = "✅";
                    setTimeout(() => btn.textContent = "💾", 1000);
                } catch(err) {
                    alert("Errore: " + err.message);
                    btn.textContent = "❌";
                }
            });
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});