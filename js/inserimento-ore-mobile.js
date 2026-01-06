/* ==========================================================================
   js/inserimento-ore-mobile.js
   Versione Completa - Gestione Viaggi Separati, Doppio Straordinario e Assenze
   ========================================================================== */

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';

const MobileHoursApp = {
    state: {
        offset: 0,
        limit: 14,
        isLoading: false,
        isListFinished: false,
        currentDate: null,
        
        // Gestione Select Commesse
        currentOptionsTree: [], 
        choicesInstance: null,
        commesseMap: {},

        // Gestione Modifica
        editingId: null,
        editingOriginalHours: 0,
        editingStato: 0, 

        // Totali
        currentDayTotal: 0,

        adminMode: false,      
        targetUserId: null,    
        targetUserName: null
    },

    dom: {
        // Contenitori Principali
        timelineContainer: document.getElementById('mobileTimelineContainer'),
        dayDetailModal: document.getElementById('dayDetailModal'),
        existingList: document.getElementById('existingWorksList'),
        
        // Form & Controlli
        form: document.getElementById('mobileHoursForm'),
        typeRadios: document.querySelectorAll('input[name="entryType"]'),
        saveBtn: document.getElementById('saveHoursBtn'),
        cancelEditBtn: document.getElementById('cancelEditBtn'),
        closeDetailBtn: document.getElementById('closeDetailBtn'),
        dayTotalBadge: document.getElementById('dayTotalBadge'),
        
        // Input Base
        commessaSelect: document.getElementById('mobileCommessaSelect'),
        macroSelect: document.getElementById('mobileMacroSelect'),
        componentSelect: document.getElementById('mobileComponentSelect'),
        hoursInput: document.getElementById('mobileHoursInput'),
        noteInput: document.getElementById('mobileNoteInput'),
        hoursLabel: document.getElementById('dynamicHoursLabel'),
        
        // Wrapper Sezioni
        groupCommessa: document.getElementById('group-commessa'),
        prodFields: document.getElementById('production-fields'),
        
        // --- SEZIONE ASSENZA ---
        absFields: document.getElementById('absence-fields'),
        absType: document.getElementById('mobileAbsenceType'),
        absMattinaStart: document.getElementById('absMattinaStart'),
        absMattinaEnd: document.getElementById('absMattinaEnd'),
        absPomStart: document.getElementById('absPomStart'),
        absPomEnd: document.getElementById('absPomEnd'),

        // --- SEZIONE VIAGGIO (Cantiere) ---
        travelFields: document.getElementById('travel-fields'),
        travelAndata: document.getElementById('travelAndataInput'),
        travelRitorno: document.getElementById('travelRitornoInput'),

        // --- SEZIONE STRAORDINARI (Produzione) ---
        overtimeFields: document.getElementById('overtime-fields'),
        strMattinaStart: document.getElementById('strMattinaStart'),
        strMattinaEnd: document.getElementById('strMattinaEnd'),
        strPomStart: document.getElementById('strPomStart'),
        strPomEnd: document.getElementById('strPomEnd')
    },

    init: function() {
        console.log("🚀 Mobile App Init - Debug Version");
        
        // 1. Inizializza componenti UI base
        try {
            this.initChoices();
            this.populateOvertimeSelects();
        } catch (e) { console.error("Errore init UI:", e); }

        // Listeners Globali
        this.dom.timelineContainer.addEventListener('scroll', () => this.handleScroll());
        this.dom.closeDetailBtn.addEventListener('click', () => this.closeDetail());
        this.dom.typeRadios.forEach(r => r.addEventListener('change', (e) => this.handleTypeChange(e.target.value)));
        this.dom.macroSelect.addEventListener('change', (e) => this.renderComponentOptions(e.target.value));
        this.dom.saveBtn.addEventListener('click', (e) => this.handleSave(e));
        this.dom.cancelEditBtn.addEventListener('click', () => this.resetFormState());
        this.dom.hoursInput.addEventListener('input', () => this.checkOvertimeLogic());
        this.dom.travelAndata.addEventListener('input', () => this.checkOvertimeLogic());
        this.dom.travelRitorno.addEventListener('input', () => this.checkOvertimeLogic());
        this.dom.absType.addEventListener('change', (e) => this.handleAbsencePreset(e.target.value));

        // 2. Gestione Admin Mode
        const urlParams = new URLSearchParams(window.location.search);
        // Debug parametri
        console.log("URL Params:", Object.fromEntries(urlParams.entries()));

        if (urlParams.get('adminMode') === 'true' && urlParams.get('targetUserId')) {
            this.state.adminMode = true;
            this.state.targetUserId = parseInt(urlParams.get('targetUserId'));
            this.state.targetUserName = decodeURIComponent(urlParams.get('targetUserName') || 'Utente');
            
            console.log("🔒 Modo Admin Attivo per:", this.state.targetUserId);
            this.setupAdminUI();
        } else {
            this.loadUserName(); 
        }

        // 3. Avvia caricamento dati
        console.log("⏳ Avvio loadTimelineBatch...");
        this.loadTimelineBatch(); 
    },

    setupAdminUI: function() {
        // 1. Cambia Header
        const headerEl = document.getElementById('headerUserName');
        const detailEl = document.getElementById('detailUserName');
        const titleContainer = document.querySelector('.title-container h1');
        
        if(titleContainer) titleContainer.textContent = "MODIFICA ADMIN";
        if(headerEl) {
            headerEl.textContent = `Operando come: ${this.state.targetUserName}`;
            headerEl.style.color = "#f1c40f"; // Giallo per evidenziare
            headerEl.style.fontWeight = "bold";
        }
        if(detailEl) detailEl.textContent = this.state.targetUserName;

        // 2. Aggiungi banner visivo o cambia colore header
        const header = document.querySelector('.mobile-nav-header');
        if(header) {
            header.style.backgroundColor = "#34495e"; // Un colore diverso per l'admin (es. grigio scuro)
            header.style.borderBottom = "4px solid #f1c40f"; // Bordo giallo warning
        }
        
        // 3. Modifica il bottone Home per chiudere la scheda
        const homeBtn = document.querySelector('.header-button');
        if(homeBtn) {
            homeBtn.innerHTML = '<span>❌ Chiudi</span>';
            homeBtn.href = "#";
            homeBtn.onclick = (e) => { e.preventDefault(); window.close(); };
        }
    },

    loadUserName: function() {
        try {
            const p = JSON.parse(localStorage.getItem('user_profile') || '{}');
            if (p.nome_cognome) {
                const headerEl = document.getElementById('headerUserName');
                const detailEl = document.getElementById('detailUserName'); 
                if (headerEl) headerEl.textContent = p.nome_cognome;
                if (detailEl) detailEl.textContent = p.nome_cognome;
            }
        } catch(e) { console.warn("Errore user", e); }
    },

    // --- TIMELINE & NAVIGAZIONE ---
    loadTimelineBatch: async function() {
        if (this.state.isLoading || this.state.isListFinished) return;
        this.state.isLoading = true;
        
        try {
            // Costruzione URL
            let url = `/api/ore/timeline?offset=${this.state.offset}&limit=${this.state.limit}`;
            
            if (this.state.adminMode) {
                url += `&userId=${this.state.targetUserId}`;
            }

            console.log("📡 Fetching:", url); // <--- LOG IMPORTANTE

            const res = await apiFetch(url);
            
            // Gestione errori HTTP non gestiti da apiFetch
            if (!res.ok) {
                console.error("Errore HTTP:", res.status, res.statusText);
                throw new Error(`Errore Server ${res.status}`);
            }

            const days = await res.json();
            console.log("📦 Dati ricevuti:", days.length, "giorni");

            document.querySelector('.loader-placeholder')?.remove();
            
            if (days.length === 0) { 
                this.state.isListFinished = true; 
                if (this.state.offset === 0) {
                    this.dom.timelineContainer.innerHTML = "<div style='padding:20px; text-align:center'>Nessun dato trovato per questo utente.</div>";
                }
                return; 
            }
            
            const todayStr = new Date().toISOString().split('T')[0];
            days.forEach(day => this.dom.timelineContainer.appendChild(this.createDayRow(day, todayStr)));
            this.state.offset += this.state.limit;

        } catch (e) { 
            console.error("❌ Errore loadTimelineBatch:", e); 
            this.dom.timelineContainer.innerHTML = `<div style='padding:20px; color:red; text-align:center'>Errore caricamento: ${e.message}</div>`;
        } 
        finally { 
            this.state.isLoading = false; 
        }
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

    // --- LOGICA UI COMPLESSA (Viaggio, Straordinari, Assenze) ---

    // Cerca la funzione populateOvertimeSelects e SOSTITUISCILA con questa:

    populateOvertimeSelects: function() {
        // 1. Genera opzioni MATTINA (06:00 -> 13:00)
        let morningOpts = '<option value="">--:--</option>';
        for(let h=6; h<=13; h++) {
            const hh = h.toString().padStart(2, '0');
            ['00', '15', '30', '45'].forEach(mm => {
                // Evitiamo orari oltre le 13:00 per la mattina
                if (h === 13 && mm !== '00') return; 
                morningOpts += `<option value="${hh}:${mm}">${hh}:${mm}</option>`;
            });
        }

        // 2. Genera opzioni POMERIGGIO (12:00 -> 22:00)
        // Partiamo dalle 12:00 per gestire eventuali cambi turno anticipati o sovrapposizioni
        let afternoonOpts = '<option value="">--:--</option>';
        for(let h=12; h<=22; h++) {
            const hh = h.toString().padStart(2, '0');
            ['00', '15', '30', '45'].forEach(mm => {
                afternoonOpts += `<option value="${hh}:${mm}">${hh}:${mm}</option>`;
            });
        }

        // 3. Applica alle select corrette
        // MATTINA
        const morningTargets = [
            this.dom.strMattinaStart, this.dom.strMattinaEnd,
            this.dom.absMattinaStart, this.dom.absMattinaEnd
        ];
        morningTargets.forEach(el => { if(el) el.innerHTML = morningOpts; });

        // POMERIGGIO
        const afternoonTargets = [
            this.dom.strPomStart, this.dom.strPomEnd,
            this.dom.absPomStart, this.dom.absPomEnd
        ];
        afternoonTargets.forEach(el => { if(el) el.innerHTML = afternoonOpts; });
    },

    handleTypeChange: function(type) {
        const wrapperEl = this.dom.form.closest('.mobile-insert-form');
        if (wrapperEl) wrapperEl.classList.remove('cantiere-mode');
        
        // 1. Nascondi tutto
        this.dom.prodFields.style.display = 'none';
        this.dom.absFields.style.display = 'none';
        this.dom.travelFields.style.display = 'none';
        this.dom.overtimeFields.style.display = 'none'; // Sempre nascosto inizialmente
        this.dom.groupCommessa.style.display = 'block';

        // 2. Mostra in base al tipo
        if (type === 'produzione') {
            this.dom.prodFields.style.display = 'block';
            if (this.dom.hoursLabel) this.dom.hoursLabel.textContent = "Ore Lavoro *";
        } 
        else if (type === 'cantiere') {
            if (wrapperEl) wrapperEl.classList.add('cantiere-mode'); // CSS Specifico
            this.dom.groupCommessa.style.display = 'none';
            this.dom.travelFields.style.display = 'block';
            if (this.dom.hoursLabel) this.dom.hoursLabel.textContent = "Ore Cantiere *";
        } 
        else if (type === 'assenza') {
            this.dom.groupCommessa.style.display = 'none';
            this.dom.absFields.style.display = 'block';
            if (this.dom.hoursLabel) this.dom.hoursLabel.textContent = "Ore Assenza";
        }
        
        this.checkOvertimeLogic();
    },

    checkOvertimeLogic: function() {
        // Leggi valori numerici
        const hWork = parseFloat(this.dom.hoursInput.value) || 0;
        const hAndata = parseFloat(this.dom.travelAndata.value) || 0;
        const hRitorno = parseFloat(this.dom.travelRitorno.value) || 0;
        
        // Calcola totale "impegno" di questo inserimento
        const inputTotal = hWork + hAndata + hRitorno;
        
        // Totale Giornaliero Previsto (TotaleDB - VecchieOre + NuoveOre)
        const potentialTotal = (this.state.currentDayTotal - this.state.editingOriginalHours) + inputTotal;
        const type = document.querySelector('input[name="entryType"]:checked').value;

        // VISIBILITÀ STRAORDINARI (Solo Produzione e > 8h)
        if (type === 'produzione' && inputTotal > 8) {
            this.dom.overtimeFields.style.display = 'block';
        } else {
            this.dom.overtimeFields.style.display = 'none';
        }
    },

    handleAbsencePreset: function(absType) {
        if (absType === 'Ferie' || absType === 'Malattia') {
            this.dom.hoursInput.value = 8; // Standard
            // Orari standard
            this.dom.absMattinaStart.value = "08:00";
            this.dom.absMattinaEnd.value = "12:00";
            this.dom.absPomStart.value = "13:00";
            this.dom.absPomEnd.value = "17:00";
        } else {
            // Permesso: Pulisci tutto per lasciare libertà
            this.dom.hoursInput.value = ""; 
            this.dom.absMattinaStart.value = "";
            this.dom.absMattinaEnd.value = "";
            this.dom.absPomStart.value = "";
            this.dom.absPomEnd.value = "";
        }
    },

    // --- CARDS LIST & TOTALE (MODIFICATA PER IL LUCCHETTO) ---
    loadExistingWorks: async function(dateStr) {
        this.dom.existingList.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">Caricamento...</div>';
        try {
            let url = `/api/ore/day/${dateStr}`;
            if (this.state.adminMode) url += `?userId=${this.state.targetUserId}`;

            const res = await apiFetch(url);
            const works = await res.json();

            this.dom.existingList.innerHTML = '';

            let total = 0;
            works.forEach(w => {
                total += (w.ore || 0) + (w.ore_viaggio_andata || 0) + (w.ore_viaggio_ritorno || 0);
            });
            this.state.currentDayTotal = total;
            this.updateTotalBadge(total);

            if (works.length === 0) {
                this.dom.existingList.innerHTML = '<div style="text-align:center; padding:10px; color:#999;">Nessuna attività registrata.</div>';
                return;
            }

            works.forEach(w => {
                // --- CHECK STATO ---
                const isLocked = (w.stato === 1);
                // -------------------

                let cardClass = 'card-prod'; 
                let title = 'N/D';
                
                if (w.id_commessa_fk && this.state.commesseMap[w.id_commessa_fk]) {
                    title = this.state.commesseMap[w.id_commessa_fk];
                } else if (w.commesse) {
                    title = `${w.commesse.impianto} (${w.commesse.codice_commessa || ''})`;
                }

                let sub = w.componenti?.nome_componente || 'Attività generica';
                
                if (w.assenza_mattina_dalle || w.assenza_pomeriggio_dalle || sub.toLowerCase().includes('ferie') || sub.toLowerCase().includes('permesso') || sub.toLowerCase().includes('malattia') || sub.toLowerCase().includes('104')) {
                    cardClass = 'card-abs';
                    
                    // FIX: Se il titolo è ancora generico o vuoto, forziamo "GESTIONE PERSONALE".
                    // Altrimenti lasciamo quello che arriva dal DB (che ora sarà corretto grazie al salvataggio su ID 68).
                    if (title === 'N/D' || title === 'Assenza') {
                        title = 'GESTIONE PERSONALE (SYS-JOB-ABS)';
                    }
                    // NOTA: Non sovrascriviamo più 'title' con la parola fissa 'Assenza'.
                } 
                // 2. Caso CANTIERE
                else if (title.toLowerCase().includes('cantiere') || sub.toLowerCase().includes('cantiere') || w.ore_viaggio_andata > 0) {
                    cardClass = 'card-site';
                    // Qui il titolo è già corretto (ATTIVITÀ DI CANTIERE...) perché viene dalla commessa
                }

                // Opacità se bloccato
                if (isLocked) cardClass += ' card-locked'; 

                let extras = [];
                if (w.ore_viaggio_andata > 0) extras.push(`And: ${w.ore_viaggio_andata}h`);
                if (w.ore_viaggio_ritorno > 0) extras.push(`Rit: ${w.ore_viaggio_ritorno}h`);
                if (w.str_mattina_dalle) extras.push(`⚡ M(${w.str_mattina_dalle}-${w.str_mattina_alle})`);
                if (w.str_pomeriggio_dalle) extras.push(`⚡ P(${w.str_pomeriggio_dalle}-${w.str_pomeriggio_alle})`);
                if (w.assenza_mattina_dalle) extras.push(`🕒 M(${w.assenza_mattina_dalle}-${w.assenza_mattina_alle})`);
                if (w.assenza_pomeriggio_dalle) extras.push(`🕒 P(${w.assenza_pomeriggio_dalle}-${w.assenza_pomeriggio_alle})`);

                const extraHtml = extras.length > 0 ? `<div style="font-size:0.75rem; color:#555; margin-top:4px; background:#f0f0f0; padding:2px 5px; border-radius:4px; display:inline-block;">${extras.join(' | ')}</div>` : '';

                // --- AZIONI ---
                let actionsHtml = '';
                if (isLocked) {
                    // SE BLOCCATO: Mostra lucchetto
                    actionsHtml = `<div style="color:#aaa; font-size:1.2rem;" title="Contabilizzato">🔒</div>`;
                } else {
                    // SE LIBERO: Mostra pulsanti
                    actionsHtml = `
                        <div class="card-actions">
                            <button class="action-icon btn-edit">✏️</button>
                            <button class="action-icon btn-delete" style="color:#e53e3e;">🗑️</button>
                        </div>`;
                }

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
                        ${actionsHtml}
                    </div>
                `;

                // Attacca listener SOLO se non è bloccato
                if (!isLocked) {
                    card.querySelector('.btn-edit').addEventListener('click', () => this.startEdit(w));
                    card.querySelector('.btn-delete').addEventListener('click', () => this.deleteWork(w.id_registrazione));
                }

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

    // --- SALVATAGGIO (RIVISTO PER ROBUSTEZZA) ---
    handleSave: async function(e) {
        e.preventDefault();
        const type = document.querySelector('input[name="entryType"]:checked').value;
        const btn = this.dom.saveBtn;
        
        const hours = parseFloat(this.dom.hoursInput.value);
        
        // Validazione base
        if (type !== 'assenza' && !hours) return alert("Inserire le ore di lavoro.");
        if (type === 'assenza' && !hours && !this.dom.absMattinaStart.value) return alert("Inserire le ore o l'orario di assenza.");

        const payload = {
            data: this.state.currentDate,
            ore: hours || 0,
            note: this.dom.noteInput.value,
            stato: this.state.editingId ? this.state.editingStato : 0,
            
            // Viaggio
            ore_viaggio_andata: parseFloat(this.dom.travelAndata.value) || 0,
            ore_viaggio_ritorno: parseFloat(this.dom.travelRitorno.value) || 0,
            
            // Straordinari
            str_mattina_dalle: (this.dom.overtimeFields.style.display === 'block') ? this.dom.strMattinaStart.value : null,
            str_mattina_alle: (this.dom.overtimeFields.style.display === 'block') ? this.dom.strMattinaEnd.value : null,
            str_pomeriggio_dalle: (this.dom.overtimeFields.style.display === 'block') ? this.dom.strPomStart.value : null,
            str_pomeriggio_alle: (this.dom.overtimeFields.style.display === 'block') ? this.dom.strPomEnd.value : null,

            // Assenza
            assenza_mattina_dalle: (type === 'assenza') ? this.dom.absMattinaStart.value : null,
            assenza_mattina_alle: (type === 'assenza') ? this.dom.absMattinaEnd.value : null,
            assenza_pomeriggio_dalle: (type === 'assenza') ? this.dom.absPomStart.value : null,
            assenza_pomeriggio_alle: (type === 'assenza') ? this.dom.absPomEnd.value : null,
        };

        if (this.state.adminMode) {
            payload.id_personale_override = this.state.targetUserId;
        }

        // LOGICA DI COSTRUZIONE PAYLOAD ROBUSTA
        if (type === 'produzione') {
            // Estrazione sicura del valore da Choices.js
            let commessaVal = null;
            if (this.state.choicesInstance) {
                // getValue(true) a volte è instabile, prendiamo l'oggetto e leggiamo .value
                const rawVal = this.state.choicesInstance.getValue(); 
                if (rawVal) {
                    const item = Array.isArray(rawVal) ? rawVal[0] : rawVal;
                    commessaVal = item ? item.value : null;
                }
            }

            if (!commessaVal) {
                return alert("Seleziona una commessa valida.");
            }

            payload.id_commessa = commessaVal;
            payload.id_componente = this.dom.componentSelect.value;
            
            // Controllo stringa vuota
            if (!payload.id_componente || payload.id_componente === "") {
                return alert("Seleziona una Lavorazione (Componente).");
            }
        } 
        else if (type === 'cantiere') {
            let commessaVal = null;
            if (this.state.choicesInstance) {
                const rawVal = this.state.choicesInstance.getValue();
                if (rawVal) {
                    const item = Array.isArray(rawVal) ? rawVal[0] : rawVal;
                    commessaVal = item ? item.value : null;
                }
            }
            payload.id_commessa = commessaVal;
            
            if (!payload.note.toUpperCase().includes('[CANTIERE]')) {
                payload.note = `[CANTIERE] ${payload.note}`;
            }
        }
        else if (type === 'assenza') {
            // 1. COMMESSA: Logica identica al Cantiere (Lookup automatico o Fallback)
            // Cerchiamo la commessa "GESTIONE PERSONALE" (SYS-JOB-ABS / ID 68)
            let absCommessaId = null;
            if (this.state.choicesInstance) {
                // Cerchiamo tra le opzioni caricate nella select
                const choices = this.state.choicesInstance.config.choices; 
                const found = choices.find(c => {
                    const lbl = (c.label || '').toUpperCase();
                    return lbl.includes('GESTIONE PERSONALE') || lbl.includes('SYS-JOB-ABS');
                });
                if (found) absCommessaId = found.value;
            }
            
            // Assegnazione ID Commessa (Automatico o Fallback su 68)
            payload.id_commessa = absCommessaId ? parseInt(absCommessaId) : 68;

            // 2. COMPONENTE (Lavorazione): Logica differenziata per tipo
            // Mappatura: Tipo Assenza -> ID Componente (tabella componenti)
            const absType = this.dom.absType.value; // Valore dalla select (Ferie, Permesso...)
            let componentId = 101; // Default Ferie (SYS-FER)

            switch (absType) {
                case 'Ferie':
                    componentId = 101; // SYS-FER
                    break;
                case 'Permesso':
                    componentId = 102; // SYS-PER
                    break;
                case 'Malattia':
                    componentId = 103; // SYS-MAL
                    break;
                case 'L104':
                    componentId = 104; // SYS-104
                    break;
                default:
                    componentId = 101; // Fallback
            }
            
            payload.id_componente = componentId;

            // 3. NOTE: Aggiunta prefisso per chiarezza nel database
            payload.note = `[${absType.toUpperCase()}] ${payload.note}`;
        }

        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = "Salvando...";

         try {
             if (this.state.editingId) {
                 await apiFetch(`/api/ore/${this.state.editingId}`, { method: 'DELETE' });
             }
             
             console.log("Inviando payload:", payload);
             await apiFetch('/api/ore/', { method: 'POST', body: JSON.stringify(payload) });
             
             this.loadExistingWorks(this.state.currentDate);
             this.resetFormState();

        } catch (err) { 
            console.error("Errore salvataggio:", err);
            alert("Errore salvataggio: " + err.message); 
        } finally { 
            btn.disabled = false; 
            btn.textContent = originalText;
        }
    },

    // --- START EDIT (CON FIX COMMESSA MANCANTE) ---
    startEdit: async function(work) {
        if (work.stato === 1) {
            alert("Record contabilizzato. Impossibile modificare.");
            return;
        }
        this.state.editingId = work.id_registrazione;
        this.state.editingOriginalHours = work.ore || 0;
        this.state.editingStato = work.stato; 

        this.dom.saveBtn.textContent = "AGGIORNA";
        this.dom.saveBtn.style.backgroundColor = "#e67e22"; 
        this.dom.cancelEditBtn.style.display = 'block';
        document.querySelector('.mobile-insert-form').scrollIntoView({ behavior: 'smooth' });

        let type = 'produzione';
        const noteUpper = (work.note || '').toUpperCase();
        if (work.assenza_mattina_dalle || noteUpper.includes('[FERIE]') || noteUpper.includes('[PERMESSO]') || noteUpper.includes('[MALATTIA]')) type = 'assenza';
        else if (work.ore_viaggio_andata > 0 || work.ore_viaggio_ritorno > 0 || noteUpper.includes('[CANTIERE]')) type = 'cantiere';

        const radio = document.querySelector(`input[value="${type}"]`);
        if(radio) { radio.checked = true; this.handleTypeChange(type); }

        this.dom.hoursInput.value = work.ore;
        this.dom.noteInput.value = work.note || '';
        if(work.ore_viaggio_andata) this.dom.travelAndata.value = work.ore_viaggio_andata;
        if(work.ore_viaggio_ritorno) this.dom.travelRitorno.value = work.ore_viaggio_ritorno;
        if(work.str_mattina_dalle) this.dom.strMattinaStart.value = work.str_mattina_dalle;
        if(work.str_mattina_alle) this.dom.strMattinaEnd.value = work.str_mattina_alle;
        if(work.str_pomeriggio_dalle) this.dom.strPomStart.value = work.str_pomeriggio_dalle;
        if(work.str_pomeriggio_alle) this.dom.strPomEnd.value = work.str_pomeriggio_alle;

        if(type === 'assenza') {
            if(work.assenza_mattina_dalle) this.dom.absMattinaStart.value = work.assenza_mattina_dalle;
            if(work.assenza_mattina_alle) this.dom.absMattinaEnd.value = work.assenza_mattina_alle;
            if(work.assenza_pomeriggio_dalle) this.dom.absPomStart.value = work.assenza_pomeriggio_dalle;
            if(work.assenza_pomeriggio_alle) this.dom.absPomEnd.value = work.assenza_pomeriggio_alle;
            if(noteUpper.includes('FERIE')) this.dom.absType.value = 'Ferie';
            else if(noteUpper.includes('PERMESSO')) this.dom.absType.value = 'Permesso';
            else if(noteUpper.includes('MALATTIA')) this.dom.absType.value = 'Malattia';
        }

        // --- FIX CARICAMENTO COMMESSA ---
        if (type === 'produzione' && work.id_commessa_fk) {
            const cId = work.id_commessa_fk;
            const cVal = String(cId);

            // 1. Tenta di impostare il valore
            this.state.choicesInstance.setChoiceByValue(cVal);
            
            // 2. Controlla se è stato impostato davvero
            const selected = this.state.choicesInstance.getValue(true);
            
            // 3. Se non è stato trovato (es. commessa chiusa non in lista), aggiungilo manualmente
            if (!selected || String(selected) !== cVal) {
                if (work.commesse) {
                    let label = work.commesse.impianto || 'Commessa ???';
                    if(work.commesse.codice_commessa) label += ` (${work.commesse.codice_commessa})`;
                    // Aggiungiamo l'opzione "fantasma"
                    this.state.choicesInstance.setChoices(
                        [{ value: cVal, label: label, selected: true }],
                        'value',
                        'label',
                        false 
                    );
                }
            }

            // 4. Carica Macro e Componenti
            await this.loadSmartOptions(cId);
            
            if (work.id_componente_fk) {
                const tree = this.state.currentOptionsTree || [];
                let foundMacroId = null;
                for (const macro of tree) {
                    if (macro.componenti.some(comp => comp.id == work.id_componente_fk)) { foundMacroId = macro.id_macro; break; }
                }
                if (foundMacroId) {
                    this.dom.macroSelect.value = foundMacroId;
                    this.renderComponentOptions(foundMacroId);
                    this.dom.componentSelect.value = work.id_componente_fk;
                }
            }
        }
        this.checkOvertimeLogic();
    },

    resetFormState: function() {
        this.state.editingId = null;
        this.state.editingOriginalHours = 0;
        this.state.editingStato = 0;
        this.dom.form.reset();
        this.state.choicesInstance.removeActiveItems();
        
        this.dom.macroSelect.innerHTML = '<option disabled selected>--</option>';
        this.dom.componentSelect.innerHTML = '<option disabled selected>--</option>';
        
        this.dom.saveBtn.textContent = "AGGIUNGI ORE";
        this.dom.saveBtn.style.backgroundColor = "";
        this.dom.cancelEditBtn.style.display = 'none';
        
        document.querySelector('input[value="produzione"]').checked = true;
        this.handleTypeChange('produzione');
    },

    deleteWork: async function(id) {
        if (!confirm("Eliminare questa registrazione?")) return;
        try {
            await apiFetch(`/api/ore/${id}`, { method: 'DELETE' });
            this.loadExistingWorks(this.state.currentDate);
        } catch (e) { alert("Errore: " + e.message); }
    },

    // --- CHOICES & OPTIONS ---
    initChoices: async function() {
        if (this.state.choicesInstance) this.state.choicesInstance.destroy();

        this.state.choicesInstance = new Choices(this.dom.commessaSelect, {
            searchEnabled: true, itemSelectText: '', placeholder: true, placeholderValue: 'Cerca Commessa...',
            shouldSort: false, position: 'bottom', renderChoiceLimit: 50, removeItemButton: false
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
        } catch (e) { console.error(e); }

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
        } catch (e) { this.dom.macroSelect.innerHTML = '<option disabled>Errore</option>'; }
    },

    renderComponentOptions: function(macroId) {
        const macro = this.state.currentOptionsTree.find(m => m.id_macro == macroId);
        if (!macro) return;
        let html = '<option value="" disabled selected>Seleziona Lavorazione...</option>';
        macro.componenti.forEach(c => { html += `<option value="${c.id}">${c.nome} ${c.codice ? `(${c.codice})` : ''}</option>`; });
        this.dom.componentSelect.innerHTML = html;
        this.dom.componentSelect.disabled = false;
    }
};

document.addEventListener('DOMContentLoaded', () => { MobileHoursApp.init(); });