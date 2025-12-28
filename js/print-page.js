import { apiFetch, publicApiFetch } from './api-client.js';
import { showModal, showSuccessFeedbackModal } from './shared-ui.js';

const PrintPage = {
    state: {
        rawData: [],
        filteredData: [],
        choicesCommesse: null,
        choicesComponenti: null,
        currentView: 'list', 
        templateBytes: null,
        currentUser: null,
        
        // Stato PDF temporaneo
        currentPdfBlob: null,
        currentPdfMonth: null,
        currentPdfYear: null
    },

    dom: {
        dateStart: document.getElementById('dateStart'),
        dateEnd: document.getElementById('dateEnd'),
        btnLoad: document.getElementById('btnLoadData'),
        accordionBtn: document.getElementById('btnToggleFilters'),
        accordionContent: document.getElementById('advancedFiltersBox'),
        selCommesse: document.getElementById('filterCommesse'),
        selComponenti: document.getElementById('filterComponenti'),
        btnApplyFilters: document.getElementById('btnApplyFilters'),
        btnResetFilters: document.getElementById('btnResetFilters'), // NUOVO
        viewBtns: document.querySelectorAll('.view-btn'),
        tableHead: document.getElementById('tableHead'),
        tableBody: document.getElementById('tableBody'),
        kpiWork: document.getElementById('kpiWorkHours'),
        kpiTravel: document.getElementById('kpiTravelHours'),
        kpiAbsence: document.getElementById('kpiAbsenceHours'),
        kpiTotal: document.getElementById('kpiTotalHours'),
        
        // PDF Elements
        stepSelect: document.getElementById('stepSelect'),
        stepPreview: document.getElementById('stepPreview'),
        stepFinalActions: document.getElementById('stepFinalActions'),
        
        pdfMonth: document.getElementById('pdfMonth'),
        pdfYear: document.getElementById('pdfYear'),
        
        btnGenerate: document.getElementById('btnGeneratePDF'),
        pdfPreviewFrame: document.getElementById('pdfPreviewFrame'),
        btnCancelPreview: document.getElementById('btnCancelPreview'),
        btnConfirmSave: document.getElementById('btnConfirmSave'),
        
        btnDownload: document.getElementById('btnDownload'),
        btnWhatsapp: document.getElementById('btnWhatsapp'),
        btnReset: document.getElementById('btnReset'),
        pdfStatus: document.getElementById('pdfStatus'),
        
        userName: document.getElementById('headerUserName')
    },

    init: async function() {
        console.log("📊 Analytics Page Init");
        this.loadUserInfo();
        this.setupDates();
        this.initChoices();
        this.loadTemplate(); 

        // Listeners Analisi
        this.dom.btnLoad.addEventListener('click', () => this.loadAnalysisData());
        this.dom.accordionBtn.addEventListener('click', () => this.toggleAccordion());
        this.dom.btnApplyFilters.addEventListener('click', () => this.applyFilters());
        this.dom.btnResetFilters.addEventListener('click', () => this.resetFilters()); // LISTENER RESET
        
        this.dom.viewBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.dom.viewBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.state.currentView = e.target.dataset.view;
                this.renderTable();
            });
        });

        // Listeners PDF Workflow
        this.dom.btnGenerate.addEventListener('click', () => this.generatePreview());
        this.dom.btnCancelPreview.addEventListener('click', () => this.resetPdfWorkflow());
        this.dom.btnConfirmSave.addEventListener('click', () => this.uploadPdf());
        this.dom.btnReset.addEventListener('click', () => this.resetPdfWorkflow());
        
        this.loadAnalysisData();
    },

    loadUserInfo: function() {
        try {
            const p = JSON.parse(localStorage.getItem('user_profile') || '{}');
            this.state.currentUser = p;
            if(p.nome_cognome) this.dom.userName.textContent = p.nome_cognome;
        } catch(e) {}
    },

    setupDates: function() {
        const today = new Date();
        const past = new Date();
        past.setDate(today.getDate() - 90);
        
        this.dom.dateEnd.value = today.toISOString().split('T')[0];
        this.dom.dateStart.value = past.toISOString().split('T')[0];

        // PDF Select
        const months = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
        months.forEach((m, i) => {
            const opt = document.createElement('option');
            opt.value = i + 1;
            opt.textContent = m;
            this.dom.pdfMonth.appendChild(opt);
        });
        
        const curYear = today.getFullYear();
        for (let y = curYear - 1; y <= curYear + 1; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if(y === curYear) opt.selected = true;
            this.dom.pdfYear.appendChild(opt);
        }
        this.dom.pdfMonth.value = today.getMonth() + 1;
    },

    initChoices: function() {
        if(typeof Choices === 'undefined') return console.error("Choices.js non caricato!");
        
        const config = {
            removeItemButton: true,
            searchEnabled: true,
            placeholder: true,
            placeholderValue: 'Seleziona...',
            itemSelectText: ''
        };
        this.state.choicesCommesse = new Choices(this.dom.selCommesse, config);
        this.state.choicesComponenti = new Choices(this.dom.selComponenti, config);
    },

    toggleAccordion: function() {
        const content = this.dom.accordionContent;
        const arrow = this.dom.accordionBtn.querySelector('.arrow');
        content.classList.toggle('open');
        arrow.textContent = content.classList.contains('open') ? '▲' : '▼';
    },

    // --- LOGICA FILTRI ---

    // 1. Reset
    resetFilters: function() {
        // Pulisce le selezioni visuali
        if(this.state.choicesCommesse) this.state.choicesCommesse.removeActiveItems();
        if(this.state.choicesComponenti) this.state.choicesComponenti.removeActiveItems();
        
        // Ripristina i dati filtrati con tutti i dati grezzi
        this.state.filteredData = [...this.state.rawData];
        
        // Ricalcola tutto
        this.calculateKPI();
        this.renderTable();
    },

    // 2. Caricamento Dati
    loadAnalysisData: async function() {
        const start = this.dom.dateStart.value;
        const end = this.dom.dateEnd.value;
        
        this.dom.btnLoad.disabled = true;
        this.dom.btnLoad.textContent = "⏳...";
        this.dom.tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">Caricamento...</td></tr>';

        try {
            const res = await apiFetch(`/api/report/analyze?start=${start}&end=${end}`);
            const payload = await res.json();
            
            this.state.rawData = payload.data || [];
            this.state.filteredData = [...this.state.rawData];
            
            this.populateFilterOptions();
            this.applyFilters();
            
        } catch (e) {
            console.error(e);
            alert("Errore caricamento dati: " + e.message);
        } finally {
            this.dom.btnLoad.disabled = false;
            this.dom.btnLoad.textContent = "🔄 Carica Dati";
        }
    },

    populateFilterOptions: function() {
        const commesseMap = new Map();
        const compMap = new Map();

        this.state.rawData.forEach(row => {
            if (row.id_commessa && !commesseMap.has(row.id_commessa)) commesseMap.set(row.id_commessa, row.label_commessa);
            if (row.id_componente && !compMap.has(row.id_componente)) compMap.set(row.id_componente, row.label_componente);
        });

        const commesseChoices = Array.from(commesseMap).map(([val, label]) => ({ value: val, label: label }));
        const compChoices = Array.from(compMap).map(([val, label]) => ({ value: val, label: label }));

        this.state.choicesCommesse.setChoices(commesseChoices, 'value', 'label', true);
        this.state.choicesComponenti.setChoices(compChoices, 'value', 'label', true);
    },

    applyFilters: function() {
        const selectedCommesse = this.state.choicesCommesse.getValue(true);
        const selectedComp = this.state.choicesComponenti.getValue(true);

        this.state.filteredData = this.state.rawData.filter(row => {
            if (selectedCommesse.length > 0 && !selectedCommesse.includes(row.id_commessa)) return false;
            if (selectedComp.length > 0 && !selectedComp.includes(row.id_componente)) return false;
            return true;
        });

        this.calculateKPI();
        this.renderTable();
    },

    calculateKPI: function() {
        let work = 0, travel = 0, abs = 0;
        this.state.filteredData.forEach(row => {
            travel += row.viaggio;
            if (row.is_assenza) abs += row.ore;
            else work += row.ore;
        });
        this.dom.kpiWork.textContent = work.toFixed(1);
        this.dom.kpiTravel.textContent = travel.toFixed(1);
        this.dom.kpiAbsence.textContent = abs.toFixed(1);
        this.dom.kpiTotal.textContent = (work + travel + abs).toFixed(1);
    },

    renderTable: function() {
        const view = this.state.currentView;
        const tbody = this.dom.tableBody;
        const thead = this.dom.tableHead;
        tbody.innerHTML = '';

        if (this.state.filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty-msg">Nessun dato.</td></tr>';
            return;
        }

        if (view === 'list') {
            thead.innerHTML = '<tr><th width="20%">Data</th><th>Attività</th><th width="15%">Ore</th></tr>';
            this.state.filteredData.forEach(row => {
                const dateParts = row.data.split('-');
                const shortDate = `${dateParts[2]}/${dateParts[1]}`;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><b>${shortDate}</b></td>
                    <td>
                        <div style="font-weight:500;">${row.label_commessa}</div>
                        <div style="font-size:0.8em; color:#666;">${row.label_componente} ${row.note ? `(${row.note})` : ''}</div>
                    </td>
                    <td style="text-align:center;">
                        <span style="font-weight:bold;">${row.ore}</span>
                        ${row.viaggio > 0 ? `<div style="font-size:0.7em; color:#9b59b6;">+${row.viaggio}v</div>` : ''}
                    </td>`;
                tbody.appendChild(tr);
            });
        } else {
            thead.innerHTML = '<tr><th>Commessa</th><th style="text-align:right;">Ore</th><th style="text-align:right;">Viaggio</th></tr>';
            const groups = {};
            this.state.filteredData.forEach(row => {
                const key = row.label_commessa;
                if (!groups[key]) groups[key] = { hours: 0, travel: 0, count: 0 };
                groups[key].hours += row.ore;
                groups[key].travel += row.viaggio;
                groups[key].count++;
            });
            Object.keys(groups).sort((a,b) => groups[b].hours - groups[a].hours).forEach(k => {
                const g = groups[k];
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><div style="font-weight:bold;">${k}</div><div style="font-size:0.75em; color:#888;">${g.count} reg.</div></td>
                    <td style="text-align:right; color:#2980b9;"><b>${g.hours.toFixed(1)}</b></td>
                    <td style="text-align:right; color:#8e44ad;">${g.travel > 0 ? g.travel.toFixed(1) : '-'}</td>`;
                tbody.appendChild(tr);
            });
        }
    },

    // ============================================================
    // PDF WORKFLOW: PREVIEW -> CONFIRM
    // ============================================================

    loadTemplate: async function() {
        try {
            const templateUrl = "https://mqfhsiezsorpdnskcsgw.supabase.co/storage/v1/object/public/templates/modello_presenze.pdf";
            const res = await fetch(templateUrl);
            if (!res.ok) throw new Error("Template non trovato");
            this.state.templateBytes = await res.arrayBuffer();
        } catch (e) { console.error("PDF Template Error:", e); }
    },

    // 1. GENERA L'ANTEPRIMA (Blob Locale)
    generatePreview: async function() {
        if (!this.state.templateBytes) return alert("Modello PDF non caricato.");
        
        const month = parseInt(this.dom.pdfMonth.value);
        const year = parseInt(this.dom.pdfYear.value);
        this.state.currentPdfMonth = month;
        this.state.currentPdfYear = year;
        
        const btn = this.dom.btnGenerate;
        btn.textContent = "Elaborazione...";
        btn.disabled = true;

        try {
            // Fetch Dati Mese
            const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];
            const res = await apiFetch(`/api/report/analyze?start=${startDate}&end=${endDate}`);
            const payload = await res.json();
            const monthData = payload.data || [];

            // Disegno PDF
            const pdfDoc = await PDFLib.PDFDocument.load(this.state.templateBytes);
            const page = pdfDoc.getPages()[0];
            const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
            const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
            const mNames = ["GENNAIO","FEBBRAIO","MARZO","APRILE","MAGGIO","GIUGNO","LUGLIO","AGOSTO","SETTEMBRE","OTTOBRE","NOVEMBRE","DICEMBRE"];

            const HEADER_Y = 673; 
            page.drawText(this.state.currentUser.nome_cognome.toUpperCase(), { x: 130, y: HEADER_Y, size: 10, font: fontBold });
            page.drawText(mNames[month - 1], { x: 450, y: HEADER_Y, size: 10, font: fontBold });
            page.drawText(year.toString(), { x: 540, y: HEADER_Y, size: 10, font: fontBold });

            const rowsByDay = {};
            for (let d = 1; d <= 31; d++) rowsByDay[d] = [];
            monthData.forEach(row => rowsByDay[parseInt(row.data.split('-')[2])].push(row));

            const startY = 645;
            const rowH = 15.6;
            const CX = { Ore: 280, Straord: 310, Perm: 350, Tipo: 385, Desc: 410, VA: 535, VR: 565 };

            for (let day = 1; day <= 31; day++) {
                const items = rowsByDay[day];
                if (items.length > 0) {
                    let totOre = 0, totViaggio = 0;
                    let labels = [], types = new Set(), isAbs = false;

                    items.forEach(it => {
                        totOre += it.ore;
                        totViaggio += it.viaggio;
                        labels.push(it.label_commessa + (it.note ? ` (${it.note})` : ''));
                        types.add(it.tipo);
                        if (it.is_assenza) isAbs = true;
                    });

                    const Y = startY - ((day - 1) * rowH);
                    const fs = 8; 

                    if (isAbs) {
                        page.drawText(totOre.toString(), { x: CX.Perm, y: Y, size: fs, font });
                    } else {
                        const ord = totOre > 8 ? 8 : totOre;
                        const str = totOre > 8 ? totOre - 8 : 0;
                        page.drawText(ord.toString(), { x: CX.Ore, y: Y, size: fs, font });
                        if (str > 0) page.drawText(str.toString(), { x: CX.Straord, y: Y, size: fs, font });
                    }

                    const finalType = types.has('T') ? 'T' : 'O';
                    page.drawText(finalType, { x: CX.Tipo, y: Y, size: fs, font });

                    let fullDesc = labels.join(", ");
                    if (fullDesc.length > 40) fullDesc = fullDesc.substring(0, 38) + "..";
                    page.drawText(fullDesc, { x: CX.Desc, y: Y, size: 7, font });

                    if (totViaggio > 0) {
                        const v = (totViaggio / 2);
                        page.drawText(v.toString().substr(0,3), { x: CX.VA, y: Y, size: fs, font });
                        page.drawText(v.toString().substr(0,3), { x: CX.VR, y: Y, size: fs, font });
                    }
                }
            }

            const pdfBytes = await pdfDoc.save();
            this.state.currentPdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(this.state.currentPdfBlob);
            this.dom.pdfPreviewFrame.src = blobUrl;
            
            this.dom.stepSelect.style.display = 'none';
            this.dom.stepPreview.style.display = 'block';

        } catch (e) {
            console.error(e);
            alert("Errore generazione: " + e.message);
        } finally {
            btn.textContent = "Anteprima";
            btn.disabled = false;
        }
    },

    // 2. SALVA SU DB
    uploadPdf: async function() {
        const btn = this.dom.btnConfirmSave;
        btn.disabled = true;
        btn.textContent = "Caricamento...";

        try {
            const formData = new FormData();
            formData.append('pdf_file', this.state.currentPdfBlob, 'report.pdf');
            formData.append('mese', this.state.currentPdfMonth);
            formData.append('anno', this.state.currentPdfYear);

            const uploadRes = await apiFetch('/api/report/archive', { method: 'POST', body: formData });
            const result = await uploadRes.json();

            this.dom.stepPreview.style.display = 'none';
            this.dom.stepFinalActions.style.display = 'block';
            
            this.dom.pdfStatus.textContent = `Documento v${result.version} salvato correttamente!`;
            this.dom.btnDownload.href = result.url;
            
            const mNames = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
            const waMsg = `Ciao, invio report presenze ${mNames[this.state.currentPdfMonth-1]} ${this.state.currentPdfYear}: ${result.url}`;
            this.dom.btnWhatsapp.href = `https://wa.me/?text=${encodeURIComponent(waMsg)}`;

            showSuccessFeedbackModal("Salvato", "Il PDF è stato archiviato.");

        } catch (e) {
            alert("Errore salvataggio: " + e.message);
            btn.disabled = false;
            btn.textContent = "💾 Salva e Archivia";
        }
    },

    resetPdfWorkflow: function() {
        this.dom.stepPreview.style.display = 'none';
        this.dom.stepFinalActions.style.display = 'none';
        this.dom.stepSelect.style.display = 'flex';
        
        this.dom.pdfPreviewFrame.src = '';
        this.state.currentPdfBlob = null;
        this.dom.btnConfirmSave.disabled = false;
        this.dom.btnConfirmSave.textContent = "💾 Salva e Archivia";
    }
};

document.addEventListener('DOMContentLoaded', () => PrintPage.init());