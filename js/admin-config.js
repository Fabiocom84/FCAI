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

    // 2. Carica e Renderizza (Versione Robusta v2)
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
                
                // Usiamo classi, NON ID, per evitare conflitti
                tr.innerHTML = `
                    <td style="vertical-align: top;">
                        <input type="text" class="edit-name" value="${comp.nome_componente || ''}" style="width: 100%; margin-bottom: 5px; font-weight:bold;">
                        <input type="text" class="edit-code" value="${comp.codice_componente || ''}" placeholder="Codice" style="width: 100%; font-size: 0.8em; color: #666;">
                    </td>
                    <td style="vertical-align: top;"><select class="choice-macro" multiple></select></td>
                    <td style="vertical-align: top;"><select class="choice-ruoli" multiple></select></td>
                    <td style="vertical-align: top;"><select class="choice-fasi" multiple></select></td>
                    <td style="vertical-align: top; text-align: center;">
                        <button class="action-btn save-btn" data-id="${comp.id_componente}">💾</button>
                    </td>
                `;
                tbody.appendChild(tr);

                // --- INIZIALIZZAZIONE CHOICES ---
                // Nota: Configuriamo position: 'bottom' per evitare problemi di layout
                const choicesConfig = { removeItemButton: true, itemSelectText: '', position: 'bottom', shouldSort: false };
                
                const macroSelect = new Choices(tr.querySelector('.choice-macro'), choicesConfig);
                const ruoliSelect = new Choices(tr.querySelector('.choice-ruoli'), choicesConfig);
                const fasiSelect  = new Choices(tr.querySelector('.choice-fasi'), choicesConfig);

                // --- POPOLAMENTO DATI ---
                // Helper per mappare i dati
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

                // --- GESTIONE SALVATAGGIO ---
                const saveBtn = tr.querySelector('.save-btn');
                
                saveBtn.addEventListener('click', async (e) => {
                    // Usa currentTarget per essere sicuri di prendere il bottone e non l'icona interna
                    const btn = e.currentTarget; 
                    const compId = btn.dataset.id;
                    
                    console.log(`Tentativo di salvataggio per componente ID: ${compId}`);

                    btn.textContent = "⏳";
                    btn.disabled = true;

                    // Leggiamo i valori ATTUALI dagli input e dai menu
                    const newName = tr.querySelector('.edit-name').value;
                    const newCode = tr.querySelector('.edit-code').value;
                    const valMacros = macroSelect.getValue(true);
                    const valRuoli = ruoliSelect.getValue(true);
                    const valFasi = fasiSelect.getValue(true);

                    // Debug payload
                    const payload = {
                        nome_componente: newName,
                        codice_componente: newCode,
                        ids_macro_categorie: valMacros,
                        ids_ruoli_abilitati: valRuoli,
                        ids_fasi_abilitate: valFasi
                    };
                    console.log("Payload inviato:", payload);

                    try {
                        const response = await apiFetch(`/api/admin/componenti/${compId}`, { 
                            method: 'PUT', 
                            body: JSON.stringify(payload) 
                        });

                        if (!response.ok) throw new Error("Errore API");
                        
                        btn.textContent = "✅";
                        setTimeout(() => { 
                            btn.textContent = "💾"; 
                            btn.disabled = false; 
                        }, 1000);
                        
                    } catch (err) {
                        console.error(err);
                        alert("Errore salvataggio: " + err.message);
                        btn.textContent = "❌";
                        btn.disabled = false;
                    }
                });
            });
        } catch (error) {
            console.error("Errore caricamento componenti:", error);
            alert("Impossibile caricare i componenti.");
        }
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