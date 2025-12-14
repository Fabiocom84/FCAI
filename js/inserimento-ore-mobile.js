// js/inserimento-ore-mobile.js

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';

const MobileHoursApp = {
    state: {
        offset: 0,
        limit: 30,
        isLoading: false,
        isListFinished: false,
        currentDate: null,
        
        // Cache per l'albero delle opzioni (Macro -> Componenti)
        currentOptionsTree: [] 
    },

    dom: {
        timelineContainer: document.getElementById('mobileTimelineContainer'),
        dayDetailModal: document.getElementById('dayDetailModal'),
        
        // Form Elements
        commessaSelect: document.getElementById('mobileCommessaSelect'),
        macroSelect: document.getElementById('mobileMacroSelect'),       // NUOVO
        componentSelect: document.getElementById('mobileComponentSelect'), // EX Activity
        hoursInput: document.getElementById('mobileHoursInput'),
        noteInput: document.getElementById('mobileNoteInput'),
        form: document.getElementById('mobileHoursForm'),
        existingList: document.getElementById('existingWorksList'),
        
        // Nav
        closeDetailBtn: document.getElementById('closeDetailBtn')
    },

    init: function() {
        console.log("Mobile Hours App Started v3 (Hierarchical)");

        this.loadUserName();
        this.loadTimelineBatch();
        this.loadCommesseList();

        // Listeners
        this.dom.timelineContainer.addEventListener('scroll', () => this.handleScroll());
        this.dom.closeDetailBtn.addEventListener('click', () => this.closeDetail());
        
        // --- LOGICA A CASCATA (Cascading Dropdowns) ---
        
        // 1. Cambio Commessa -> Carica Macro Categorie
        this.dom.commessaSelect.addEventListener('change', (e) => this.loadSmartOptions(e.target.value));
        
        // 2. Cambio Macro -> Popola Componenti (dal cache locale)
        this.dom.macroSelect.addEventListener('change', (e) => this.renderComponentOptions(e.target.value));
        
        // Submit
        this.dom.form.addEventListener('submit', (e) => this.handleSave(e));
    },

    loadUserName: function() {
        try {
            const storedProfile = localStorage.getItem('user_profile');
            if (storedProfile) {
                const profile = JSON.parse(storedProfile);
                const nameEl = document.getElementById('headerUserName');
                if (nameEl && profile.nome_cognome) {
                    nameEl.textContent = profile.nome_cognome;
                }
            }
        } catch (e) { console.error(e); }
    },

    // --- TIMELINE (Invariata) ---
    loadTimelineBatch: async function() {
        if (this.state.isLoading || this.state.isListFinished) return;
        this.state.isLoading = true;

        try {
            const res = await apiFetch(`/api/ore/timeline?offset=${this.state.offset}&limit=${this.state.limit}`);
            const days = await res.json();

            const loader = this.dom.timelineContainer.querySelector('.loader-placeholder');
            if (loader) loader.remove();

            if (days.length === 0) {
                this.state.isListFinished = true;
                return;
            }

            const todayStr = new Date().toISOString().split('T')[0];
            days.forEach(day => {
                const row = this.createDayRow(day, todayStr);
                this.dom.timelineContainer.appendChild(row);
            });

            this.state.offset += this.state.limit;
            if (this.state.offset === this.state.limit) {
                setTimeout(() => this.scrollToToday(), 100);
            }
        } catch (error) {
            console.error("Timeline Error:", error);
        } finally {
            this.state.isLoading = false;
        }
    },

    createDayRow: function(day, todayStr) {
        const div = document.createElement('div');
        div.className = 'timeline-row';
        div.dataset.date = day.full_date;
        div.onclick = () => this.openDayDetail(day);

        if (day.full_date === todayStr) {
            div.classList.add('is-today');
            div.id = "row-today";
        }

        div.innerHTML = `
            <div class="timeline-status-bar status-${day.status}"></div>
            <div class="timeline-content">
                <div class="timeline-date">
                    <span class="day-text">${day.weekday}</span>
                    <span class="day-number">${day.day_num} ${day.month_str}</span>
                </div>
                <div class="timeline-hours">${day.total_hours}h</div>
            </div>
        `;
        return div;
    },

    scrollToToday: function() {
        const todayRow = document.getElementById('row-today');
        if (todayRow) todayRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    handleScroll: function() {
        const c = this.dom.timelineContainer;
        if (c.scrollTop + c.clientHeight >= c.scrollHeight - 100) {
            this.loadTimelineBatch();
        }
    },

    // --- DETTAGLIO GIORNO ---
    openDayDetail: function(day) {
        this.state.currentDate = day.full_date;
        this.dom.dayDetailModal.style.display = 'flex';
        document.getElementById('selectedDayTitle').textContent = `${day.weekday} ${day.day_num} ${day.month_str}`;
        
        // Reset Form
        this.dom.form.reset();
        
        // Reset Selects a Cascata
        this.dom.macroSelect.innerHTML = '<option value="" disabled selected>-- Seleziona prima Commessa --</option>';
        this.dom.macroSelect.disabled = true;
        this.dom.componentSelect.innerHTML = '<option value="" disabled selected>-- Seleziona prima Reparto --</option>';
        this.dom.componentSelect.disabled = true;

        this.loadExistingWorks(day.full_date);
    },

    closeDetail: function() {
        this.dom.dayDetailModal.style.display = 'none';
        this.dom.timelineContainer.innerHTML = '';
        this.state.offset = 0;
        this.state.isListFinished = false;
        this.loadTimelineBatch();
    },

    // --- LOGICA LISTA LAVORI ESISTENTI (Aggiornata per Componenti) ---
    loadExistingWorks: async function(dateStr) {
        this.dom.existingList.innerHTML = '<div style="padding:10px; text-align:center; color:#999;">Caricamento...</div>';
        try {
            const res = await apiFetch(`/api/ore/day/${dateStr}`);
            const works = await res.json();
            
            this.dom.existingList.innerHTML = '';
            if (works.length === 0) {
                this.dom.existingList.innerHTML = '<div style="padding:10px; text-align:center; color:#999;">Nessuna attività registrata.</div>';
                return;
            }

            works.forEach(w => {
                const div = document.createElement('div');
                div.className = 'work-item';
                
                // Nota: w.componenti?.nome_componente viene dalla nuova query backend
                const componenteNome = w.componenti?.nome_componente || w.catalogo_attivita?.descrizione || '???';
                const codiceComp = w.componenti?.codice_componente ? `(${w.componenti.codice_componente})` : '';

                div.innerHTML = `
                    <div class="work-info">
                        <strong>${w.commesse?.impianto || 'Commessa ???'}</strong>
                        <span>${componenteNome} ${codiceComp}</span>
                        ${w.note ? `<div class="note">${w.note}</div>` : ''}
                    </div>
                    <div class="work-actions">
                        <span class="work-hours-badge">${w.ore}h</span>
                        <button class="delete-btn" data-id="${w.id_registrazione}">🗑</button>
                    </div>
                `;
                div.querySelector('.delete-btn').addEventListener('click', () => this.deleteWork(w.id_registrazione));
                this.dom.existingList.appendChild(div);
            });

        } catch (e) {
            console.error(e);
            this.dom.existingList.innerHTML = 'Errore caricamento dati.';
        }
    },

    // --- GESTIONE DROPDOWN ---
    loadCommesseList: async function() {
        try {
            const res = await apiFetch('/api/commesse/view?status=In Lavorazione&limit=100');
            const data = await res.json();
            let html = '<option value="" disabled selected>Seleziona Commessa...</option>';
            data.data.forEach(c => {
                html += `<option value="${c.id_commessa}">${c.codice_commessa} ${c.impianto}</option>`;
            });
            this.dom.commessaSelect.innerHTML = html;
        } catch (e) { console.error("Error loading commesse", e); }
    },

    // 1. Carica l'albero completo Macro -> Componenti dal Backend
    loadSmartOptions: async function(commessaId) {
        this.dom.macroSelect.innerHTML = '<option>Caricamento...</option>';
        this.dom.macroSelect.disabled = true;
        this.dom.componentSelect.innerHTML = '<option value="" disabled selected>-- Seleziona prima Reparto --</option>';
        this.dom.componentSelect.disabled = true;
        
        try {
            const res = await apiFetch(`/api/ore/options?id_commessa=${commessaId}`);
            const tree = await res.json();
            
            this.state.currentOptionsTree = tree; // Salviamo in stato per usarlo dopo
            
            if (tree.length === 0) {
                this.dom.macroSelect.innerHTML = '<option disabled>Nessun reparto disponibile</option>';
                return;
            }

            let html = '<option value="" disabled selected>Seleziona Reparto...</option>';
            tree.forEach(macro => {
                // macro.icona è opzionale, se c'è la mostriamo
                const icon = macro.icona ? `${macro.icona} ` : '';
                html += `<option value="${macro.id_macro}">${icon}${macro.nome_macro}</option>`;
            });
            
            this.dom.macroSelect.innerHTML = html;
            this.dom.macroSelect.disabled = false;

        } catch (e) { 
            console.error(e);
            this.dom.macroSelect.innerHTML = '<option disabled>Errore caricamento</option>';
        }
    },

    // 2. Renderizza i componenti in base alla Macro selezionata (senza chiamare il server)
    renderComponentOptions: function(macroId) {
        // Trova la macro selezionata nell'albero in memoria
        // Nota: macroId dal value è stringa, id_macro nel JSON è numero
        const selectedMacro = this.state.currentOptionsTree.find(m => m.id_macro == macroId);
        
        if (!selectedMacro || !selectedMacro.componenti || selectedMacro.componenti.length === 0) {
            this.dom.componentSelect.innerHTML = '<option disabled>Nessun componente</option>';
            this.dom.componentSelect.disabled = true;
            return;
        }

        let html = '<option value="" disabled selected>Seleziona Lavorazione...</option>';
        selectedMacro.componenti.forEach(comp => {
            html += `<option value="${comp.id}">${comp.nome} ${comp.codice ? '('+comp.codice+')' : ''}</option>`;
        });
        
        this.dom.componentSelect.innerHTML = html;
        this.dom.componentSelect.disabled = false;
    },

    // --- SALVATAGGIO ---
    handleSave: async function(e) {
        e.preventDefault();
        const btn = this.dom.form.querySelector('button');
        btn.disabled = true; btn.textContent = 'Salvataggio...';

        const payload = {
            data: this.state.currentDate,
            id_commessa: this.dom.commessaSelect.value,
            id_componente: this.dom.componentSelect.value, // Ora inviamo il componente!
            ore: this.dom.hoursInput.value,
            note: this.dom.noteInput.value
        };

        try {
            const res = await apiFetch('/api/ore/', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Errore Salvataggio");

            // Reset parziale per inserimento rapido
            this.dom.hoursInput.value = '';
            this.dom.noteInput.value = '';
            // Non resettiamo commessa/macro per facilitare inserimenti consecutivi
            
            await this.loadExistingWorks(this.state.currentDate);
            
        } catch (error) {
            showModal({ title: 'Errore', message: error.message, confirmText: 'OK' });
        } finally {
            btn.disabled = false; btn.textContent = 'AGGIUNGI ORE';
        }
    },

    deleteWork: async function(id) {
        if(!confirm("Eliminare?")) return;
        try {
            await apiFetch(`/api/ore/${id}`, { method: 'DELETE' });
            this.loadExistingWorks(this.state.currentDate);
        } catch(e) { alert("Errore cancellazione"); }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    MobileHoursApp.init();
});