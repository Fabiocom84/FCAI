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
        editingOriginalHours: 0, // Serve per calcolare correttamente il totale durante la modifica

        currentDayTotal: 0,      // Somma delle ore salvate nel DB per il giorno corrente
        commesseMap: {}          // Cache etichette "Cliente | Impianto"
    },

    dom: {
        timelineContainer: document.getElementById('mobileTimelineContainer'),
        dayDetailModal: document.getElementById('dayDetailModal'),
        
        form: document.getElementById('mobileHoursForm'),
        typeRadios: document.querySelectorAll('input[name="entryType"]'),
        
        // Selects
        commessaSelect: document.getElementById('mobileCommessaSelect'),
        macroSelect: document.getElementById('mobileMacroSelect'),
        componentSelect: document.getElementById('mobileComponentSelect'),
        absenceSelect: document.getElementById('mobileAbsenceType'),
        
        // Inputs
        hoursInput: document.getElementById('mobileHoursInput'),
        noteInput: document.getElementById('mobileNoteInput'),
        
        // Sections & Wrappers
        groupCommessa: document.getElementById('group-commessa'),
        prodFields: document.getElementById('production-fields'),
        absFields: document.getElementById('absence-fields'),

        // New Features Elements
        dayTotalBadge: document.getElementById('dayTotalBadge'),
        
        travelFields: document.getElementById('travel-fields'),
        travelInput: document.getElementById('travelHoursInput'),
        
        overtimeFields: document.getElementById('overtime-fields'),
        overtimeStart: document.getElementById('overtimeStart'),
        overtimeEnd: document.getElementById('overtimeEnd'),

        hoursLabel: document.getElementById('dynamicHoursLabel'),
        
        existingList: document.getElementById('existingWorksList'),
        saveBtn: document.getElementById('saveHoursBtn'),
        cancelEditBtn: document.getElementById('cancelEditBtn'),
        closeDetailBtn: document.getElementById('closeDetailBtn')
    },

    init: function() {
        console.log("🚀 Mobile App Init - Full Features");
        this.loadUserName();
        this.loadTimelineBatch();
        
        // Init Choices.js
        this.initChoices();

        // --- NUOVO: Popola gli orari straordinari ---
        this.populateOvertimeSelects();
        
        // Listeners Globali
        this.dom.timelineContainer.addEventListener('scroll', () => this.handleScroll());
        this.dom.closeDetailBtn.addEventListener('click', () => this.closeDetail());
        
        // Toggle Tipo (Produzione / Cantiere / Assenza)
        this.dom.typeRadios.forEach(r => r.addEventListener('change', (e) => this.handleTypeChange(e.target.value)));
        
        // Cascata Macro -> Componenti
        this.dom.macroSelect.addEventListener('change', (e) => this.renderComponentOptions(e.target.value));

        // Pulsanti Azione
        this.dom.saveBtn.addEventListener('click', (e) => this.handleSave(e));
        this.dom.cancelEditBtn.addEventListener('click', () => this.resetFormState());

        // Logic Check Straordinari (al digitare delle ore)
        this.dom.hoursInput.addEventListener('input', () => this.checkOvertimeLogic());
        // Se vuoi che anche il viaggio conti nel limite delle 8 ore, scommenta:
        // this.dom.travelInput.addEventListener('input', () => this.checkOvertimeLogic());
    },

    loadUserName: function() {
        try {
            const p = JSON.parse(localStorage.getItem('user_profile') || '{}');
            if (p.nome_cognome) {
                // Aggiorna la schermata principale (timeline)
                const headerEl = document.getElementById('headerUserName');
                if (headerEl) headerEl.textContent = p.nome_cognome;

                // Aggiorna la schermata di dettaglio (quella dello screenshot)
                const detailEl = document.getElementById('detailUserName'); 
                if (detailEl) detailEl.textContent = p.nome_cognome;
            }
        } catch(e) {
            console.warn("Errore caricamento nome utente:", e);
        }
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

    // --- CARDS ATTIVITÀ & CALCOLO TOTALE ---
    loadExistingWorks: async function(dateStr) {
        this.dom.existingList.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">Caricamento...</div>';
        try {
            const res = await apiFetch(`/api/ore/day/${dateStr}`);
            const works = await res.json();
            this.dom.existingList.innerHTML = '';

            // 1. Calcolo Totale Giornaliero (Ore Lavorate)
            let total = 0;
            works.forEach(w => total += (w.ore || 0));
            this.state.currentDayTotal = total;
            this.updateTotalBadge(total);

            if (works.length === 0) {
                this.dom.existingList.innerHTML = '<div style="text-align:center; padding:10px; color:#999;">Nessuna attività registrata.</div>';
                return;
            }

            works.forEach(w => {
                let cardClass = 'card-prod'; 
                
                // Titolo Commessa (Ricco se disponibile in cache)
                let title = 'N/D';
                if (w.id_commessa_fk && this.state.commesseMap[w.id_commessa_fk]) {
                    title = this.state.commesseMap[w.id_commessa_fk];
                } else if (w.commesse) {
                    title = `${w.commesse.impianto} (${w.commesse.codice_commessa || ''})`;
                }

                let sub = w.componenti?.nome_componente || 'Attività generica';
                
                // Euristica Tipo
                if (sub.toLowerCase().includes('ferie') || sub.toLowerCase().includes('permesso') || sub.toLowerCase().includes('malattia')) {
                    cardClass = 'card-abs'; 
                    title = 'Assenza';
                } else if (title.toLowerCase().includes('cantiere') || sub.toLowerCase().includes('cantiere') || (w.ore_viaggio > 0)) {
                    cardClass = 'card-site';
                }

                // Info aggiuntive (Viaggio / Straordinari)
                let extras = [];
                if (w.ore_viaggio > 0) extras.push(`🚗 Viaggio: ${w.ore_viaggio}h`);
                if (w.straordinario_dalle && w.straordinario_alle) extras.push(`⚡ Straord: ${w.straordinario_dalle}-${w.straordinario_alle}`);
                const extraHtml = extras.length > 0 ? `<div style="font-size:0.75rem; color:#d35400; margin-top:2px;">${extras.join(' | ')}</div>` : '';

                const card = document.createElement('div');
                card.className = `activity-card ${cardClass}`;
                card.innerHTML = `
                    <div class="card-info">
                        <h5>${title}</h5>
                        <p>${sub} ${w.componenti?.codice_componente ? `(${w.componenti.codice_componente})` : ''}</p>
                        ${w.note ? `<span class="card-meta">📝 ${w.note}</span>` : ''}
                        ${extraHtml}
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

    updateTotalBadge: function(total) {
        const el = this.dom.dayTotalBadge;
        if (!el) return;
        el.textContent = `Totale: ${total}h`;
        el.className = 'day-total-badge';
        if (total > 8) el.classList.add('warning');
        else if (total === 8) el.classList.add('ok');
    },

    // --- CHECK STRAORDINARI (> 8h) ---
    checkOvertimeLogic: function() {
        const inputHours = parseFloat(this.dom.hoursInput.value) || 0;
        
        // Totale = (TotaleDB - OreInModifica) + OreInput
        // Se non stiamo modificando, editingOriginalHours è 0
        const potentialTotal = (this.state.currentDayTotal - this.state.editingOriginalHours) + inputHours;

        if (potentialTotal > 8) {
            this.dom.overtimeFields.style.display = 'block';
        } else {
            this.dom.overtimeFields.style.display = 'none';
            // Non puliamo i campi automaticamente per non infastidire l'utente se corregge al volo
        }
    },

    // --- CHOICES.JS CONFIG ---
    initChoices: async function() {
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
            position: 'bottom',
            renderChoiceLimit: 50,
            searchResultLimit: 15,
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

    // Genera orari con step 30 minuti sfasati (XX:15, XX:45)
    populateOvertimeSelects: function() {
        let options = '<option value="" disabled selected>--:--</option>';
        
        // Esteso per coprire anche la notte (es. fino alle 04:00 del mattino dopo)
        const hoursList = [
            6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23, // Giorno
            0,1,2,3,4 // Notte
        ];

        hoursList.forEach(h => {
            const hour = h.toString().padStart(2, '0');
            options += `<option value="${hour}:00">${hour}:00</option>`; // Aggiunto XX:00
            options += `<option value="${hour}:15">${hour}:15</option>`;
            options += `<option value="${hour}:30">${hour}:30</option>`; // Aggiunto XX:30
            options += `<option value="${hour}:45">${hour}:45</option>`;
        });

        if(this.dom.overtimeStart) this.dom.overtimeStart.innerHTML = options;
        if(this.dom.overtimeEnd) this.dom.overtimeEnd.innerHTML = options;
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

    handleTypeChange: function(type) {
        // Riferimento al contenitore padre per gestire gli spazi esterni
        const wrapperEl = this.dom.form.closest('.mobile-insert-form');
        
        // Reset classi e visibilità
        if (wrapperEl) wrapperEl.classList.remove('cantiere-mode');
        this.dom.prodFields.style.display = 'none';
        this.dom.absFields.style.display = 'none';
        this.dom.travelFields.style.display = 'none';
        this.dom.groupCommessa.style.display = 'block';

        if (type === 'produzione') {
            this.dom.prodFields.style.display = 'block';
            if (this.dom.hoursLabel) this.dom.hoursLabel.textContent = "Ore Lavoro *";
        } 
        else if (type === 'cantiere') {
            // CANTIERE: Aggiunge la classe che attiva il CSS "aggressivo" di cui sopra
            if (wrapperEl) wrapperEl.classList.add('cantiere-mode');
            
            this.dom.groupCommessa.style.display = 'none';
            this.dom.travelFields.style.display = 'block';
            if (this.dom.hoursLabel) this.dom.hoursLabel.textContent = "Ore Cantiere *";
        } 
        else if (type === 'assenza') {
            this.dom.groupCommessa.style.display = 'none';
            this.dom.absFields.style.display = 'block';
            if (this.dom.hoursLabel) this.dom.hoursLabel.textContent = "Ore Assenza *";
        }
        
        this.checkOvertimeLogic();
    },

    // --- MODIFICA ---
    startEdit: async function(work) {
        this.state.editingId = work.id_registrazione;
        this.state.editingOriginalHours = work.ore || 0; // Salva ore originali per delta

        this.dom.saveBtn.textContent = "AGGIORNA";
        this.dom.saveBtn.style.backgroundColor = "#e67e22"; 
        this.dom.cancelEditBtn.style.display = 'block';
        document.querySelector('.mobile-insert-form').scrollIntoView({ behavior: 'smooth' });

        // Determina Tipo
        let type = 'produzione';
        const sub = (work.componenti?.nome_componente || '').toLowerCase();
        
        if (sub.includes('ferie') || sub.includes('permesso') || sub.includes('malattia')) type = 'assenza';
        else if (work.ore_viaggio > 0 || (work.note && work.note.includes('[CANTIERE]'))) type = 'cantiere';

        // Setta Radio
        document.querySelector(`input[value="${type}"]`).checked = true;
        this.handleTypeChange(type);

        // Popola Campi Comuni
        this.dom.hoursInput.value = work.ore;
        this.dom.noteInput.value = work.note || '';
        
        // Campi Extra
        if (work.ore_viaggio) this.dom.travelInput.value = work.ore_viaggio;
        if (work.straordinario_dalle) this.dom.overtimeStart.value = work.straordinario_dalle;
        if (work.straordinario_alle) this.dom.overtimeEnd.value = work.straordinario_alle;

        // Popola Commessa e Cascata (se presenti)
        if ((type === 'produzione' || type === 'cantiere') && work.id_commessa_fk) {
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
        
        // Check Straordinari immediato
        this.checkOvertimeLogic();
    },

    resetFormState: function() {
        this.state.editingId = null;
        this.state.editingOriginalHours = 0;
        
        this.dom.form.reset();
        this.state.choicesInstance.removeActiveItems();
        
        // Reset cascata
        this.dom.macroSelect.innerHTML = '<option disabled selected>--</option>';
        this.dom.componentSelect.innerHTML = '<option disabled selected>--</option>';
        this.dom.componentSelect.disabled = true;
        this.dom.macroSelect.disabled = true;
        
        this.dom.saveBtn.textContent = "AGGIUNGI ORE";
        this.dom.saveBtn.style.backgroundColor = "";
        this.dom.cancelEditBtn.style.display = 'none';
        
        // Reset UI Extra
        this.dom.overtimeFields.style.display = 'none';
        
        // Reset Tipo
        document.querySelector('input[value="produzione"]').checked = true;
        this.handleTypeChange('produzione');
    },

    // --- SALVATAGGIO ---
    handleSave: async function(e) {
        e.preventDefault();
        const type = document.querySelector('input[name="entryType"]:checked').value;
        const btn = this.dom.saveBtn;
        
        const hours = parseFloat(this.dom.hoursInput.value);
        if (!hours) return alert("Inserire le ore");

        // Controllo Straordinari Obbligatori
        if (this.dom.overtimeFields.style.display === 'block') {
            if (!this.dom.overtimeStart.value || !this.dom.overtimeEnd.value) {
                return alert("Hai superato le 8 ore: specifica l'orario dello straordinario.");
            }
        }

        const payload = {
            data: this.state.currentDate,
            ore: hours,
            note: this.dom.noteInput.value,
            straordinario_dalle: this.dom.overtimeStart.value || null,
            straordinario_alle: this.dom.overtimeEnd.value || null,
            ore_viaggio: parseFloat(this.dom.travelInput.value) || 0
        };

        if (type === 'produzione') {
            payload.id_commessa = this.state.choicesInstance.getValue(true);
            payload.id_componente = this.dom.componentSelect.value;
            if (!payload.id_commessa || !payload.id_componente) return alert("Dati incompleti (Commessa/Lavorazione)");
        } 
        else if (type === 'cantiere') {
            const commessaVal = this.state.choicesInstance.getValue(true);
            payload.id_commessa = commessaVal ? commessaVal : null;
            // Nota obbligatoria se non c'è commessa
            if (!payload.note && !commessaVal) return alert("Per cantiere: seleziona commessa o scrivi una nota.");
            if (!payload.note.includes('[CANTIERE]')) payload.note = `[CANTIERE] ${payload.note}`;
        }
        else if (type === 'assenza') {
            payload.id_commessa = null;
            const absenceType = this.dom.absenceSelect.value;
            if (!absenceType) return alert("Seleziona motivo assenza");
            payload.note = `[${absenceType.toUpperCase()}] ${payload.note}`;
        }

        btn.disabled = true;
        const isEdit = !!this.state.editingId;
        
        try {
             if (isEdit) await apiFetch(`/api/ore/${this.state.editingId}`, { method: 'DELETE' });
             await apiFetch('/api/ore/', { method: 'POST', body: JSON.stringify(payload) });
             
             this.loadExistingWorks(this.state.currentDate);
             this.resetFormState();
             showModal({title: 'Fatto!', message: 'Salvataggio completato.', confirmText:'OK'});
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