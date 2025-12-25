import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';

const MobileHoursApp = {
    state: {
        offset: 0,
        limit: 14,
        isLoading: false,
        isListFinished: false,
        currentDate: null,
        
        currentOptionsTree: [], 
        choicesInstance: null,
        editingId: null,
        
        // NUOVO: Cache delle etichette commesse per visualizzazione corretta
        commesseMap: {} 
    },

    dom: {
        timelineContainer: document.getElementById('mobileTimelineContainer'),
        dayDetailModal: document.getElementById('dayDetailModal'),
        
        form: document.getElementById('mobileHoursForm'),
        typeRadios: document.querySelectorAll('input[name="entryType"]'),
        
        commessaSelect: document.getElementById('mobileCommessaSelect'),
        macroSelect: document.getElementById('mobileMacroSelect'),
        componentSelect: document.getElementById('mobileComponentSelect'),
        absenceSelect: document.getElementById('mobileAbsenceType'),
        
        // Rimosso startTime/endTime
        hoursInput: document.getElementById('mobileHoursInput'),
        noteInput: document.getElementById('mobileNoteInput'),
        
        groupCommessa: document.getElementById('group-commessa'),
        prodFields: document.getElementById('production-fields'),
        absFields: document.getElementById('absence-fields'),
        
        existingList: document.getElementById('existingWorksList'),
        saveBtn: document.getElementById('saveHoursBtn'),
        cancelEditBtn: document.getElementById('cancelEditBtn'),
        closeDetailBtn: document.getElementById('closeDetailBtn')
    },

    init: function() {
        console.log("🚀 Mobile App Init - Fix UI");
        this.loadUserName();
        this.loadTimelineBatch();
        
        // Init Choices
        this.initChoices();
        
        // Listeners
        this.dom.timelineContainer.addEventListener('scroll', () => this.handleScroll());
        this.dom.closeDetailBtn.addEventListener('click', () => this.closeDetail());
        
        this.dom.typeRadios.forEach(r => r.addEventListener('change', (e) => this.handleTypeChange(e.target.value)));
        this.dom.macroSelect.addEventListener('change', (e) => this.renderComponentOptions(e.target.value));

        this.dom.saveBtn.addEventListener('click', (e) => this.handleSave(e));
        this.dom.cancelEditBtn.addEventListener('click', () => this.resetFormState());
    },

    loadUserName: function() {
        try {
            const p = JSON.parse(localStorage.getItem('user_profile') || '{}');
            if (p.nome_cognome) document.getElementById('headerUserName').textContent = p.nome_cognome;
        } catch(e) {}
    },

    // --- TIMELINE ---
    loadTimelineBatch: async function() {
        if (this.state.isLoading || this.state.isListFinished) return;
        this.state.isLoading = true;
        try {
            const res = await apiFetch(`/api/ore/timeline?offset=${this.state.offset}&limit=${this.state.limit}`);
            const days = await res.json();
            document.querySelector('.loader-placeholder')?.remove();
            
            if (days.length === 0) { this.state.isListFinished = true; return; }
            
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
        this.dom.dayDetailModal.style.display = 'flex';
        this.resetFormState();
        this.loadExistingWorks(day.full_date);
    },

    closeDetail: function() {
        this.dom.dayDetailModal.style.display = 'none';
        this.dom.timelineContainer.innerHTML = '';
        this.state.offset = 0;
        this.state.isListFinished = false;
        this.loadTimelineBatch();
    },

    // --- CARDS ATTIVITÀ (CON ETICHETTE CORRETTE) ---
    loadExistingWorks: async function(dateStr) {
        this.dom.existingList.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">Caricamento...</div>';
        try {
            const res = await apiFetch(`/api/ore/day/${dateStr}`);
            const works = await res.json();
            this.dom.existingList.innerHTML = '';

            if (works.length === 0) {
                this.dom.existingList.innerHTML = '<div style="text-align:center; padding:10px; color:#999;">Nessuna attività.</div>';
                return;
            }

            works.forEach(w => {
                let cardClass = 'card-prod'; 
                
                // 1. RECUPERO TITOLO RICCO DALLA MAPPA LOCALE
                // Se l'ID commessa esiste nella nostra mappa caricata da Choices, usiamo quell'etichetta.
                // Altrimenti fallback sui dati grezzi della card.
                let title = 'N/D';
                if (w.id_commessa_fk && this.state.commesseMap[w.id_commessa_fk]) {
                    title = this.state.commesseMap[w.id_commessa_fk]; // Esempio: "Cliente | Impianto | VO"
                } else if (w.commesse) {
                    title = `${w.commesse.impianto} (${w.commesse.codice_commessa || ''})`;
                }

                let sub = w.componenti?.nome_componente || 'Attività generica';
                
                if (sub.toLowerCase().includes('ferie') || sub.toLowerCase().includes('permesso')) {
                    cardClass = 'card-abs'; 
                    title = 'Assenza'; // Override titolo per assenze
                } else if (title.toLowerCase().includes('cantiere') || sub.toLowerCase().includes('cantiere')) {
                    cardClass = 'card-site';
                }

                const card = document.createElement('div');
                card.className = `activity-card ${cardClass}`;
                card.innerHTML = `
                    <div class="card-info">
                        <h5>${title}</h5>
                        <p>${sub} ${w.componenti?.codice_componente ? `(${w.componenti.codice_componente})` : ''}</p>
                        ${w.note ? `<span class="card-meta">${w.note}</span>` : ''}
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

    // --- CHOICES.JS ---
    initChoices: async function() {
        // Distruggi istanza precedente se esiste (per evitare doppi menu)
        if (this.state.choicesInstance) {
            this.state.choicesInstance.destroy();
        }

        this.state.choicesInstance = new Choices(this.dom.commessaSelect, {
            searchEnabled: true,
            searchChoices: true,
            itemSelectText: '',
            placeholder: true,
            placeholderValue: 'Cerca Commessa...',
            shouldSort: false,
            position: 'bottom', // Forza apertura verso il basso
            renderChoiceLimit: 50, // Limita quanti elementi renderizza nel DOM
            searchResultLimit: 10, // Limita risultati ricerca
            // Queste opzioni aiutano a mantenere il layout compatto
            removeItemButton: false,
            duplicateItemsAllowed: false,
        });

        try {
            const res = await apiFetch('/api/get-etichette');
            const data = await res.json();
            
            this.state.commesseMap = {};
            const choicesData = data.map(c => {
                this.state.commesseMap[c.id] = c.label;
                return { value: c.id, label: c.label };
            });
            
            this.state.choicesInstance.setChoices(choicesData, 'value', 'label', true);
        } catch (e) { console.error("Err commesse", e); }

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
            tree.forEach(m => { html += `<option value="${m.id_macro}">${m.icona || ''} ${m.nome_macro}</option>`; });
            this.dom.macroSelect.innerHTML = html;
            this.dom.macroSelect.disabled = false;
        } catch (e) {
            this.dom.macroSelect.innerHTML = '<option disabled>Errore</option>';
        }
    },

    renderComponentOptions: function(macroId) {
        const macro = this.state.currentOptionsTree.find(m => m.id_macro == macroId);
        if (!macro) return;
        let html = '<option value="" disabled selected>Seleziona Lavorazione...</option>';
        macro.componenti.forEach(c => { html += `<option value="${c.id}">${c.nome} ${c.codice ? `(${c.codice})` : ''}</option>`; });
        this.dom.componentSelect.innerHTML = html;
        this.dom.componentSelect.disabled = false;
    },

    // --- UI Logic ---
    handleTypeChange: function(type) {
        this.dom.prodFields.style.display = 'none';
        this.dom.absFields.style.display = 'none';
        this.dom.groupCommessa.style.display = 'block';

        if (type === 'produzione') this.dom.prodFields.style.display = 'block';
        else if (type === 'assenza') {
            this.dom.groupCommessa.style.display = 'none';
            this.dom.absFields.style.display = 'block';
        }
    },

    startEdit: async function(work) {
        this.state.editingId = work.id_registrazione;
        this.dom.saveBtn.textContent = "AGGIORNA";
        this.dom.saveBtn.style.backgroundColor = "#e67e22"; 
        this.dom.cancelEditBtn.style.display = 'block';
        document.querySelector('.mobile-insert-form').scrollIntoView({ behavior: 'smooth' });

        let type = 'produzione';
        const sub = (work.componenti?.nome_componente || '').toLowerCase();
        if (sub.includes('ferie') || sub.includes('permesso')) type = 'assenza';
        else if (sub.includes('cantiere')) type = 'cantiere';

        document.querySelector(`input[value="${type}"]`).checked = true;
        this.handleTypeChange(type);

        this.dom.hoursInput.value = work.ore;
        this.dom.noteInput.value = work.note || '';

        if (type === 'produzione' || type === 'cantiere') {
            if (work.id_commessa_fk) {
                this.state.choicesInstance.setChoiceByValue(work.id_commessa_fk);
                if (type === 'produzione') {
                    await this.loadSmartOptions(work.id_commessa_fk);
                    if (work.id_componente_fk) {
                        const macro = this.state.currentOptionsTree.find(m => m.componenti.some(c => c.id == work.id_componente_fk));
                        if (macro) {
                            this.dom.macroSelect.value = macro.id_macro;
                            this.renderComponentOptions(macro.id_macro);
                            this.dom.componentSelect.value = work.id_componente_fk;
                        }
                    }
                }
            }
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
        document.querySelector('input[value="produzione"]').checked = true;
        this.handleTypeChange('produzione');
    },

    handleSave: async function(e) {
        e.preventDefault();
        const type = document.querySelector('input[name="entryType"]:checked').value;
        const btn = this.dom.saveBtn;
        
        if (!this.dom.hoursInput.value) return alert("Inserire le ore");

        const payload = {
            data: this.state.currentDate,
            ore: this.dom.hoursInput.value,
            note: this.dom.noteInput.value
        };

        if (type === 'produzione') {
            payload.id_commessa = this.state.choicesInstance.getValue(true);
            payload.id_componente = this.dom.componentSelect.value;
            if (!payload.id_commessa || !payload.id_componente) return alert("Dati incompleti");
        } 
        else if (type === 'cantiere') {
            payload.id_commessa = this.state.choicesInstance.getValue(true);
            if (!payload.id_commessa) return alert("Seleziona Commessa");
            payload.note = `[CANTIERE] ${payload.note}`; 
        }
        else if (type === 'assenza') {
            const absenceType = this.dom.absenceSelect.value;
            if (!absenceType) return alert("Seleziona motivo");
            payload.note = `[${absenceType.toUpperCase()}] ${payload.note}`;
        }

        btn.disabled = true;
        const isEdit = !!this.state.editingId;
        
        try {
             if (isEdit) await apiFetch(`/api/ore/${this.state.editingId}`, { method: 'DELETE' });
             await apiFetch('/api/ore/', { method: 'POST', body: JSON.stringify(payload) });
             
             this.loadExistingWorks(this.state.currentDate);
             this.resetFormState();
             showModal({title: 'Fatto!', message: 'Ore registrate.', confirmText:'OK'});
        } catch (err) { alert("Errore: " + err.message); } 
        finally { btn.disabled = false; }
    },

    deleteWork: async function(id) {
        if (!confirm("Eliminare?")) return;
        try {
            await apiFetch(`/api/ore/${id}`, { method: 'DELETE' });
            this.loadExistingWorks(this.state.currentDate);
        } catch (e) { alert("Errore: " + e.message); }
    }
};

document.addEventListener('DOMContentLoaded', () => { MobileHoursApp.init(); });