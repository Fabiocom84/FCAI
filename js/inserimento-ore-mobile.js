// js/inserimento-ore-mobile.js

import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';

const MobileHoursApp = {
    state: {
        offset: 0,
        limit: 30,
        isLoading: false,
        isListFinished: false,
        currentDate: null
    },

    dom: {
        timelineContainer: document.getElementById('mobileTimelineContainer'),
        dayDetailModal: document.getElementById('dayDetailModal'),
        
        // Form
        commessaSelect: document.getElementById('mobileCommessaSelect'),
        activitySelect: document.getElementById('mobileActivitySelect'),
        hoursInput: document.getElementById('mobileHoursInput'),
        noteInput: document.getElementById('mobileNoteInput'),
        form: document.getElementById('mobileHoursForm'),
        existingList: document.getElementById('existingWorksList'),
        
        // Nav
        closeDetailBtn: document.getElementById('closeDetailBtn')
    },

    init: function() {
        console.log("Mobile Hours App Started");

        // 1. Caricamento Iniziale Timeline
        this.loadTimelineBatch();

        // 2. Caricamento Iniziale Commesse
        this.loadCommesseList();

        // 3. Event Listeners
        this.dom.timelineContainer.addEventListener('scroll', () => this.handleScroll());
        this.dom.closeDetailBtn.addEventListener('click', () => this.closeDetail());
        
        // Smart Filter
        this.dom.commessaSelect.addEventListener('change', (e) => this.loadActivities(e.target.value));
        
        // Submit
        this.dom.form.addEventListener('submit', (e) => this.handleSave(e));
    },

    // --- TIMELINE ---

    loadTimelineBatch: async function() {
        if (this.state.isLoading || this.state.isListFinished) return;
        this.state.isLoading = true;

        try {
            const res = await apiFetch(`/api/ore/timeline?offset=${this.state.offset}&limit=${this.state.limit}`);
            const days = await res.json();

            // Rimuovi loader iniziale se c'è
            const loader = this.dom.timelineContainer.querySelector('.loader-placeholder');
            if (loader) loader.remove();

            if (days.length === 0) {
                this.state.isListFinished = true;
                return;
            }

            days.forEach(day => {
                const row = this.createDayRow(day);
                this.dom.timelineContainer.appendChild(row);
            });

            this.state.offset += this.state.limit;

        } catch (error) {
            console.error("Timeline Error:", error);
            this.dom.timelineContainer.innerHTML = '<p style="text-align:center; padding:20px;">Errore caricamento.</p>';
        } finally {
            this.state.isLoading = false;
        }
    },

    createDayRow: function(day) {
        const div = document.createElement('div');
        div.className = 'timeline-row';
        div.dataset.date = day.full_date;
        div.onclick = () => this.openDayDetail(day);

        div.innerHTML = `
            <div class="timeline-status-bar status-${day.status}"></div>
            <div class="timeline-content">
                <div class="timeline-date">
                    <span class="day-text">${day.weekday}</span>
                    <span class="day-number">${day.day_num} ${day.month_str}</span>
                </div>
                <div class="timeline-hours">
                    ${day.total_hours}h
                </div>
            </div>
        `;
        return div;
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
        this.dom.dayDetailModal.style.display = 'flex'; // Flex per layout a colonna
        document.getElementById('selectedDayTitle').textContent = `${day.weekday} ${day.day_num} ${day.month_str}`;
        
        // Reset e Carica
        this.dom.form.reset();
        this.dom.activitySelect.innerHTML = '<option value="" disabled selected>Seleziona prima la commessa</option>';
        this.dom.activitySelect.disabled = true;
        this.loadExistingWorks(day.full_date);
    },

    closeDetail: function() {
        this.dom.dayDetailModal.style.display = 'none';
        // Ricarica la timeline per aggiornare i totali
        // (Ottimizzazione futura: aggiornare solo la riga specifica)
        this.dom.timelineContainer.innerHTML = '';
        this.state.offset = 0;
        this.state.isListFinished = false;
        this.loadTimelineBatch();
    },

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
                div.innerHTML = `
                    <div class="work-info">
                        <strong>${w.commesse?.impianto || 'Commessa ???'}</strong>
                        <span>${w.catalogo_attivita?.descrizione || 'Attività ???'}</span>
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

    // --- FORM & API ---

    loadCommesseList: async function() {
        try {
            // Usa endpoint 'view' filtrato o uno specifico se creato
            const res = await apiFetch('/api/commesse/view?status=In Lavorazione&limit=100');
            const data = await res.json();
            
            let html = '<option value="" disabled selected>Seleziona Commessa...</option>';
            data.data.forEach(c => {
                html += `<option value="${c.id_commessa}">${c.codice_commessa} ${c.impianto}</option>`;
            });
            this.dom.commessaSelect.innerHTML = html;
        } catch (e) { console.error("Error loading commesse", e); }
    },

    loadActivities: async function(commessaId) {
        this.dom.activitySelect.innerHTML = '<option>Caricamento...</option>';
        this.dom.activitySelect.disabled = true;
        try {
            const res = await apiFetch(`/api/ore/options?id_commessa=${commessaId}`);
            const acts = await res.json();
            
            if (acts.length === 0) {
                this.dom.activitySelect.innerHTML = '<option disabled>Nessuna attività per il tuo ruolo/fase</option>';
                return;
            }

            let html = '<option value="" disabled selected>Seleziona Attività...</option>';
            acts.forEach(a => {
                html += `<option value="${a.id_attivita}">${a.descrizione}</option>`;
            });
            this.dom.activitySelect.innerHTML = html;
            this.dom.activitySelect.disabled = false;

        } catch (e) { console.error(e); }
    },

    handleSave: async function(e) {
        e.preventDefault();
        const btn = this.dom.form.querySelector('button');
        btn.disabled = true; btn.textContent = 'Salvataggio...';

        const payload = {
            data: this.state.currentDate,
            id_commessa: this.dom.commessaSelect.value,
            id_attivita: this.dom.activitySelect.value,
            ore: this.dom.hoursInput.value,
            note: this.dom.noteInput.value
        };

        try {
            const res = await apiFetch('/api/ore/', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Errore Salvataggio");

            // Reset parziale (tieni la commessa se vuoi, qui resetto tutto per pulizia)
            this.dom.hoursInput.value = '';
            this.dom.noteInput.value = '';
            this.dom.activitySelect.value = ''; // Reset attività ma non commessa?
            // Per ora reset totale
            // this.dom.form.reset(); 
            // Meglio tenere la commessa selezionata per inserimenti multipli?
            // Reset solo ore e note:
            
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