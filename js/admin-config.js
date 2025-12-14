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
        await this.loadRefData();
        
        this.setupTabs();
        this.renderMacros();
        this.loadComponents(1);
        this.loadOrders();
        
        document.getElementById('addMacroBtn').addEventListener('click', () => this.addMacro());
        document.getElementById('prevCompPage').addEventListener('click', () => this.changeCompPage(-1));
        document.getElementById('nextCompPage').addEventListener('click', () => this.changeCompPage(1));
        document.getElementById('addCompBtn').addEventListener('click', () => this.addComponent());
    },

    loadRefData: async function() {
        const res = await apiFetch('/api/admin/init-data');
        const d = await res.json();
        this.data.macros = d.macros;
        this.data.ruoli = d.ruoli;
        this.data.fasi = d.fasi;
    },

    setupTabs: function() {
        document.querySelectorAll('.tab').forEach(t => {
            t.addEventListener('click', () => {
                document.querySelectorAll('.tab, .tab-content').forEach(el => el.classList.remove('active'));
                t.classList.add('active');
                document.getElementById(t.dataset.target).classList.add('active');
            });
        });
    },

    // --- MACRO ---
    renderMacros: function() {
        const tbody = document.querySelector('#macrosTable tbody');
        tbody.innerHTML = this.data.macros.map(m => `
            <tr>
                <td>${m.id_macro_categoria}</td>
                <td>${m.nome}</td>
                <td>${m.icona || ''}</td>
                <td>-</td>
            </tr>
        `).join('');
    },

    addMacro: async function() {
        const nome = document.getElementById('newMacroName').value;
        const icona = document.getElementById('newMacroIcon').value;
        if(!nome) return alert("Nome obbligatorio");
        
        await apiFetch('/api/admin/macro', { method: 'POST', body: JSON.stringify({ nome, icona }) });
        await this.loadRefData();
        this.renderMacros();
        document.getElementById('newMacroName').value = '';
    },

    // --- COMPONENTI ---

    // 1. Aggiungi Nuovo Componente
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
            
            // Pulisci e ricarica
            document.getElementById('newCompName').value = '';
            document.getElementById('newCompCode').value = '';
            
            // Ricarica la pagina 1 (dove appaiono i nuovi se ordinati per ID desc)
            this.loadComponents(1); 
            
        } catch (error) {
            alert("Errore creazione: " + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "+ Aggiungi Componente";
        }
    },

    // 2. Carica e Renderizza (Modificato per Editing Inline)
    loadComponents: async function(page) {
        this.data.componentiPage = page;
        document.getElementById('compPageIndicator').innerText = `Pagina ${page}`;
        
        const res = await apiFetch(`/api/admin/componenti?page=${page}`);
        const { data } = await res.json();
        const tbody = document.querySelector('#componentsTable tbody');
        tbody.innerHTML = '';

        data.forEach(comp => {
            const tr = document.createElement('tr');
            
            // NOTA: Qui inseriamo input text invece di testo statico
            tr.innerHTML = `
                <td>
                    <input type="text" class="edit-name" value="${comp.nome_componente || ''}" style="width: 100%; margin-bottom: 5px; font-weight:bold;">
                    <input type="text" class="edit-code" value="${comp.codice_componente || ''}" placeholder="Codice" style="width: 100%; font-size: 0.8em; color: #666;">
                </td>
                <td><select class="choice-macro" multiple></select></td>
                <td><select class="choice-ruoli" multiple></select></td>
                <td><select class="choice-fasi" multiple></select></td>
                <td><button class="action-btn save-btn">💾 Salva</button></td>
            `;
            tbody.appendChild(tr);

            // Init Choices (come prima)
            const macroSelect = new Choices(tr.querySelector('.choice-macro'), { removeItemButton: true, itemSelectText: '' });
            const ruoliSelect = new Choices(tr.querySelector('.choice-ruoli'), { removeItemButton: true, itemSelectText: '' });
            const fasiSelect  = new Choices(tr.querySelector('.choice-fasi'), { removeItemButton: true, itemSelectText: '' });

            // Popola Opzioni (come prima)
            macroSelect.setChoices(this.data.macros.map(m => ({ value: m.id_macro_categoria, label: m.nome, selected: (comp.ids_macro_categorie || []).includes(m.id_macro_categoria) })), 'value', 'label', false);
            ruoliSelect.setChoices(this.data.ruoli.map(r => ({ value: r.id_ruolo, label: r.nome_ruolo, selected: (comp.ids_ruoli_abilitati || []).includes(r.id_ruolo) })), 'value', 'label', false);
            fasiSelect.setChoices(this.data.fasi.map(f => ({ value: f.id_fase, label: f.nome_fase, selected: (comp.ids_fasi_abilitate || []).includes(f.id_fase) })), 'value', 'label', false);

            // LOGICA SALVATAGGIO (Aggiornata)
            tr.querySelector('.save-btn').addEventListener('click', async (e) => {
                const btn = e.target;
                const originalText = btn.textContent;
                btn.textContent = "⏳";
                btn.disabled = true;

                // Preleviamo anche il nome e il codice dagli input
                const newName = tr.querySelector('.edit-name').value;
                const newCode = tr.querySelector('.edit-code').value;

                const payload = {
                    nome_componente: newName,
                    codice_componente: newCode,
                    ids_macro_categorie: macroSelect.getValue(true),
                    ids_ruoli_abilitati: ruoliSelect.getValue(true),
                    ids_fasi_abilitate: fasiSelect.getValue(true)
                };

                try {
                    await apiFetch(`/api/admin/componenti/${comp.id_componente}`, { method: 'PUT', body: JSON.stringify(payload) });
                    
                    // Feedback visivo temporaneo
                    btn.textContent = "✅";
                    setTimeout(() => { 
                        btn.textContent = originalText; 
                        btn.disabled = false; 
                    }, 1000);
                    
                } catch (err) {
                    alert("Errore salvataggio: " + err.message);
                    btn.textContent = "❌";
                    btn.disabled = false;
                }
            });
        });
    },

    changeCompPage: function(delta) {
        const newPage = this.data.componentiPage + delta;
        if(newPage > 0) this.loadComponents(newPage);
    },

    // --- COMMESSE ---
    loadOrders: async function() {
        // Usa l'API esistente per leggere le commesse
        const res = await apiFetch('/api/commesse/view?limit=50&status=In Lavorazione'); 
        const { data } = await res.json();
        const tbody = document.querySelector('#ordersTable tbody');
        tbody.innerHTML = '';

        data.forEach(comm => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${comm.codice_commessa}<br><small>${comm.impianto}</small></td>
                <td><select class="choice-macro-comm" multiple></select></td>
                <td><button class="action-btn save-btn">💾</button></td>
            `;
            tbody.appendChild(tr);

            const macroSelect = new Choices(tr.querySelector('.choice-macro-comm'), { removeItemButton: true });
            
            // Popola Opzioni (usa ids_macro_categorie_attive)
            macroSelect.setChoices(this.data.macros.map(m => ({ 
                value: m.id_macro_categoria, 
                label: m.nome, 
                selected: (comm.ids_macro_categorie_attive || []).includes(m.id_macro_categoria) 
            })), 'value', 'label', false);

            tr.querySelector('.save-btn').addEventListener('click', async () => {
                const payload = {
                    ids_macro_categorie_attive: macroSelect.getValue(true)
                };
                await apiFetch(`/api/admin/commesse/${comm.id_commessa}`, { method: 'PUT', body: JSON.stringify(payload) });
                alert("Commessa Aggiornata!");
            });
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});