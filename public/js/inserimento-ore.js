// js/inserimento-ore.js

document.addEventListener('DOMContentLoaded', () => {
    // --- SELEZIONE ELEMENTI DEL DOM ---
    // (Il codice di selezione elementi rimane invariato)
    const openModalBtn = document.getElementById('openInsertHoursModalBtn');
    const modal = document.getElementById('insertHoursModal');
    const closeModalBtn = document.getElementById('closeInsertHoursModalBtn');
    
    const giornoInput = document.getElementById('input-giorno');
    const operatoreSelect = document.getElementById('input-operatore');
    const oreInput = document.getElementById('input-ore');
    const etichettaSelect = document.getElementById('input-etichetta');
    const descrizioneSelect = document.getElementById('input-descrizione');
    const noteInput = document.getElementById('input-note');

    const personnelList = document.getElementById('personnel-feedback-list');
    const provisionalTableBody = document.getElementById('provisional-table-body');
    
    const addToTableBtn = document.getElementById('add-to-table-btn');
    const saveHoursBtn = document.getElementById('saveHoursBtn');
    
    const summaryFooter = document.getElementById('footer-summary');

    let initialDataLoaded = false;

    // --- FUNZIONI DI UTILITÀ ---
    
    /**
     * Calcola il giorno lavorativo precedente.
     * Es: Lunedì -> Venerdì precedente, Domenica -> Venerdì precedente.
     * @returns {Date} Oggetto Date del giorno lavorativo precedente.
     */
    function getPreviousWorkingDay() {
        const today = new Date();
        today.setDate(today.getDate() - 1); // Inizia sottraendo un giorno

        const dayOfWeek = today.getDay(); // 0=Domenica, 1=Lunedì, ..., 6=Sabato

        if (dayOfWeek === 0) { // Se è Domenica
            today.setDate(today.getDate() - 2); // Sottrai altri 2 giorni per arrivare a Venerdì
        } else if (dayOfWeek === 6) { // Se è Sabato
            today.setDate(today.getDate() - 1); // Sottrai un altro giorno per arrivare a Venerdì
        }
        return today;
    }

    // --- GESTIONE MODALE ---

    openModalBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
        giornoInput.valueAsDate = getPreviousWorkingDay();
        
        if (!initialDataLoaded) {
            populateInitialData();
            initialDataLoaded = true;
        }
    });

    const closeModal = () => {
        if (provisionalTableBody.rows.length > 0) {
            if (!confirm("Ci sono dati non salvati. Sei sicuro di voler chiudere? Le modifiche andranno perse.")) {
                return;
            }
        }
        modal.style.display = 'none';
        clearProvisionalTable();
    };

    closeModalBtn.addEventListener('click', closeModal);

    // --- CARICAMENTO DATI INIZIALI ---
    
    // Funzione mock per simulare una chiamata API
    const mockApiFetch = (endpoint) => {
        return new Promise(resolve => {
            let data = [];
            if (endpoint === '/api/operatori') {
                data = [
                    { id: 1, nome: 'Mario Rossi' }, { id: 2, nome: 'Luca Bianchi' },
                    { id: 3, nome: 'Anna Verdi' }, { id: 4, nome: 'Paolo Neri' }
                ];
            } else if (endpoint === '/api/etichette') {
                data = [ { id: 101, nome: 'Standard' }, { id: 102, nome: 'Urgente' }, { id: 103, nome: 'Manutenzione' } ];
            } else if (endpoint === '/api/descrizioni') {
                data = [ { id: 201, nome: 'Assemblaggio' }, { id: 202, nome: 'Controllo Qualità' }, { id: 203, nome: 'Imballaggio' } ];
            }
            resolve(data);
        });
    };

    async function populateInitialData() {
        try {
            const [operatori, etichette, descrizioni] = await Promise.all([
                mockApiFetch('/api/operatori'),
                mockApiFetch('/api/etichette'), // Simula chiamata a Google Sheets
                mockApiFetch('/api/descrizioni')
            ]);

            populateSelect(operatoreSelect, operatori, 'id', 'nome');
            populateSelect(etichettaSelect, etichette, 'id', 'nome');
            populateSelect(descrizioneSelect, descrizioni, 'id', 'nome');
            
            populatePersonnelList(operatori);

        } catch (error) {
            console.error("Errore nel caricamento dei dati iniziali:", error);
            alert("Impossibile caricare i dati. Riprova più tardi.");
        }
    }

    function populateSelect(selectElement, data, valueKey, textKey) {
        selectElement.innerHTML = '<option value="">Seleziona...</option>';
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueKey];
            option.textContent = item[textKey];
            selectElement.appendChild(option);
        });
    }

    function populatePersonnelList(operatori) {
        personnelList.innerHTML = '';
        operatori.forEach(op => {
            const li = document.createElement('li');
            li.dataset.operatorId = op.id;
            li.innerHTML = `
                <span>${op.nome}</span>
                <span class="entry-count-badge">0</span>
            `;
            personnelList.appendChild(li);
        });
    }

    // --- LOGICA TABELLA PROVVISORIA E FEEDBACK ---

    addToTableBtn.addEventListener('click', () => {
        if (!giornoInput.value || !operatoreSelect.value || !oreInput.value || parseFloat(oreInput.value) <= 0) {
            alert("Compilare almeno i campi Giorno, Operatore e Ore (> 0).");
            return;
        }

        const newRow = provisionalTableBody.insertRow();
        newRow.dataset.operatorId = operatoreSelect.value; // Aggiungiamo l'ID operatore alla riga per un facile accesso

        newRow.innerHTML = `
            <td>${giornoInput.value}</td>
            <td data-id="${operatoreSelect.value}">${operatoreSelect.options[operatoreSelect.selectedIndex].text}</td>
            <td>${parseFloat(oreInput.value).toFixed(1)}</td>
            <td data-id="${etichettaSelect.value}">${etichettaSelect.options[etichettaSelect.selectedIndex].text}</td>
            <td data-id="${descrizioneSelect.value}">${descrizioneSelect.options[descrizioneSelect.selectedIndex].text}</td>
            <td>${noteInput.value}</td>
            <td>
                <button class="delete-row-btn" style="background:none; border:none; cursor:pointer;">
                    <img src="img/trash-2.png" alt="Elimina" style="width:16px; height:16px;">
                </button>
            </td>
        `;

        newRow.querySelector('.delete-row-btn').addEventListener('click', () => {
            newRow.remove();
            updateAll();
        });

        resetInputForm();
        updateAll();
    });

    function resetInputForm() {
        operatoreSelect.value = "";
        oreInput.value = "";
        etichettaSelect.value = "";
        descrizioneSelect.value = "";
        noteInput.value = "";
        operatoreSelect.focus();
    }
    
    function updateAll() {
        updateFeedbackCounters();
        updateSummary();
    }
    
    function updateFeedbackCounters() {
        const counts = {};
        // 1. Conta le occorrenze di ogni operatore nella tabella
        for (const row of provisionalTableBody.rows) {
            const operatorId = row.dataset.operatorId;
            counts[operatorId] = (counts[operatorId] || 0) + 1;
        }

        // 2. Aggiorna la lista del personale con i conteggi e il colore
        const listItems = personnelList.querySelectorAll('li');
        listItems.forEach(li => {
            const operatorId = li.dataset.operatorId;
            const badge = li.querySelector('.entry-count-badge');
            const count = counts[operatorId] || 0;

            if (count > 0) {
                badge.textContent = count;
                badge.classList.add('visible');
                li.classList.add('inserted'); // NUOVO: Aggiunge la classe per il colore rosso
            } else {
                badge.classList.remove('visible');
                li.classList.remove('inserted'); // NUOVO: Rimuove la classe
            }
        });
    }
    
    function updateSummary() {
        const rowCount = provisionalTableBody.rows.length;
        let totalHours = 0;
        for (const row of provisionalTableBody.rows) {
            totalHours += parseFloat(row.cells[2].textContent);
        }
        summaryFooter.innerHTML = `<span>Righe Inserite: ${rowCount}</span> | <span>Totale Ore: ${totalHours.toFixed(1)}</span>`;
    }

    function clearProvisionalTable() {
        provisionalTableBody.innerHTML = '';
        updateAll();
    }

    // --- SALVATAGGIO FINALE ---
    saveHoursBtn.addEventListener('click', () => {
        if (provisionalTableBody.rows.length === 0) {
            alert("Nessun dato da salvare.");
            return;
        }
        
        const dataToSend = Array.from(provisionalTableBody.rows).map(row => ({
            giorno: row.cells[0].textContent,
            operatore_id: row.cells[1].dataset.id,
            ore: parseFloat(row.cells[2].textContent),
            etichetta_id: row.cells[3].dataset.id,
            descrizione_id: row.cells[4].dataset.id,
            note: row.cells[5].textContent,
        }));

        console.log("Dati pronti per il salvataggio:", dataToSend);
        alert(`Dati pronti per essere inviati! (${dataToSend.length} righe)`);
        
        // QUI VA LA LOGICA DI CHIAMATA API PER IL SALVATAGGIO
        // Esempio:
        /*
        apiFetch('/api/salva-ore', { method: 'POST', body: JSON.stringify(dataToSend) })
            .then(response => {
                if (response.ok) {
                    alert("Salvataggio completato con successo!");
                    clearProvisionalTable();
                    closeModal();
                } else {
                    alert("Errore durante il salvataggio.");
                }
            });
        */
       
       // Per ora, simuliamo il successo
       clearProvisionalTable();
       modal.style.display = 'none';
    });
});