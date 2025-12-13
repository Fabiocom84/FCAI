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

        // 0. Carica Nome Utente
        this.loadUserName();

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

    loadUserName: function() {
        try {
            const storedProfile = localStorage.getItem('user_profile');
            if (storedProfile) {
                const profile = JSON.parse(storedProfile);
                const nameEl = document.getElementById('headerUserName');
                if (nameEl && profile.nome_cognome) {
                    nameEl.textContent = profile.nome_cognome;
                }
            } else {
                document.getElementById('headerUserName').textContent = 'Utente';
            }
        } catch (e) {
            console.error("Errore lettura profilo:", e);
        }
    },

    // --- TIMELINE ---

    loadTimelineBatch: async function() {
        if (this.state.isLoading || this.state.isListFinished) return;
        this.state.isLoading = true;

        try {
            const res = await apiFetch(`/api/ore/timeline?offset=${this.state.offset}&limit=${this.state.limit}`);
            const days = await res.json();

            // Rimuovi loader iniziale
            const loader = this.dom.timelineContainer.querySelector('.loader-placeholder');
            if (loader) loader.remove();

            if (days.length === 0) {
                this.state.isListFinished = true;
                return;
            }

            // Ottieni la data di oggi formattata come quella del DB (YYYY-MM-DD)
            // Attenzione al fuso orario, usiamo slice per sicurezza locale semplice
            const todayStr = new Date().toISOString().split('T')[0];

            days.forEach(day => {
                const row = this.createDayRow(day, todayStr);
                this.dom.timelineContainer.appendChild(row);
            });

            this.state.offset += this.state.limit;

            // Se è il primo caricamento, scrolla a Oggi
            if (this.state.offset === this.state.limit) {
                setTimeout(() => this.scrollToToday(), 100);
            }

        } catch (error) {
            console.error("Timeline Error:", error);
            this.dom.timelineContainer.innerHTML = '<p style="text-align:center; padding:20px;">Errore caricamento.</p>';
        } finally {
            this.state.isLoading = false;
        }
    },

    createDayRow: function(day, todayStr) {
        const div = document.createElement('div');
        div.className = 'timeline-row';
        div.dataset.date = day.full_date;
        div.onclick = () => this.openDayDetail(day);

        // CONTROLLO "OGGI": Se la data coincide, aggiungi la classe speciale
        if (day.full_date === todayStr) {
            div.classList.add('is-today');
            div.id = "row-today"; // ID per lo scroll facile
        }

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

    // Funzione per centrare "Oggi"
    scrollToToday: function() {
        const todayRow = document.getElementById('row-today');
        if (todayRow) {
            todayRow.scrollIntoView({
                behavior: 'smooth',
                block: 'center' // Centra verticalmente
            });
        }
    },

    handleScroll: function() {
        const c = this.dom.timelineContainer;
        if (c.scrollTop + c.clientHeight >= c.scrollHeight - 100) {
            this.loadTimelineBatch();
        }
    },

    // --- DETTAGLIO GIORNO (Il resto rimane invariato) ---
    // Copia qui il resto delle funzioni (openDayDetail, loadExistingWorks, etc.) 
    // dal file precedente, non sono cambiate.
    
    openDayDetail: function(day) {
        this.state.currentDate = day.full_date;
        this.dom.dayDetailModal.style.display = 'flex';
        document.getElementById('selectedDayTitle').textContent = `${day.weekday} ${day.day_num} ${day.month_str}`;
        this.dom.form.reset();
        this.dom.activitySelect.innerHTML = '<option value="" disabled selected>Seleziona prima la commessa</option>';
        this.dom.activitySelect.disabled = true;
        this.loadExistingWorks(day.full_date);
    },

    closeDetail: function() {
        this.dom.dayDetailModal.style.display = 'none';
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

            this.dom.hoursInput.value = '';
            this.dom.noteInput.value = '';
            this.dom.activitySelect.value = ''; 
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