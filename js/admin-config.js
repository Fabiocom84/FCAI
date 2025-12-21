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
        console.group("🚀 ADMIN CONFIG INIT");
        console.log("Controllo esistenza tabella #macrosTable...");
        
        const table = document.getElementById('macrosTable');
        if (!table) {
            console.error("❌ ERRORE CRITICO: Tabella #macrosTable non trovata nell'HTML.");
            return;
        }
        console.log("✅ Tabella trovata. Avvio caricamento dati...");

        try {
            await this.loadRefData();
            
            console.log("Avvio renderizzazione UI...");
            this.setupTabs();
            this.renderMacros();
            this.loadComponents(1);
            this.loadOrders();
            
            this.bindEvents();
            console.log("✅ Init completato senza errori bloccanti.");
        } catch (e) {
            console.error("❌ CRASH INIT:", e);
            alert("Errore Inizializzazione: " + e.message);
        }
        console.groupEnd();
    },

    bindEvents: function() {
        document.getElementById('addMacroBtn')?.addEventListener('click', () => this.addMacro());
        document.getElementById('prevCompPage')?.addEventListener('click', () => this.changeCompPage(-1));
        document.getElementById('nextCompPage')?.addEventListener('click', () => this.changeCompPage(1));
        document.getElementById('addCompBtn')?.addEventListener('click', () => this.addComponent());
    },

    // --- CARICAMENTO DATI (CON DEBUG) ---
    loadRefData: async function() {
        console.group("📡 LOAD REF DATA (/api/admin/init-data)");
        try {
            const res = await apiFetch('/api/admin/init-data');
            console.log("Status Risposta:", res.status);

            if (!res.ok) {
                const text = await res.text();
                console.error("❌ Errore Backend:", text);
                throw new Error(`API Error ${res.status}`);
            }
            
            const d = await res.json();
            console.log("📦 JSON Ricevuto dal Server:", d);

            // Controllo specifico per le macro
            if (!d.macros) console.warn("⚠️ Attenzione: Chiave 'macros' mancante nel JSON");
            else console.log(`Elementi Macro trovati: ${d.macros.length}`);

            this.data.macros = d.macros || [];
            this.data.ruoli = d.ruoli || [];
            this.data.fasi = d.fasi || [];
            
        } catch (e) {
            console.error("❌ Errore durante la fetch:", e);
            // Non blocchiamo tutto, ma lasciamo vuoto
            this.data.macros = [];
        }
        console.groupEnd();
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

    // --- MACRO (CON DEBUG NOMI COLONNE) ---
    renderMacros: function() {
        console.group("🎨 RENDER MACROS");
        const tbody = document.querySelector('#macrosTable tbody');
        if (!tbody) return;

        // Debug Dati
        console.log("Dati da renderizzare:", this.data.macros);

        if (this.data.macros.length === 0) {
            console.warn("Nessuna macro da mostrare.");
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Nessuna macro trovata (Array vuoto).</td></tr>';
            console.groupEnd();
            return;
        }

        // DEBUG: Stampa le chiavi del primo oggetto per capire come si chiamano le colonne
        const primoOggetto = this.data.macros[0];
        console.log("🔑 CHIAVI PRIMO OGGETTO:", Object.keys(primoOggetto));

        tbody.innerHTML = this.data.macros.map(m => {
            // Tenta tutte le combinazioni possibili
            const nome = m.nome_macro || m.nome || 'NOME MANCANTE';
            const icona = m.icona_macro || m.icona || '';
            const id = m.id_macro_categoria || m.id;

            return `
                <tr>
                    <td>${id}</td>
                    <td><strong>${nome}</strong></td>
                    <td style="font-size:1.5em;">${icona}</td>
                    <td><button class="action-btn" disabled>✏️</button></td>
                </tr>
            `;
        }).join('');
        console.log("Render completato.");
        console.groupEnd();
    },

    addMacro: async function() {
        const nome = document.getElementById('newMacroName').value;
        const icona = document.getElementById('newMacroIcon').value;
        if(!nome) return alert("Nome obbligatorio");
        
        console.log("Invio Nuova Macro:", { nome_macro: nome, icona_macro: icona });

        try {
            const res = await apiFetch('/api/admin/macro', { 
                method: 'POST', 
                body: JSON.stringify({ nome_macro: nome, icona_macro: icona }) 
            });
            
            if(!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Errore sconosciuto");
            }

            console.log("Macro aggiunta. Ricarico...");
            await this.loadRefData();
            this.renderMacros();
            document.getElementById('newMacroName').value = '';
            document.getElementById('newMacroIcon').value = '';
        } catch (e) {
            console.error(e);
            alert("Errore salvataggio: " + e.message);
        }
    },

    // --- SEZIONE 2: COMPONENTI ---

    addComponent: async function() {
        const nome = document.getElementById('newCompName').value;
        const codice = document.getElementById('newCompCode').value;
        
        if (!nome) return alert("Inserisci il nome del componente.");
        
        const btn = document.getElementById('addCompBtn');
        btn.disabled = true; btn.textContent = "⏳";

        try {
            await apiFetch('/api/admin/componenti', {
                method: 'POST',
                body: JSON.stringify({ nome_componente: nome, codice_componente: codice })
            });
            
            document.getElementById('newCompName').value = '';
            document.getElementById('newCompCode').value = '';
            this.loadComponents(1); 
        } catch (error) {
            alert("Errore: " + error.message);
        } finally {
            btn.disabled = false; btn.textContent = "+ Aggiungi Componente";
        }
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
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Nessun componente trovato.</td></tr>';
                return;
            }

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
                        <button class="action-btn save-btn" data-id="${comp.id_componente}" title="Salva">💾</button>
                    </td>
                `;
                tbody.appendChild(tr);

                // Config Choices
                const config = { removeItemButton: true, itemSelectText: '', position: 'bottom', shouldSort: false, searchEnabled: false };
                
                const macroSelect = new Choices(tr.querySelector('.choice-macro'), config);
                const ruoliSelect = new Choices(tr.querySelector('.choice-ruoli'), config);
                const fasiSelect  = new Choices(tr.querySelector('.choice-fasi'), config);

                // Helper Mappatura
                const mapOpts = (src, valK, lblK, selArr) => src.map(i => ({
                    value: i[valK], 
                    // Gestione fallback nomi colonne
                    label: i[lblK] || i.nome_macro || i.nome || '?', 
                    selected: (selArr || []).includes(i[valK])
                }));

                // Popolamento Select
                macroSelect.setChoices(mapOpts(this.data.macros, 'id_macro_categoria', 'nome_macro', comp.ids_macro_categorie), 'value', 'label', false);
                ruoliSelect.setChoices(mapOpts(this.data.ruoli, 'id_ruolo', 'nome_ruolo', comp.ids_ruoli_abilitati), 'value', 'label', false);
                fasiSelect.setChoices(mapOpts(this.data.fasi, 'id_fase', 'nome_fase', comp.ids_fasi_abilitate), 'value', 'label', false);

                // Salvataggio
                tr.querySelector('.save-btn').addEventListener('click', async (e) => {
                    const btn = e.currentTarget;
                    btn.textContent = "⏳";
                    btn.disabled = true;

                    // Payload con nomi colonne corretti per tabella 'componenti'
                    const payload = {
                        nome_componente: tr.querySelector('.edit-name').value,
                        codice_componente: tr.querySelector('.edit-code').value,
                        ids_macro_categorie: macroSelect.getValue(true),
                        ids_ruoli_abilitati: ruoliSelect.getValue(true),
                        ids_fasi_abilitate: fasiSelect.getValue(true)
                    };

                    try {
                        const response = await apiFetch(`/api/admin/componenti/${btn.dataset.id}`, { 
                            method: 'PUT', body: JSON.stringify(payload) 
                        });
                        
                        if (!response.ok) throw new Error("Errore Backend");
                        
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

    // --- SEZIONE 3: CONFIGURAZIONE COMMESSE ---
    loadOrders: async function() {
        try {
            // Usiamo l'API commesse esistente
            const res = await apiFetch('/api/commesse/view?limit=50&status=In Lavorazione'); 
            const json = await res.json();
            const data = json.data || [];
            
            const tbody = document.querySelector('#ordersTable tbody');
            tbody.innerHTML = '';

            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">Nessuna commessa attiva.</td></tr>';
                return;
            }

            data.forEach(comm => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <strong>${comm.impianto}</strong>
                        <br><small style="color:#666;">${comm.codice_commessa || 'CODICE N/D'}</small>
                    </td>
                    <td><select class="choice-macro-comm" multiple></select></td>
                    <td style="text-align: center;"><button class="action-btn save-btn">💾</button></td>
                `;
                tbody.appendChild(tr);

                const macroSelect = new Choices(tr.querySelector('.choice-macro-comm'), { removeItemButton: true, itemSelectText: '' });
                
                // Popolamento select con le macro esistenti
                macroSelect.setChoices(this.data.macros.map(m => ({ 
                    value: m.id_macro_categoria, 
                    label: m.nome_macro || m.nome, 
                    // Nota: il backend per le commesse usa 'ids_macro_categorie_attive'
                    selected: (comm.ids_macro_categorie_attive || []).includes(m.id_macro_categoria) 
                })), 'value', 'label', false);

                // Salvataggio Commessa
                tr.querySelector('.save-btn').addEventListener('click', async (e) => {
                    const btn = e.currentTarget;
                    btn.textContent = "⏳";
                    
                    // Il backend admin_tools.py -> update_commessa_assoc si aspetta questa chiave specifica
                    const payload = { 
                        ids_macro_categorie_attive: macroSelect.getValue(true) 
                    };
                    
                    try {
                        await apiFetch(`/api/admin/commesse/${comm.id_commessa}`, { 
                            method: 'PUT', body: JSON.stringify(payload) 
                        });
                        btn.textContent = "✅";
                        setTimeout(() => btn.textContent = "💾", 1000);
                    } catch(err) {
                        alert("Errore: " + err.message);
                        btn.textContent = "❌";
                    }
                });
            });
        } catch(e) {
            console.error("Errore caricamento Commesse:", e);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});