/* ==========================================================================
   js/print-page.js - Versione Admin Fixed & Filenames
   ========================================================================== */

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

        currentPdfBlob: null,
        currentPdfMonth: null,
        currentPdfYear: null,

        // --- STATO ADMIN ---
        adminMode: false,
        targetUserId: null,
        targetUserName: null
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
        btnResetFilters: document.getElementById('btnResetFilters'),
        viewBtns: document.querySelectorAll('.view-btn'),
        tableHead: document.getElementById('tableHead'),
        tableBody: document.getElementById('tableBody'),
        kpiWork: document.getElementById('kpiWorkHours'),
        kpiTravel: document.getElementById('kpiTravelHours'),
        kpiAbsence: document.getElementById('kpiAbsenceHours'),
        kpiTotal: document.getElementById('kpiTotalHours'),

        stepSelect: document.getElementById('stepSelect'),
        stepPreview: document.getElementById('stepPreview'),
        stepFinalActions: document.getElementById('stepFinalActions'),

        pdfMonth: document.getElementById('pdfMonth'),
        pdfYear: document.getElementById('pdfYear'),

        existingReportAlert: document.getElementById('existingReportAlert'),
        newReportControls: document.getElementById('newReportControls'),
        foundVersion: document.getElementById('foundVersion'),
        btnQuickPreview: document.getElementById('btnQuickPreview'),
        btnQuickDownload: document.getElementById('btnQuickDownload'),
        btnQuickWhatsapp: document.getElementById('btnQuickWhatsapp'),
        btnForceRegenerate: document.getElementById('btnForceRegenerate'),

        btnGenerate: document.getElementById('btnGeneratePDF'),
        pdfPreviewImage: document.getElementById('pdfPreviewImage'),
        btnCancelPreview: document.getElementById('btnCancelPreview'),
        btnConfirmSave: document.getElementById('btnConfirmSave'),

        btnDownload: document.getElementById('btnDownload'),
        btnWhatsapp: document.getElementById('btnWhatsapp'),
        btnReset: document.getElementById('btnReset'),
        pdfStatus: document.getElementById('pdfStatus'),

        userName: document.getElementById('headerUserName'),
        searchInput: document.getElementById('tableSearchInput')
    },

    init: async function () {
        console.log("📊 Analytics Page Init - Admin Fixed");

        // 1. GESTIONE ADMIN MODE (Lettura URL)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('adminMode') === 'true' && urlParams.get('targetUserId')) {
            this.state.adminMode = true;
            this.state.targetUserId = parseInt(urlParams.get('targetUserId'));
            this.state.targetUserName = decodeURIComponent(urlParams.get('targetUserName') || 'Utente');

            console.log("🔒 Admin Mode Active for User:", this.state.targetUserId);
            this.setupAdminUI();
        }

        this.loadUserInfo();
        this.setupDates();
        this.initChoices();
        this.loadTemplate();

        // Listeners Tabelle
        this.dom.btnLoad.addEventListener('click', () => this.loadAnalysisData());
        this.dom.accordionBtn.addEventListener('click', () => this.toggleAccordion());
        this.dom.btnApplyFilters.addEventListener('click', () => this.applyFilters());
        this.dom.btnResetFilters.addEventListener('click', () => this.resetFilters());

        this.dom.viewBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.dom.viewBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.state.currentView = e.target.dataset.view;
                this.renderTable();
            });
        });

        // Search Listener
        if (this.dom.searchInput) {
            this.dom.searchInput.addEventListener('input', () => this.applyFilters());
        }

        // Listeners Workflow PDF
        this.dom.btnGenerate.addEventListener('click', () => this.generatePreview());
        this.dom.btnCancelPreview.addEventListener('click', () => this.resetPdfWorkflow());
        this.dom.btnConfirmSave.addEventListener('click', () => this.uploadPdf());
        this.dom.btnReset.addEventListener('click', () => this.resetPdfWorkflow());

        if (this.dom.btnForceRegenerate) {
            this.dom.btnForceRegenerate.addEventListener('click', () => {
                this.dom.existingReportAlert.style.display = 'none';
                this.generatePreview();
            });
        }

        // Cambio data -> Check Report
        this.dom.pdfMonth.addEventListener('change', () => this.checkExistingReport());
        this.dom.pdfYear.addEventListener('change', () => this.checkExistingReport());

        this.loadAnalysisData();
        this.checkExistingReport();
    },

    setupAdminUI: function () {
        // 1. Uniformiamo il Titolo
        const titleEl = document.querySelector('.title-container h1');
        if (titleEl) titleEl.textContent = "REPORT ADMIN";

        // 2. Stile Header (Grigio scuro + Bordo Giallo)
        const header = document.querySelector('.mobile-nav-header');
        if (header) {
            header.style.backgroundColor = "#34495e";
            header.style.borderBottom = "4px solid #f1c40f";
        }

        // 3. Tasto Chiudi
        const homeBtn = document.querySelector('.header-button');
        if (homeBtn) {
            homeBtn.innerHTML = '<span>❌ Chiudi</span>';
            homeBtn.href = "#";
            homeBtn.onclick = (e) => { e.preventDefault(); window.close(); };
        }
    },

    loadUserInfo: function () {
        if (this.state.adminMode) {
            // In Admin Mode, l'utente "corrente" per la pagina è il dipendente target
            this.state.currentUser = {
                id_personale: this.state.targetUserId,
                nome_cognome: this.state.targetUserName
            };
            // Mostriamo il nome in GIALLO per evidenziare che stiamo operando su di lui
            this.dom.userName.innerHTML = `Operando come: <span style="color:#f1c40f; font-weight:bold;">${this.state.targetUserName}</span>`;
        } else {
            // Modalità Normale
            try {
                const p = JSON.parse(localStorage.getItem('user_profile') || '{}');
                this.state.currentUser = p;
                if (p.nome_cognome) this.dom.userName.textContent = p.nome_cognome;
            } catch (e) { }
        }
    },

    setupDates: function () {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const formatDate = (date) => {
            const offset = date.getTimezoneOffset();
            const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
            return adjustedDate.toISOString().split('T')[0];
        };

        this.dom.dateEnd.value = formatDate(today);
        this.dom.dateStart.value = formatDate(firstDayOfMonth);

        const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
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
            if (y === curYear) opt.selected = true;
            this.dom.pdfYear.appendChild(opt);
        }
        this.dom.pdfMonth.value = today.getMonth() + 1;
    },

    initChoices: function () {
        if (typeof Choices === 'undefined') return console.error("Choices.js non caricato!");

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

    toggleAccordion: function () {
        const content = this.dom.accordionContent;
        const arrow = this.dom.accordionBtn.querySelector('.arrow');
        content.classList.toggle('open');
        arrow.textContent = content.classList.contains('open') ? '▲' : '▼';
    },

    resetFilters: function () {
        if (this.state.choicesCommesse) this.state.choicesCommesse.removeActiveItems();
        if (this.state.choicesComponenti) this.state.choicesComponenti.removeActiveItems();
        this.state.filteredData = [...this.state.rawData];
        this.calculateKPI();
        this.renderTable();
    },

    loadAnalysisData: async function () {
        const start = this.dom.dateStart.value;
        const end = this.dom.dateEnd.value;
        this.dom.btnLoad.disabled = true;
        this.dom.btnLoad.textContent = "⏳...";
        this.dom.tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">Caricamento...</td></tr>';

        try {
            // --- FIX ADMIN MODE: Passiamo ID target ---
            let url = `/api/report/analyze?start=${start}&end=${end}`;
            if (this.state.adminMode) {
                url += `&userId=${this.state.targetUserId}`;
            }
            // ------------------------------------------

            const res = await apiFetch(url);

            if (!res.ok) {
                throw new Error(`Errore Server ${res.status}`);
            }

            const payload = await res.json();
            this.state.rawData = payload.data || [];
            this.state.filteredData = [...this.state.rawData];
            this.populateFilterOptions();
            this.applyFilters();
        } catch (e) {
            console.error(e);
            this.dom.tableBody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align:center; padding:20px; color:#e53e3e;">
                        <strong>Errore caricamento dati</strong><br>
                        ${e.message}
                    </td>
                </tr>`;
        } finally {
            this.dom.btnLoad.disabled = false;
            this.dom.btnLoad.textContent = "🔄 Carica Dati";
        }
    },

    populateFilterOptions: function () {
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

    applyFilters: function () {
        const selectedCommesse = this.state.choicesCommesse.getValue(true);
        const selectedComp = this.state.choicesComponenti.getValue(true);
        const searchText = (this.dom.searchInput ? this.dom.searchInput.value : '').toLowerCase().trim();

        this.state.filteredData = this.state.rawData.filter(row => {
            // 1. Filtri Select
            if (selectedCommesse.length > 0 && !selectedCommesse.includes(row.id_commessa)) return false;
            if (selectedComp.length > 0 && !selectedComp.includes(row.id_componente)) return false;

            // 2. Filtro Testuale (Search)
            if (searchText) {
                const searchableText = [
                    row.label_commessa,
                    row.label_componente,
                    row.note,
                    row.data // Opzionale: cerca anche nella data
                ].map(s => (s || '').toLowerCase()).join(' ');

                if (!searchableText.includes(searchText)) return false;
            }

            return true;
        });
        this.calculateKPI();
        this.renderTable();
    },

    calculateKPI: function () {
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

    renderTable: function () {
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
            Object.keys(groups).sort((a, b) => groups[b].hours - groups[a].hours).forEach(k => {
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

    loadTemplate: async function () {
        try {
            const templateUrl = "https://mqfhsiezsorpdnskcsgw.supabase.co/storage/v1/object/public/templates/modello_presenze.pdf";
            const res = await fetch(templateUrl);
            if (!res.ok) throw new Error("Template non trovato");
            this.state.templateBytes = await res.arrayBuffer();
        } catch (e) { console.error("PDF Template Error:", e); }
    },


    convertPdfToImgBlob: async function (pdfUrl) {
        if (!pdfUrl) throw new Error("URL PDF mancante per la conversione.");

        try {
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
        } catch (e) {
            console.error("PDF Convert Error:", e);
            throw new Error("Impossibile convertire il PDF in immagine. " + e.message);
        }
    },

    checkExistingReport: async function () {
        const month = this.dom.pdfMonth.value;
        const year = this.dom.pdfYear.value;

        this.dom.existingReportAlert.style.display = 'none';
        this.dom.newReportControls.style.display = 'block';

        try {
            // --- FIX ADMIN MODE: Passiamo l'ID utente corretto ---
            let url = `/api/report/latest?mese=${month}&anno=${year}`;
            if (this.state.adminMode) {
                url += `&userId=${this.state.targetUserId}`;
            }
            // -----------------------------------------------------

            const res = await apiFetch(url);
            const data = await res.json();

            if (data.exists) {
                this.dom.newReportControls.style.display = 'none';
                this.dom.existingReportAlert.style.display = 'block';
                this.dom.foundVersion.textContent = data.version;

                // Configura i bottoni "Rapidi"
                this.configureQuickButtons(data.url, data.version, year, month);
            }
        } catch (e) { console.error("Errore check:", e); }
    },

    configureQuickButtons: function (url, version, year, month) {
        const btnView = document.getElementById('btnQuickPreview');
        const btnDown = document.getElementById('btnQuickDownload');
        const btnWa = document.getElementById('btnQuickWhatsapp');

        // Nome File Univoco: Report_2025_12_Mario_Rossi_v1.jpg
        const safeName = this.state.currentUser.nome_cognome.replace(/\s+/g, '_');
        const fileName = `Report_${year}_${month}_${safeName}_v${version}.jpg`;

        btnView.onclick = async () => window.open(url, '_blank');

        btnDown.onclick = async () => {
            const oldText = btnDown.textContent;
            btnDown.textContent = "Scarico...";
            try {
                // [FIX] Usiamo convertPdfToImgBlob per ottenere un vero JPG, non un rename
                const blob = await this.convertPdfToImgBlob(url);
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fileName; // <--- Ora è un vero JPG
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (e) {
                console.error(e);
                alert("Errore durante il download dell'immagine: " + e.message);
            }
            finally { btnDown.textContent = oldText; }
        };

        const waMsg = `Report ${this.state.currentUser.nome_cognome} - ${month}/${year}: ${url}`;
        btnWa.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(waMsg)}`;
    },

    // =========================================================
    // GENERAZIONE PDF
    // =========================================================
    generatePreview: async function () {
        if (!this.state.templateBytes) return alert("Modello PDF non caricato.");

        const month = parseInt(this.dom.pdfMonth.value);
        const year = parseInt(this.dom.pdfYear.value);
        this.state.currentPdfMonth = month;
        this.state.currentPdfYear = year;

        const btn = this.dom.btnGenerate;
        btn.textContent = "Elaborazione...";
        btn.disabled = true;

        try {
            // A. Recupero Dati
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];

            // --- FIX ADMIN MODE ---
            let url = `/api/report/analyze?start=${startDate}&end=${endDate}`;
            if (this.state.adminMode) {
                url += `&userId=${this.state.targetUserId}`;
            }
            // ---------------------

            const res = await apiFetch(url);
            const payload = await res.json();
            const monthData = payload.data || [];

            // B. PDF setup
            const pdfDoc = await PDFLib.PDFDocument.load(this.state.templateBytes);
            const page = pdfDoc.getPages()[0];
            const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
            const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
            const mNames = ["GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO", "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE"];

            const HEADER_Y = 712;
            page.drawText(this.state.currentUser.nome_cognome.toUpperCase(), { x: 115, y: HEADER_Y, size: 10, font: fontBold });
            page.drawText(mNames[month - 1], { x: 405, y: HEADER_Y, size: 10, font: fontBold });
            page.drawText(year.toString(), { x: 548, y: HEADER_Y, size: 10, font: fontBold });

            const rowsByDay = {};
            for (let d = 1; d <= 31; d++) rowsByDay[d] = [];
            monthData.forEach(row => rowsByDay[parseInt(row.data.split('-')[2])].push(row));

            const startY = 670;
            const rowH = 15.77;

            // COORDINATE
            const CX = {
                Col_M_In: 96, Col_M_Out: 127,
                Col_P_In: 159, Col_P_Out: 191,
                Ore: 230, Straord: 261, Perm: 300,
                Tipo: 342,
                Desc: 370, // Posizione Descrizione
                VA: 513, VR: 551
            };

            const fs = 10;

            for (let day = 1; day <= 31; day++) {
                const items = rowsByDay[day];

                if (items.length > 0) {
                    // --- Separazione contatori ---
                    let totLavoro = 0;
                    let totAssenza = 0;
                    let totViaggio = 0;

                    let labels = [], types = new Set();
                    let timeM_In = "", timeM_Out = "", timeP_In = "", timeP_Out = "";

                    items.forEach(it => {
                        totViaggio += it.viaggio;
                        types.add(it.tipo);

                        if (it.is_assenza) totAssenza += it.ore;
                        else totLavoro += it.ore;

                        let descText = "";
                        if (it.tipo === 'T' || (it.note && it.note.includes('[CANTIERE]'))) {
                            descText = (it.note || "").replace('[CANTIERE]', '').trim();
                        } else if (it.is_assenza) {
                            descText = it.note || "";
                        } else {
                            descText = "";
                        }

                        if (descText) labels.push(descText);

                        if (it.str_mattina_dalle) { timeM_In = it.str_mattina_dalle; timeM_Out = it.str_mattina_alle; }
                        if (it.str_pomeriggio_dalle) { timeP_In = it.str_pomeriggio_dalle; timeP_Out = it.str_pomeriggio_alle; }
                        if (it.assenza_mattina_dalle) { timeM_In = it.assenza_mattina_dalle; timeM_Out = it.assenza_mattina_alle; }
                        if (it.assenza_pomeriggio_dalle) { timeP_In = it.assenza_pomeriggio_dalle; timeP_Out = it.assenza_pomeriggio_alle; }
                    });

                    const Y = startY - ((day - 1) * rowH);

                    if (timeM_In) page.drawText(timeM_In, { x: CX.Col_M_In, y: Y, size: fs, font });
                    if (timeM_Out) page.drawText(timeM_Out, { x: CX.Col_M_Out, y: Y, size: fs, font });
                    if (timeP_In) page.drawText(timeP_In, { x: CX.Col_P_In, y: Y, size: fs, font });
                    if (timeP_Out) page.drawText(timeP_Out, { x: CX.Col_P_Out, y: Y, size: fs, font });

                    if (totLavoro > 0) {
                        const ord = totLavoro > 8 ? 8 : totLavoro;
                        const str = totLavoro > 8 ? totLavoro - 8 : 0;
                        page.drawText(ord.toString(), { x: CX.Ore, y: Y, size: fs, font });
                        if (str > 0) page.drawText(str.toString(), { x: CX.Straord, y: Y, size: fs, font });
                    }

                    if (totAssenza > 0) {
                        page.drawText(totAssenza.toString(), { x: CX.Perm, y: Y, size: fs, font });
                    }

                    const finalType = types.has('T') ? 'T' : 'O';
                    page.drawText(finalType, { x: CX.Tipo, y: Y, size: fs, font });

                    let fullDesc = labels.join(", ");
                    if (fullDesc.length > 55) fullDesc = fullDesc.substring(0, 52) + "..";
                    page.drawText(fullDesc, { x: CX.Desc, y: Y, size: fs, font });

                    if (totViaggio > 0) {
                        const v_andata = (totViaggio / 2);
                        const v_ritorno = (totViaggio / 2);
                        page.drawText(v_andata.toFixed(1), { x: CX.VA, y: Y, size: fs, font });
                        page.drawText(v_ritorno.toFixed(1), { x: CX.VR, y: Y, size: fs, font });
                    }
                }
            }

            const pdfBytes = await pdfDoc.save();
            this.state.currentPdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

            const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
            const pdf = await loadingTask.promise;
            const pdfPage = await pdf.getPage(1);
            const viewport = pdfPage.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await pdfPage.render({ canvasContext: context, viewport: viewport }).promise;
            this.dom.pdfPreviewImage.src = canvas.toDataURL('image/jpeg', 0.85);

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

    uploadPdf: async function () {
        const btn = this.dom.btnConfirmSave;
        btn.disabled = true;
        btn.textContent = "Caricamento...";

        try {
            const formData = new FormData();
            formData.append('pdf_file', this.state.currentPdfBlob, 'report.pdf');
            formData.append('mese', this.state.currentPdfMonth);
            formData.append('anno', this.state.currentPdfYear);

            // --- FIX ADMIN MODE: Override Utente ---
            if (this.state.adminMode) {
                formData.append('id_personale_override', this.state.targetUserId);
            }
            // ---------------------------------------

            const uploadRes = await apiFetch('/api/report/archive', { method: 'POST', body: formData });

            if (!uploadRes.ok) {
                const errJson = await uploadRes.json();
                throw new Error(errJson.error || "Errore sconosciuto dal server");
            }

            const result = await uploadRes.json();

            this.dom.stepPreview.style.display = 'none';
            this.dom.stepFinalActions.style.display = 'block';

            // FIX: Versione sicura
            const ver = result.version || 1;
            this.dom.pdfStatus.textContent = `Documento v${ver} salvato correttamente!`;

            // Configura Download Finale con NOME SIGNIFICATIVO
            this.dom.btnDownload.textContent = "Scarica Immagine";
            this.dom.btnDownload.onclick = async (e) => {
                e.preventDefault();
                try {
                    const blob = await this.convertPdfToImgBlob(result.url);
                    const imgUrl = URL.createObjectURL(blob);

                    const safeName = this.state.currentUser.nome_cognome.replace(/\s+/g, '_');
                    const fName = `Report_${this.state.currentPdfYear}_${this.state.currentPdfMonth}_${safeName}_v${ver}.jpg`;

                    const link = document.createElement('a');
                    link.href = imgUrl;
                    link.download = fName; // <-- NOME SIGNIFICATIVO
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } catch (err) { alert("Errore download img: " + err.message); }
            };

            // Configura WhatsApp
            // Configura WhatsApp
            if (result.url) {
                const waMsg = `Report ${this.state.currentUser.nome_cognome}: ${result.url}`;
                this.dom.btnWhatsapp.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(waMsg)}`;
                this.dom.btnWhatsapp.style.pointerEvents = 'auto';
                this.dom.btnWhatsapp.style.opacity = '1';
            } else {
                this.dom.btnWhatsapp.removeAttribute('href');
                this.dom.btnWhatsapp.style.pointerEvents = 'none';
                this.dom.btnWhatsapp.style.opacity = '0.5';
            }

            showSuccessFeedbackModal("Salvato", "Il PDF è stato archiviato.");

        } catch (e) {
            alert("Errore salvataggio: " + e.message);
            btn.disabled = false;
            btn.textContent = "💾 Salva e Archivia";
        }
    },

    resetPdfWorkflow: function () {
        this.dom.stepPreview.style.display = 'none';
        this.dom.stepFinalActions.style.display = 'none';
        this.dom.stepSelect.style.display = 'block';

        this.dom.pdfPreviewImage.src = '';
        this.state.currentPdfBlob = null;
        this.dom.btnConfirmSave.disabled = false;
        this.dom.btnConfirmSave.textContent = "💾 Salva e Archivia";

        this.checkExistingReport();
    }
};

document.addEventListener('DOMContentLoaded', () => PrintPage.init());