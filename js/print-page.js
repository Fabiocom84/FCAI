import { apiFetch } from './api-client.js';
import { showModal } from './shared-ui.js';
import { supabase } from './supabase-client.js'; // Servirà dopo
// Importa qui eventuali funzioni per le policy o gestione date se le hai in utility

const PrintPage = {
    dom: {
        monthSelect: document.getElementById('printMonth'),
        yearSelect: document.getElementById('printYear'),
        btnUpdate: document.getElementById('btnUpdateAnalysis'),
        btnGenerate: document.getElementById('btnGeneratePDF'),
        btnWhatsapp: document.getElementById('btnWhatsappPDF'),
        previewTableBody: document.getElementById('previewTableBody'),
        pdfActionsArea: document.getElementById('pdfActionsArea'),
        kpiWork: document.getElementById('kpiWorkHours'),
        kpiTravel: document.getElementById('kpiTravelHours'),
        kpiAbsence: document.getElementById('kpiAbsenceHours'),
        kpiTotal: document.getElementById('kpiTotalHours'),
        userName: document.getElementById('headerUserName')
    },

    init: function() {
        console.log("🖨️ Print Page Init");
        this.loadUserInfo();
        this.populateDates();
        
        // Listeners
        this.dom.btnUpdate.addEventListener('click', () => this.fetchData());
        this.dom.btnGenerate.addEventListener('click', () => this.generateAndArchive());
    },

    loadUserInfo: function() {
        try {
            const p = JSON.parse(localStorage.getItem('user_profile') || '{}');
            if(p.nome_cognome) this.dom.userName.textContent = p.nome_cognome;
        } catch(e) {}
    },

    populateDates: function() {
        // Mesi
        const months = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
        months.forEach((m, i) => {
            const opt = document.createElement('option');
            opt.value = i + 1;
            opt.textContent = m;
            this.dom.monthSelect.appendChild(opt);
        });

        // Anni (Corrente -1 / +1)
        const currentYear = new Date().getFullYear();
        for (let y = currentYear - 1; y <= currentYear + 1; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if(y === currentYear) opt.selected = true;
            this.dom.yearSelect.appendChild(opt);
        }

        // Seleziona mese corrente
        this.dom.monthSelect.value = new Date().getMonth() + 1;
    },

    // --- LOGICA DA IMPLEMENTARE DOPO CHE MI PASSI I DATI BACKEND ---
    fetchData: async function() {
        const m = this.dom.monthSelect.value;
        const y = this.dom.yearSelect.value;
        
        // UI Loading
        this.dom.previewTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Caricamento dati...</td></tr>';
        
        console.log(`Richiesta dati per ${m}/${y}... in attesa di implementazione backend`);
        
        // Qui chiameremo la tua API /api/ore/mese...
        // Per ora simulo un ritardo
        setTimeout(() => {
            this.dom.previewTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:red;">Logica Backend mancante. Inviami i file!</td></tr>';
        }, 500);
    },

    generateAndArchive: async function() {
        alert("Funzione di generazione PDF pronta per essere collegata!");
    }
};

document.addEventListener('DOMContentLoaded', () => PrintPage.init());