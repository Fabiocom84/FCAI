import { apiFetch, publicApiFetch } from './api-client.js'; // publicApiFetch serve per scaricare il template
import { showModal, showSuccessFeedbackModal } from './shared-ui.js';
import { supabase } from './supabase-client.js'; // Solo per utility se serve, ma usiamo API backend

const PrintPage = {
    state: {
        analysisData: null,
        templateBytes: null,
        currentUser: null,
        lastGeneratedBlob: null
    },

    dom: {
        monthSelect: document.getElementById('printMonth'),
        yearSelect: document.getElementById('printYear'),
        btnUpdate: document.getElementById('btnUpdateAnalysis'),
        btnGenerate: document.getElementById('btnGeneratePDF'),
        btnDownload: document.getElementById('btnDownloadPDF'),
        btnWhatsapp: document.getElementById('btnWhatsappPDF'),
        previewTableBody: document.getElementById('previewTableBody'),
        pdfActionsArea: document.getElementById('pdfActionsArea'),
        pdfStatusText: document.getElementById('pdfStatusText'),
        
        // KPI
        kpiWork: document.getElementById('kpiWorkHours'),
        kpiTravel: document.getElementById('kpiTravelHours'),
        kpiAbsence: document.getElementById('kpiAbsenceHours'),
        kpiTotal: document.getElementById('kpiTotalHours'),
        userName: document.getElementById('headerUserName')
    },

    init: async function() {
        this.loadUserInfo();
        this.populateDates();
        
        // Pre-carica il template PDF all'avvio per velocità
        this.loadTemplate();

        this.dom.btnUpdate.addEventListener('click', () => this.fetchData());
        this.dom.btnGenerate.addEventListener('click', () => this.generateAndArchive());
    },

    loadUserInfo: function() {
        try {
            const p = JSON.parse(localStorage.getItem('user_profile') || '{}');
            this.state.currentUser = p;
            if(p.nome_cognome) this.dom.userName.textContent = p.nome_cognome;
        } catch(e) {}
    },

    loadTemplate: async function() {
        try {
            // URL Pubblico del Template su Supabase
            const templateUrl = "https://mqfhsiezsorpdnskcsgw.supabase.co/storage/v1/object/public/templates/modello_presenze.pdf";
            const res = await fetch(templateUrl);
            if (!res.ok) throw new Error("Template non trovato");
            this.state.templateBytes = await res.arrayBuffer();
            console.log("PDF Template caricato in memoria.");
        } catch (e) {
            console.error("Errore template:", e);
            alert("Attenzione: Impossibile caricare il modello PDF.");
        }
    },

    populateDates: function() {
        const months = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
        months.forEach((m, i) => {
            const opt = document.createElement('option');
            opt.value = i + 1;
            opt.textContent = m;
            this.dom.monthSelect.appendChild(opt);
        });

        const currentYear = new Date().getFullYear();
        for (let y = currentYear - 1; y <= currentYear + 1; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if(y === currentYear) opt.selected = true;
            this.dom.yearSelect.appendChild(opt);
        }
        this.dom.monthSelect.value = new Date().getMonth() + 1;
    },

    fetchData: async function() {
        const m = this.dom.monthSelect.value;
        const y = this.dom.yearSelect.value;
        
        this.dom.previewTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Caricamento dati...</td></tr>';
        this.dom.pdfActionsArea.style.display = 'none';

        try {
            const res = await apiFetch(`/api/report/analyze?mese=${m}&anno=${y}`);
            const data = await res.json();
            
            this.state.analysisData = data; // Salva nello state per il generatore PDF
            
            // 1. Aggiorna KPI
            this.dom.kpiWork.textContent = data.kpi.lavorate.toFixed(1);
            this.dom.kpiTravel.textContent = data.kpi.viaggio.toFixed(1);
            this.dom.kpiAbsence.textContent = data.kpi.assenze.toFixed(1);
            this.dom.kpiTotal.textContent = data.kpi.totale.toFixed(1);
            
            // 2. Popola Tabella Anteprima
            this.renderPreviewTable(data.rows);
            
            // 3. Gestione Area PDF
            this.dom.pdfActionsArea.style.display = 'block';
            this.dom.btnDownload.style.display = 'none';
            this.dom.btnWhatsapp.style.display = 'none';
            
            if (data.existing_pdf) {
                const dateParts = data.existing_pdf.created_at.split('T')[0].split('-');
                const fmtDate = `${dateParts[2]}/${dateParts[1]}`;
                this.dom.pdfStatusText.innerHTML = `⚠️ Esiste già una <b>versione ${data.existing_pdf.versione}</b> creata il ${fmtDate}.<br>Puoi scaricarla o generarne una nuova (v${data.existing_pdf.versione + 1}).`;
                
                // Mostra subito i tasti download per la versione esistente
                this.dom.btnDownload.href = data.existing_pdf.public_url;
                this.dom.btnDownload.style.display = 'inline-flex';
                this.setupWhatsappLink(data.existing_pdf.public_url);
            } else {
                this.dom.pdfStatusText.textContent = "Nessun documento archiviato per questo mese.";
            }

        } catch (e) {
            console.error(e);
            this.dom.previewTableBody.innerHTML = `<tr><td colspan="3" style="color:red;">Errore: ${e.message}</td></tr>`;
        }
    },

    renderPreviewTable: function(rowsData) {
        this.dom.previewTableBody.innerHTML = '';
        const days = Object.keys(rowsData).sort((a,b) => parseInt(a)-parseInt(b));
        
        if (days.length === 0) {
            this.dom.previewTableBody.innerHTML = '<tr><td colspan="3" class="empty-msg">Nessuna attività registrata.</td></tr>';
            return;
        }

        days.forEach(d => {
            const items = rowsData[d];
            items.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${d}</td>
                    <td><b>${item.commessa}</b><br><small>${item.note || ''}</small></td>
                    <td>${item.ore}h ${item.viaggio > 0 ? `+ ${item.viaggio}h v.` : ''}</td>
                `;
                this.dom.previewTableBody.appendChild(tr);
            });
        });
    },

    // --- GENERATORE PDF ---
    generateAndArchive: async function() {
        if (!this.state.templateBytes) return alert("Template non ancora caricato. Riprova tra un secondo.");
        if (!this.state.analysisData) return alert("Fai prima l'analisi dei dati.");

        const btn = this.dom.btnGenerate;
        btn.disabled = true;
        btn.textContent = "⏳ Generazione...";

        try {
            // 1. Crea il PDF con pdf-lib
            const pdfDoc = await PDFLib.PDFDocument.load(this.state.templateBytes);
            const pages = pdfDoc.getPages();
            const firstPage = pages[0];
            const { width, height } = firstPage.getSize();
            
            // Font standard
            const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
            const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
            
            // --- LOGICA COORDINATE (Tarata sul tuo Modello) ---
            // Coordinate Base (da aggiustare facendo prove)
            const startY = 645; // Coordinata Y della riga "1" (giorno 1)
            const rowHeight = 15.6; // Altezza di ogni riga giorno
            
            const cols = {
                entrataMatt: 110,
                uscitaMatt: 150,
                entrataPom: 190,
                uscitaPom: 230,
                oreLavoro: 280,
                oreStraord: 310,
                permessi: 350,
                tipo: 385, // T/O/U
                commessa: 410,
                viaggioA: 535,
                viaggioR: 565
            };

            // Intestazione
            const mNames = ["GENNAIO","FEBBRAIO","MARZO","APRILE","MAGGIO","GIUGNO","LUGLIO","AGOSTO","SETTEMBRE","OTTOBRE","NOVEMBRE","DICEMBRE"];
            const mIndex = parseInt(this.dom.monthSelect.value) - 1;
            
            firstPage.drawText(this.state.currentUser.nome_cognome.toUpperCase(), { x: 90, y: 735, size: 10, font: fontBold });
            firstPage.drawText(mNames[mIndex], { x: 340, y: 735, size: 10, font: fontBold });
            firstPage.drawText(this.dom.yearSelect.value, { x: 530, y: 735, size: 10, font: fontBold });

            // Ciclo Giorni
            const rowsData = this.state.analysisData.rows;
            
            // Iteriamo da 1 a 31
            for (let day = 1; day <= 31; day++) {
                // Calcola Y per questo giorno (Il PDF ha righe fisse per 1..31)
                // Giorno 1 è in alto, giorno 31 in basso.
                // Formula: startY - ((day - 1) * rowHeight)
                const yPos = startY - ((day - 1) * rowHeight);
                
                if (rowsData[day]) {
                    // C'è attività in questo giorno
                    // Prendiamo la prima attività (se ce ne sono multiple concateniamo le note, ma sommiamo le ore)
                    // Nota: Per semplicità nel modulo cartaceo, sommiamo tutto su una riga.
                    
                    let totOre = 0;
                    let totViaggio = 0;
                    let descrizioni = [];
                    let tipi = new Set();
                    let isAssenza = false;

                    rowsData[day].forEach(r => {
                        totOre += r.ore;
                        totViaggio += r.viaggio;
                        if(r.commessa) descrizioni.push(r.commessa + (r.note ? ` (${r.note})` : ''));
                        tipi.add(r.tipo);
                        if(r.is_assenza) isAssenza = true;
                    });

                    // Scrittura Dati nella Riga
                    const fontSize = 8;
                    
                    // Colonna Ore Lavoro o Permessi
                    if (isAssenza) {
                        firstPage.drawText(totOre.toString(), { x: cols.permessi, y: yPos, size: fontSize, font });
                        // Se assenza scriviamo "FERIE" o simili nella descrizione
                    } else {
                        // Se > 8 ore, splittiamo in ordinario e straordinario?
                        // Per ora mettiamo tutto in ore lavoro come da tua app, o se vuoi gestire straord:
                        let ordinario = totOre > 8 ? 8 : totOre;
                        let straord = totOre > 8 ? totOre - 8 : 0;
                        
                        firstPage.drawText(ordinario.toString(), { x: cols.oreLavoro, y: yPos, size: fontSize, font });
                        if (straord > 0) firstPage.drawText(straord.toString(), { x: cols.oreStraord, y: yPos, size: fontSize, font });
                    }

                    // Colonna Tipo (T/O)
                    const tipoFin = tipi.has('T') ? 'T' : 'O';
                    firstPage.drawText(tipoFin, { x: cols.tipo, y: yPos, size: fontSize, font });

                    // Colonna Commessa
                    let textDesc = descrizioni.join(", ");
                    // Taglia se troppo lungo
                    if (textDesc.length > 35) textDesc = textDesc.substring(0, 33) + "..";
                    firstPage.drawText(textDesc, { x: cols.commessa, y: yPos, size: 7, font });

                    // Colonna Viaggio (Diviso A/R)
                    if (totViaggio > 0) {
                        const half = totViaggio / 2;
                        firstPage.drawText(half.toString(), { x: cols.viaggioA, y: yPos, size: fontSize, font });
                        firstPage.drawText(half.toString(), { x: cols.viaggioR, y: yPos, size: fontSize, font });
                    }
                }
            }

            // 2. Salva e Prepara Upload
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            
            // 3. Upload al Backend
            const formData = new FormData();
            formData.append('pdf_file', blob, 'report.pdf');
            formData.append('mese', this.dom.monthSelect.value);
            formData.append('anno', this.dom.yearSelect.value);

            btn.textContent = "☁️ Archiviazione...";
            
            const res = await apiFetch('/api/report/archive', {
                method: 'POST',
                body: formData // apiFetch gestisce automaticamente il content-type per FormData
            });

            const result = await res.json();
            
            // 4. Successo
            btn.textContent = "✅ Fatto!";
            setTimeout(() => { 
                btn.textContent = "📄 Genera & Archivia PDF"; 
                btn.disabled = false; 
            }, 3000);

            this.dom.pdfStatusText.textContent = `Nuova versione (v${result.version}) archiviata con successo!`;
            this.dom.btnDownload.href = result.url;
            this.dom.btnDownload.style.display = 'inline-flex';
            this.setupWhatsappLink(result.url);

            showSuccessFeedbackModal("Archiviato", "Il PDF è stato salvato in cloud.");

        } catch (e) {
            console.error(e);
            alert("Errore generazione/upload: " + e.message);
            btn.disabled = false;
            btn.textContent = "📄 Genera & Archivia PDF";
        }
    },

    setupWhatsappLink: function(url) {
        const msg = `Ciao, ecco il mio report presenze per ${this.dom.monthSelect.options[this.dom.monthSelect.selectedIndex].text} ${this.dom.yearSelect.value}: ${url}`;
        const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
        this.dom.btnWhatsapp.href = waUrl;
        this.dom.btnWhatsapp.style.display = 'inline-flex';
    }
};

document.addEventListener('DOMContentLoaded', () => PrintPage.init());