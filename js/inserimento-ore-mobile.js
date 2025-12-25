// js/inserimento-ore-mobile.js - Versione UI/UX Refactored

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';

const MobileHoursApp = {
    state: {
        offset: 0,
        limit: 14,
        isLoading: false,
        isListFinished: false,
        currentDate: null,
        
        currentOptionsTree: [], // Cache delle opzioni (Macro/Componenti)
        choicesInstance: null,  // Istanza Choices.js
        editingId: null         // ID se siamo in modifica
    },

    dom: {
        timelineContainer: document.getElementById('mobileTimelineContainer'),
        dayDetailModal: document.getElementById('dayDetailModal'),
        
        // Form & Inputs
        form: document.getElementById('mobileHoursForm'),
        typeRadios: document.querySelectorAll('input[name="entryType"]'),
        
        commessaSelect: document.getElementById('mobileCommessaSelect'),
        macroSelect: document.getElementById('mobileMacroSelect'),
        componentSelect: document.getElementById('mobileComponentSelect'),
        absenceSelect: document.getElementById('mobileAbsenceType'),
        
        startTime: document.getElementById('startTime'),
        endTime: document.getElementById('endTime'),
        hoursInput: document.getElementById('mobileHoursInput'),
        noteInput: document.getElementById('mobileNoteInput'),
        
        // Sections
        groupCommessa: document.getElementById('group-commessa'),
        prodFields: document.getElementById('production-fields'),
        absFields: document.getElementById('absence-fields'),
        
        // Lists & Buttons
        existingList: document.getElementById('existingWorksList'),
        saveBtn: document.getElementById('saveHoursBtn'),
        cancelEditBtn: document.getElementById('cancelEditBtn'),
        closeDetailBtn: document.getElementById('closeDetailBtn')
    },

    init: function() {
        console.log("🚀 Mobile App Init - UX/UI Refactored");
        this.loadUserName();
        this.loadTimelineBatch();
        
        // Inizializza Choices.js per la commessa
        this.initChoices();
        
        // Event Listeners
        this.dom.timelineContainer.addEventListener('scroll', () => this.handleScroll());
        this.dom.closeDetailBtn.addEventListener('click', () => this.closeDetail());
        
        // Toggle Tipo Inserimento (Produzione / Cantiere / Assenza)
        this.dom.typeRadios.forEach(r => r.addEventListener('change', (e) => this.handleTypeChange(e.target.value)));

        // Logica Cascata (Solo se produzione)
        this.dom.macroSelect.addEventListener('change', (e) => this.renderComponentOptions(e.target.value));

        // Calcolatore Orari
        this.dom.startTime.addEventListener('change', () => this.calcHours());
        this.dom.endTime.addEventListener('change', () => this.calcHours());
        
        // Salva / Annulla
        this.dom.saveBtn.addEventListener('click', (e) => this.handleSave(e));
        this.dom.cancelEditBtn.addEventListener('click', () => this.resetFormState());
    },

    loadUserName: function() {
        try {
            const p = JSON.parse(localStorage.getItem('user_profile') || '{}');
            if (p.nome_cognome) document.getElementById('headerUserName').textContent = p.nome_cognome;
        } catch(e) {}
    },

    // --- TIMELINE (Invariata nella logica, solo render) ---
    loadTimelineBatch: async function() {
        if (this.state.isLoading || this.state.isListFinished) return;
        this.state.isLoading = true;
        try {
            const res = await apiFetch(`/api/ore/timeline?offset=${this.state.offset}&limit=${this.state.limit}`);
            const days = await res.json();
            
            document.querySelector('.loader-placeholder')?.remove();
            
            if (days.length === 0) {
                this.state.isListFinished = true;
                return;
            }
            const todayStr = new Date().toISOString().split('T')[0];
            days.forEach(day => this.dom.timelineContainer.appendChild(this.createDayRow(day, todayStr)));
            
            this.state.offset += this.state.limit;
        } catch (e) { console.error(e); } 
        finally { this.state.isLoading = false; }
    },

    createDayRow: function(day, todayStr) {
        const div = document.createElement('div');
        div.className = `timeline-row ${day.full_date === todayStr ? 'is-today' : ''}`;
        div.innerHTML = `
            <div class="timeline-status-bar status-${day.status}"></div>
            <div class="timeline-content">
                <div class="date-info">
                    <div class="day-text">${day.weekday}</div>
                    <div class="day-number">${day.day_num} ${day.month_str}</div>
                </div>
                <div class="timeline-hours">${day.total_hours}h</div>
            </div>
        `;
        div.addEventListener('click', () => this.openDayDetail(day));
        return div;
    },

    handleScroll: function() {
        const c = this.dom.timelineContainer;
        if (c.scrollTop + c.clientHeight >= c.scrollHeight - 50) this.loadTimelineBatch();
    },

    // --- DETTAGLIO GIORNO ---
    openDayDetail: function(day) {
        this.state.currentDate = day.full_date;
        document.getElementById('selectedDayTitle').textContent = `${day.weekday} ${day.day_num} ${day.month_str}`;
        document.getElementById('detailUserName').textContent = document.getElementById('headerUserName').textContent;
        
        this.dom.dayDetailModal.style.display = 'flex';
        this.resetFormState();
        this.loadExistingWorks(day.full_date);
    },

    closeDetail: function() {
        this.dom.dayDetailModal.style.display = 'none';
        // Refresh Timeline
        this.dom.timelineContainer.innerHTML = '';
        this.state.offset = 0;
        this.state.isListFinished = false;
        this.loadTimelineBatch();
    },

    // --- CARICAMENTO CARD ATTIVITÀ ---
    loadExistingWorks: async function(dateStr) {
        this.dom.existingList.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">Caricamento...</div>';
        try {
            const res = await apiFetch(`/api/ore/day/${dateStr}`);
            const works = await res.json();
            this.dom.existingList.innerHTML = '';

            if (works.length === 0) {
                this.dom.existingList.innerHTML = '<div style="text-align:center; padding:10px; color:#999;">Nessuna attività registrata.</div>';
                return;
            }

            works.forEach(w => {
                // Determina Stile Card in base al contenuto
                let cardClass = 'card-prod'; // Default Blu
                let title = w.commesse ? `${w.commesse.codice_commessa || ''} ${w.commesse.impianto}` : 'N/D';
                let sub = w.componenti?.nome_componente || 'Attività generica';
                
                // Euristica per capire il tipo (se non salvato esplicitamente)
                if (sub.toLowerCase().includes('ferie') || sub.toLowerCase().includes('permesso') || sub.toLowerCase().includes('malattia')) {
                    cardClass = 'card-abs'; // Arancio
                    title = 'Assenza';
                } else if (title.toLowerCase().includes('cantiere') || sub.toLowerCase().includes('cantiere')) {
                    cardClass = 'card-site'; // Viola
                }

                const card = document.createElement('div');
                card.className = `activity-card ${cardClass}`;
                card.innerHTML = `
                    <div class="card-info">
                        <h5>${title}</h5>
                        <p>${sub} ${w.componenti?.codice_componente ? `(${w.componenti.codice_componente})` : ''}</p>
                        ${w.note ? `<span class="card-meta">Note: ${w.note}</span>` : ''}
                    </div>
                    <div class="card-right">
                        <div class="card-hours">${w.ore}h</div>
                        <div class="card-actions">
                            <button class="action-icon btn-edit">✏️</button>
                            <button class="action-icon btn-delete" style="color:#e53e3e;">🗑️</button>
                        </div>
                    </div>
                `;

                card.querySelector('.btn-edit').addEventListener('click', () => this.startEdit(w));
                card.querySelector('.btn-delete').addEventListener('click', () => this.deleteWork(w.id_registrazione));
                this.dom.existingList.appendChild(card);
            });

        } catch (e) { console.error(e); }
    },

    // --- CHOICES.JS & COMMESSE ---
    initChoices: async function() {
        this.state.choicesInstance = new Choices(this.dom.commessaSelect, {
            searchEnabled: true,
            itemSelectText: '',
            placeholder: true,
            placeholderValue: 'Cerca Commessa...',
            shouldSort: false,
            position: 'bottom'
        });

        // Carica dati
        try {
            const res = await apiFetch('/api/common/get-etichette');
            const data = await res.json();
            const choicesData = data.map(c => ({ value: c.id, label: c.label }));
            this.state.choicesInstance.setChoices(choicesData, 'value', 'label', true);
        } catch (e) { console.error("Err commesse", e); }

        // Listener Cascata
        this.dom.commessaSelect.addEventListener('change', (e) => {
            if (e.target.value) this.loadSmartOptions(e.target.value);
        });
    },

    loadSmartOptions: async function(commessaId) {
        this.dom.macroSelect.innerHTML = '<option>Caricamento...</option>';
        this.dom.macroSelect.disabled = true;
        this.dom.componentSelect.innerHTML = '<option disabled selected>--</option>';
        this.dom.componentSelect.disabled = true;

        try {
            const res = await apiFetch(`/api/ore/options?id_commessa=${commessaId}`);
            const tree = await res.json();
            this.state.currentOptionsTree = tree;

            let html = '<option value="" disabled selected>Seleziona Reparto...</option>';
            tree.forEach(m => {
                html += `<option value="${m.id_macro}">${m.icona || ''} ${m.nome_macro}</option>`;
            });
            this.dom.macroSelect.innerHTML = html;
            this.dom.macroSelect.disabled = false;
        } catch (e) {
            this.dom.macroSelect.innerHTML = '<option disabled>Errore</option>';
        }
    },

    renderComponentOptions: function(macroId) {
        const macro = this.state.currentOptionsTree.find(m => m.id_macro == macroId);
        if (!macro || !macro.componenti) return;

        let html = '<option value="" disabled selected>Seleziona Lavorazione...</option>';
        macro.componenti.forEach(c => {
            html += `<option value="${c.id}">${c.nome} ${c.codice ? `(${c.codice})` : ''}</option>`;
        });
        this.dom.componentSelect.innerHTML = html;
        this.dom.componentSelect.disabled = false;
    },

    // --- LOGICA UI (Toggle, Calcolo, Edit) ---
    handleTypeChange: function(type) {
        // Reset visuale
        this.dom.prodFields.style.display = 'none';
        this.dom.absFields.style.display = 'none';
        this.dom.groupCommessa.style.display = 'block';

        if (type === 'produzione') {
            this.dom.prodFields.style.display = 'block';
        } else if (type === 'cantiere') {
            // Cantiere usa solo commessa + note (per ora)
        } else if (type === 'assenza') {
            this.dom.groupCommessa.style.display = 'none';
            this.dom.absFields.style.display = 'block';
        }
    },

    calcHours: function() {
        const start = this.dom.startTime.value;
        const end = this.dom.endTime.value;
        if (start && end) {
            const d1 = new Date(`1970-01-01T${start}Z`);
            const d2 = new Date(`1970-01-01T${end}Z`);
            let diff = (d2 - d1) / (1000 * 60 * 60);
            if (diff < 0) diff += 24; // Notte
            // Arrotonda a 0.5
            const rounded = (Math.round(diff * 2) / 2).toFixed(1);
            this.dom.hoursInput.value = rounded;
        }
    },

    startEdit: async function(work) {
        this.state.editingId = work.id_registrazione;
        this.dom.saveBtn.textContent = "AGGIORNA";
        this.dom.saveBtn.style.backgroundColor = "#e67e22"; 
        this.dom.cancelEditBtn.style.display = 'block';

        // Scroll al form
        document.querySelector('.mobile-insert-form').scrollIntoView({ behavior: 'smooth' });

        // Capire il tipo
        let type = 'produzione';
        const sub = (work.componenti?.nome_componente || '').toLowerCase();
        if (sub.includes('ferie') || sub.includes('permesso') || sub.includes('malattia')) type = 'assenza';
        else if (sub.includes('cantiere')) type = 'cantiere';

        // Setta Radio
        document.querySelector(`input[value="${type}"]`).checked = true;
        this.handleTypeChange(type);

        // Popola Campi
        this.dom.hoursInput.value = work.ore;
        this.dom.noteInput.value = work.note || '';

        if (type === 'produzione' || type === 'cantiere') {
            if (work.id_commessa_fk) {
                this.state.choicesInstance.setChoiceByValue(work.id_commessa_fk);
                // Aspetta caricamento macro per settare i select a cascata
                if (type === 'produzione') {
                    await this.loadSmartOptions(work.id_commessa_fk);
                    if (work.id_componente_fk) {
                        // Trova la macro padre
                        const macro = this.state.currentOptionsTree.find(m => m.componenti.some(c => c.id == work.id_componente_fk));
                        if (macro) {
                            this.dom.macroSelect.value = macro.id_macro;
                            this.renderComponentOptions(macro.id_macro);
                            this.dom.componentSelect.value = work.id_componente_fk;
                        }
                    }
                }
            }
        } else if (type === 'assenza') {
            // Cerca di mappare il componente in una delle opzioni del select
            // (Assumendo che il backend restituisca il nome in 'componenti.nome_componente')
            // Se non c'è corrispondenza esatta, useremo un fallback
            // Nota: Qui servirebbe una logica più robusta con ID fissi per le assenze.
            // Per ora proviamo a matchare il testo.
            // TODO: Implementare mappatura ID Assenze
        }
    },

    resetFormState: function() {
        this.state.editingId = null;
        this.dom.form.reset();
        this.state.choicesInstance.removeActiveItems();
        this.dom.macroSelect.innerHTML = '<option disabled selected>--</option>';
        this.dom.componentSelect.innerHTML = '<option disabled selected>--</option>';
        this.dom.componentSelect.disabled = true;
        this.dom.macroSelect.disabled = true;
        
        this.dom.saveBtn.textContent = "AGGIUNGI ORE";
        this.dom.saveBtn.style.backgroundColor = "";
        this.dom.cancelEditBtn.style.display = 'none';
        
        // Reset Tipo a Produzione
        document.querySelector('input[value="produzione"]').checked = true;
        this.handleTypeChange('produzione');
    },

    handleSave: async function(e) {
        e.preventDefault();
        const type = document.querySelector('input[name="entryType"]:checked').value;
        const btn = this.dom.saveBtn;
        
        // Validazione base
        if (!this.dom.hoursInput.value) return alert("Inserire le ore");

        // Costruzione Payload
        const payload = {
            data: this.state.currentDate,
            ore: this.dom.hoursInput.value,
            note: this.dom.noteInput.value
        };

        if (type === 'produzione') {
            payload.id_commessa = this.state.choicesInstance.getValue(true);
            payload.id_componente = this.dom.componentSelect.value;
            if (!payload.id_commessa || !payload.id_componente) return alert("Seleziona Commessa, Reparto e Lavorazione");
        } 
        else if (type === 'cantiere') {
            payload.id_commessa = this.state.choicesInstance.getValue(true);
            // Fallback: Se non abbiamo un ID componente "Cantiere", mettiamolo nelle note o usiamo un ID fisso se esiste
            // Per ora lo mandiamo senza componente (se il backend lo accetta) o useremo un trucco
            if (!payload.id_commessa) return alert("Seleziona Commessa");
            payload.note = `[CANTIERE] ${payload.note}`; 
            // TODO: Chiedi al backend l'ID del componente "Lavoro in Cantiere"
        }
        else if (type === 'assenza') {
            const absenceType = this.dom.absenceSelect.value;
            if (!absenceType) return alert("Seleziona il motivo dell'assenza");
            payload.note = `[${absenceType.toUpperCase()}] ${payload.note}`;
            // Anche qui, idealmente dovremmo mappare "Ferie" -> ID Componente X
            // Per ora usiamo una "Internal Commessa" se esiste, o lasciamo null se il backend lo permette
            // TODO: Gestire ID Assenza
        }

        btn.disabled = true;
        const isEdit = !!this.state.editingId;
        const url = isEdit ? `/api/ore/${this.state.editingId}` : '/api/ore/';
        // Per ora usiamo sempre POST/DELETE pattern se PUT non è implementato full
        // Ma proviamo a usare la logica standard
        
        try {
             // Se siamo in edit, potremmo dover fare PUT, ma per sicurezza (visto che il backend attuale ha POST e DELETE)
             // potremmo fare Delete old + Insert new, oppure se hai implementato PUT usalo.
             // Assumo POST per nuovo, DELETE+POST per edit (più sicuro senza cambiare backend ora)
             if (isEdit) {
                 await apiFetch(`/api/ore/${this.state.editingId}`, { method: 'DELETE' });
             }
             
             await apiFetch('/api/ore/', { method: 'POST', body: JSON.stringify(payload) });
             
             this.loadExistingWorks(this.state.currentDate);
             this.resetFormState();
             showModal({title: 'Successo', message: 'Dati salvati correttamente', confirmText:'OK'});
        } catch (err) {
            alert("Errore salvataggio: " + err.message);
        } finally {
            btn.disabled = false;
        }
    },

    deleteWork: async function(id) {
        if (!confirm("Eliminare questa registrazione?")) return;
        try {
            await apiFetch(`/api/ore/${id}`, { method: 'DELETE' });
            this.loadExistingWorks(this.state.currentDate);
        } catch (e) { alert("Errore: " + e.message); }
    }
};

document.addEventListener('DOMContentLoaded', () => { MobileHoursApp.init(); });