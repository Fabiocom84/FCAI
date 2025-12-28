import { apiFetch, publicApiFetch } from './api-client.js';
import { showModal, showSuccessFeedbackModal } from './shared-ui.js';

const PrintPage = {
    state: {
        rawData: [],        // Dati scaricati dal server
        filteredData: [],   // Dati attualmente visibili
        choicesCommesse: null,
        choicesComponenti: null,
        currentView: 'list', // 'list' o 'group'
        templateBytes: null,
        currentUser: null
    },

    dom: {
        // Date Analisi
        dateStart: document.getElementById('dateStart'),
        dateEnd: document.getElementById('dateEnd'),
        btnLoad: document.getElementById('btnLoadData'),
        
        // Filtri Avanzati
        accordionBtn: document.getElementById('btnToggleFilters'),
        accordionContent: document.getElementById('advancedFiltersBox'),
        selCommesse: document.getElementById('filterCommesse'),
        selComponenti: document.getElementById('filterComponenti'),
        btnApplyFilters: document.getElementById('btnApplyFilters'),
        
        // Viste
        viewBtns: document.querySelectorAll('.view-btn'),
        tableHead: document.getElementById('tableHead'),
        tableBody: document.getElementById('tableBody'),
        
        // KPI
        kpiWork: document.getElementById('kpiWorkHours'),
        kpiTravel: document.getElementById('kpiTravelHours'),
        kpiAbsence: document.getElementById('kpiAbsenceHours'),
        kpiTotal: document.getElementById('kpiTotalHours'),
        
        // PDF Ufficiale
        pdfMonth: document.getElementById('pdfMonth'),
        pdfYear: document.getElementById('pdfYear'),
        btnGenerate: document.getElementById('btnGeneratePDF'),
        pdfActions: document.getElementById('pdfActions'),
        pdfStatus: document.getElementById('pdfStatus'),
        btnDownload: document.getElementById('btnDownload'),
        btnWhatsapp: document.getElementById('btnWhatsapp'),
        
        userName: document.getElementById('headerUserName')
    },

    init: async function() {
        console.log("📊 Analytics Page Init");
        this.loadUserInfo();
        this.setupDates();
        this.initChoices();
        this.loadTemplate(); // Pre-carica template PDF

        // Listeners
        this.dom.btnLoad.addEventListener('click', () => this.loadAnalysisData());
        this.dom.accordionBtn.addEventListener('click', () => this.toggleAccordion());
        this.dom.btnApplyFilters.addEventListener('click', () => this.applyFilters());
        
        this.dom.viewBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.dom.viewBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.state.currentView = e.target.dataset.view;
                this.renderTable();
            });
        });

        this.dom.btnGenerate.addEventListener('click', () => this.handlePdfGeneration());
        
        // Caricamento automatico iniziale (ultimi 30gg)
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
        // Analisi: Default ultimi 90 giorni
        const today = new Date();
        const past = new Date();
        past.setDate(today.getDate() - 90);
        
        this.dom.dateEnd.value = today.toISOString().split('T')[0];
        this.dom.dateStart.value = past.toISOString().split('T')[0];

        // PDF: Popola Select Mese/Anno
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
        const config = {
            removeItemButton: true,
            searchEnabled: true,
            placeholder: true,
            placeholderValue: 'Seleziona...',
            itemSelectText: ''
        };
        this.state.choicesCommesse = new Choices(this.dom.selCommesse, config);
        this.state.choicesComponenti = new Choices(this.dom.selComponenti, config);
        
        // Ascolta i cambiamenti per filtro live (opzionale, ora usiamo il tasto Applica)
        // this.dom.selCommesse.addEventListener('change', () => this.applyFilters());
    },

    toggleAccordion: function() {
        const content = this.dom.accordionContent;
        const arrow = this.dom.accordionBtn.querySelector('.arrow');
        if (content.style.display === 'none') {
            content.style.display = 'block';
            arrow.textContent = '▲';
        } else {
            content.style.display = 'none';
            arrow.textContent = '▼';
        }
    },

    // --- CARICAMENTO DATI (Backend) ---
    loadAnalysisData: async function() {
        const start = this.dom.dateStart.value;
        const end = this.dom.dateEnd.value;
        
        this.dom.btnLoad.disabled = true;
        this.dom.btnLoad.textContent = "⏳ Caricamento...";
        this.dom.tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">Caricamento dati dal server...</td></tr>';

        try {
            const res = await apiFetch(`/api/report/analyze?start=${start}&end=${end}`);
            const payload = await res.json();
            
            this.state.rawData = payload.data || [];
            this.state.filteredData = [...this.state.rawData]; // Reset filtri
            
            this.populateFilterOptions();
            this.applyFilters(); // Calcola KPI e Renderizza
            
        } catch (e) {
            console.error(e);
            alert("Errore caricamento dati: " + e.message);
        } finally {
            this.dom.btnLoad.disabled = false;
            this.dom.btnLoad.textContent = "🔄 Carica Dati";
        }
    },

    populateFilterOptions: function() {
        // Estrae liste univoche dai dati caricati
        const commesseMap = new Map();
        const compMap = new Map();

        this.state.rawData.forEach(row => {
            if (row.id_commessa && !commesseMap.has(row.id_commessa)) {
                commesseMap.set(row.id_commessa, row.label_commessa);
            }
            if (row.id_componente && !compMap.has(row.id_componente)) {
                compMap.set(row.id_componente, row.label_componente);
            }
        });

        const commesseChoices = Array.from(commesseMap).map(([val, label]) => ({ value: val, label: label }));
        const compChoices = Array.from(compMap).map(([val, label]) => ({ value: val, label: label }));

        this.state.choicesCommesse.setChoices(commesseChoices, 'value', 'label', true);
        this.state.choicesComponenti.setChoices(compChoices, 'value', 'label', true);
    },

    // --- FILTRAGGIO LOCALE ---
    applyFilters: function() {
        const selectedCommesse = this.state.choicesCommesse.getValue(true); // Array di ID
        const selectedComp = this.state.choicesComponenti.getValue(true);   // Array di ID

        this.state.filteredData = this.state.rawData.filter(row => {
            // 1. Filtro Commessa
            if (selectedCommesse.length > 0) {
                // Se la riga non ha commessa (es. Assenza) e filtro attivo, la nascondiamo? 
                // O consideriamo "Assenza" un tipo speciale? Per ora filtraggio stretto.
                if (!selectedCommesse.includes(row.id_commessa)) return false;
            }
            // 2. Filtro Componente
            if (selectedComp.length > 0) {
                if (!selectedComp.includes(row.id_componente)) return false;
            }
            return true;
        });

        this.calculateKPI();
        this.renderTable();
    },

    calculateKPI: function() {
        let work = 0, travel = 0, abs = 0;
        
        this.state.filteredData.forEach(row => {
            travel += row.viaggio;
            if (row.is_assenza) {
                abs += row.ore;
            } else {
                work += row.ore;
            }
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
            tbody.innerHTML = '<tr><td colspan="3" class="empty-msg">Nessun dato trovato con i filtri attuali.</td></tr>';
            return;
        }

        if (view === 'list') {
            // VISTA LISTA CRONOLOGICA
            thead.innerHTML = '<tr><th width="20%">Data</th><th>Attività</th><th width="15%">Ore</th></tr>';
            
            this.state.filteredData.forEach(row => {
                const dateParts = row.data.split('-');
                const shortDate = `${dateParts[2]}/${dateParts[1]}`;
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><b>${shortDate}</b></td>
                    <td>
                        <div style="font-weight:500; font-size:0.9em;">${row.label_commessa}</div>
                        <div style="font-size:0.8em; color:#666;">${row.label_componente} ${row.note ? `(${row.note})` : ''}</div>
                    </td>
                    <td style="text-align:center;">
                        <span style="font-weight:bold;">${row.ore}</span>
                        ${row.viaggio > 0 ? `<div style="font-size:0.7em; color:#9b59b6;">+${row.viaggio}v</div>` : ''}
                    </td>
                `;
                tbody.appendChild(tr);
            });

        } else {
            // VISTA RAGGRUPPATA PER COMMESSA
            thead.innerHTML = '<tr><th>Commessa</th><th style="text-align:right;">Ore Lav.</th><th style="text-align:right;">Viaggio</th></tr>';
            
            // Raggruppamento
            const groups = {};
            this.state.filteredData.forEach(row => {
                const key = row.label_commessa; // Raggruppa per nome visuale
                if (!groups[key]) groups[key] = { hours: 0, travel: 0, count: 0 };
                
                if (row.is_assenza) {
                    // Opzionale: Raggruppare le assenze a parte o sotto "Generico"
                } 
                groups[key].hours += row.ore;
                groups[key].travel += row.viaggio;
                groups[key].count++;
            });

            // Ordinamento per ore decrescenti
            const sortedKeys = Object.keys(groups).sort((a,b) => groups[b].hours - groups[a].hours);

            sortedKeys.forEach(k => {
                const g = groups[k];
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div style="font-weight:bold; color:#2c3e50;">${k}</div>
                        <div style="font-size:0.75em; color:#888;">${g.count} registrazioni</div>
                    </td>
                    <td style="text-align:right; font-size:1.1em; color:#2980b9;"><b>${g.hours.toFixed(1)}</b></td>
                    <td style="text-align:right; color:#8e44ad;">${g.travel > 0 ? g.travel.toFixed(1) : '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    },

    // ============================================================
    // SEZIONE PDF (Indipendente dall'analisi)
    // ============================================================

    loadTemplate: async function() {
        try {
            // URL Pubblico del Template su Supabase (Bucket 'templates')
            const templateUrl = "https://mqfhsiezsorpdnskcsgw.supabase.co/storage/v1/object/public/templates/modello_presenze.pdf";
            const res = await fetch(templateUrl);
            if (!res.ok) throw new Error("Template PDF non trovato");
            this.state.templateBytes = await res.arrayBuffer();
        } catch (e) {
            console.error("PDF Load Error:", e);
        }
    },

    handlePdfGeneration: async function() {
        if (!this.state.templateBytes) return alert("Il modello PDF non è stato caricato. Ricarica la pagina.");
        
        const month = parseInt(this.dom.pdfMonth.value);
        const year = parseInt(this.dom.pdfYear.value);
        const btn = this.dom.btnGenerate;

        btn.disabled = true;
        btn.textContent = "⏳ Elaborazione...";
        this.dom.pdfActions.style.display = 'none';

        try {
            // 1. Fetch Dati SPECIFICI per quel mese (ignoriamo i filtri analisi per sicurezza)
            // Calcolo date esatte inizio/fine mese
            const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
            const endDateObj = new Date(year, month, 0); // Ultimo giorno del mese
            const endDate = endDateObj.toISOString().split('T')[0];

            const res = await apiFetch(`/api/report/analyze?start=${startDate}&end=${endDate}`);
            const payload = await res.json();
            const monthData = payload.data || [];

            // 2. Raggruppa i dati per Giorno (per il modulo cartaceo)
            const rowsByDay = {};
            for (let d = 1; d <= 31; d++) rowsByDay[d] = [];

            monthData.forEach(row => {
                const dayNum = parseInt(row.data.split('-')[2]);
                rowsByDay[dayNum].push(row);
            });

            // 3. Disegna il PDF
            const pdfDoc = await PDFLib.PDFDocument.load(this.state.templateBytes);
            const page = pdfDoc.getPages()[0];
            const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
            const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

            // Intestazione
            const mNames = ["GENNAIO","FEBBRAIO","MARZO","APRILE","MAGGIO","GIUGNO","LUGLIO","AGOSTO","SETTEMBRE","OTTOBRE","NOVEMBRE","DICEMBRE"];
            
            page.drawText(this.state.currentUser.nome_cognome.toUpperCase(), { x: 90, y: 735, size: 10, font: fontBold });
            page.drawText(mNames[month - 1], { x: 340, y: 735, size: 10, font: fontBold });
            page.drawText(year.toString(), { x: 530, y: 735, size: 10, font: fontBold });

            // Griglia Giorni
            const startY = 645;
            const rowH = 15.6;
            
            // Coordinate X delle colonne (Tarate sul modello)
            const CX = { Ore: 280, Straord: 310, Perm: 350, Tipo: 385, Desc: 410, VA: 535, VR: 565 };

            for (let day = 1; day <= 31; day++) {
                const items = rowsByDay[day];
                if (items.length > 0) {
                    let totOre = 0;
                    let totViaggio = 0;
                    let labels = [];
                    let types = new Set();
                    let isAbs = false;

                    items.forEach(it => {
                        totOre += it.ore;
                        totViaggio += it.viaggio;
                        labels.push(it.label_commessa + (it.note ? ` (${it.note})` : ''));
                        types.add(it.tipo); // T o O
                        if (it.is_assenza) isAbs = true;
                    });

                    const Y = startY - ((day - 1) * rowH);
                    const fs = 8; // font size

                    // Scrittura
                    if (isAbs) {
                        page.drawText(totOre.toString(), { x: CX.Perm, y: Y, size: fs, font });
                    } else {
                        // Gestione Straordinari Semplice (>8h)
                        const ord = totOre > 8 ? 8 : totOre;
                        const str = totOre > 8 ? totOre - 8 : 0;
                        page.drawText(ord.toString(), { x: CX.Ore, y: Y, size: fs, font });
                        if (str > 0) page.drawText(str.toString(), { x: CX.Straord, y: Y, size: fs, font });
                    }

                    // Tipo
                    const finalType = types.has('T') ? 'T' : 'O';
                    page.drawText(finalType, { x: CX.Tipo, y: Y, size: fs, font });

                    // Descrizione (Tagliata se lunga)
                    let fullDesc = labels.join(", ");
                    if (fullDesc.length > 40) fullDesc = fullDesc.substring(0, 38) + "..";
                    page.drawText(fullDesc, { x: CX.Desc, y: Y, size: 7, font }); // font più piccolo

                    // Viaggio (Diviso A/R)
                    if (totViaggio > 0) {
                        const half = (totViaggio / 2).toFixed(1).replace('.0',''); // Es. 1.5 -> 0.75 (visualizzato 0.8)
                        // Oppure dividiamo brutalmente
                        const v = totViaggio / 2;
                        page.drawText(v.toString(), { x: CX.VA, y: Y, size: fs, font });
                        page.drawText(v.toString(), { x: CX.VR, y: Y, size: fs, font });
                    }
                }
            }

            // 4. Salva e Carica
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            
            const formData = new FormData();
            formData.append('pdf_file', blob, 'report.pdf');
            formData.append('mese', month);
            formData.append('anno', year);

            btn.textContent = "☁️ Archiviazione...";
            
            const uploadRes = await apiFetch('/api/report/archive', {
                method: 'POST',
                body: formData
            });
            const result = await uploadRes.json();

            // 5. Aggiorna UI
            btn.textContent = "✅ Fatto!";
            this.dom.pdfStatus.textContent = `Documento v${result.version} salvato.`;
            this.dom.btnDownload.href = result.url;
            this.dom.pdfActions.style.display = 'block';
            
            // Link WhatsApp
            const waMsg = `Ciao, invio report presenze ${mNames[month-1]} ${year}: ${result.url}`;
            this.dom.btnWhatsapp.href = `https://wa.me/?text=${encodeURIComponent(waMsg)}`;

            showSuccessFeedbackModal("Creato", "PDF Generato e Archiviato.");

        } catch (e) {
            console.error(e);
            alert("Errore: " + e.message);
        } finally {
            setTimeout(() => { 
                btn.disabled = false; 
                btn.textContent = "Crea PDF"; 
            }, 3000);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => PrintPage.init());