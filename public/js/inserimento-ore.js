// js/inserimento-ore.js

document.addEventListener('DOMContentLoaded', () => {
    // Seleziona gli elementi del DOM una sola volta per efficienza
    const openModalBtn = document.getElementById('openInsertHoursModalBtn');
    const closeModalBtn = document.getElementById('closeInsertHoursModalBtn');
    const cancelModalBtn = document.getElementById('cancelInsertHoursBtn');
    const modal = document.getElementById('insertHoursModal');

    const addToTableBtn = document.getElementById('add-to-table-btn');
    const saveHoursBtn = document.getElementById('saveHoursBtn');
    const provisionalTableBody = document.querySelector('#provisional-table tbody');
    
    // Campi del form di input
    const dateInput = document.getElementById('input-data');
    const operatorSelect = document.getElementById('input-operatore');
    const commessaSelect = document.getElementById('input-commessa');
    const lavorazioneSelect = document.getElementById('input-lavorazione');
    const oreInput = document.getElementById('input-ore');
    const descrizioneInput = document.getElementById('input-descrizione');
    const summaryFooter = document.getElementById('footer-summary');

    let dataLoaded = false; // Flag per caricare i dati dei select solo una volta

    // 1. GESTIONE APERTURA E CHIUSURA MODALE
    openModalBtn.addEventListener('click', async () => {
        modal.style.display = 'flex';
        // Imposta la data odierna come default
        dateInput.valueAsDate = new Date();
        
        // Carica i dati per i menu a tendina solo se non sono già stati caricati
        if (!dataLoaded) {
            await populateSelects();
            dataLoaded = true;
        }
    });

    const closeModal = () => {
        // Chiede conferma se ci sono dati non salvati
        if (provisionalTableBody.rows.length > 0) {
            if (!confirm("Ci sono dati non salvati nella tabella. Sei sicuro di voler chiudere? Le modifiche andranno perse.")) {
                return;
            }
        }
        modal.style.display = 'none';
        clearProvisionalTable(); // Pulisce la tabella alla chiusura
    };

    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);

    // 2. POPOLAMENTO DEI MENU A TENDINA (SELECTS)
    async function populateSelects() {
        try {
            // Utilizziamo Promise.all per eseguire le chiamate in parallelo
            const [operatoriRes, commesseRes, lavorazioniRes] = await Promise.all([
                apiFetch('/api/operatori'),
                apiFetch('/api/commesse'),
                apiFetch('/api/lavorazioni')
            ]);

            // Controlla che tutte le risposte siano andate a buon fine
            if (!operatoriRes.ok || !commesseRes.ok || !lavorazioniRes.ok) {
                throw new Error('Errore nel caricamento dei dati per i menu a tendina.');
            }

            const operatori = await operatoriRes.json();
            const commesse = await commesseRes.json();
            const lavorazioni = await lavorazioniRes.json();
            
            // Popola i select
            populateOptions(operatorSelect, operatori, 'operatore_id', 'nome', 'cognome');
            populateOptions(commessaSelect, commesse, 'commessa_id', 'nome_commessa');
            populateOptions(lavorazioneSelect, lavorazioni, 'lavorazione_id', 'nome_lavorazione');

        } catch (error) {
            console.error("Errore durante il popolamento dei select:", error);
            alert("Impossibile caricare i dati iniziali. Riprovare.");
        }
    }
    
    function populateOptions(selectElement, data, valueKey, textKey, textKey2 = '') {
        selectElement.innerHTML = '<option value="">Seleziona...</option>'; // Opzione di default
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueKey];
            option.textContent = item[textKey] + (textKey2 && item[textKey2] ? ` ${item[textKey2]}` : '');
            selectElement.appendChild(option);
        });
    }

    // 3. LOGICA TABELLA PROVVISORIA
    addToTableBtn.addEventListener('click', () => {
        // Validazione semplice
        if (!dateInput.value || !operatorSelect.value || !commessaSelect.value || !oreInput.value || parseFloat(oreInput.value) <= 0) {
            alert("Compilare almeno i campi Data, Operatore, Commessa e Ore (> 0).");
            return;
        }

        const newRow = provisionalTableBody.insertRow();
        newRow.innerHTML = `
            <td data-field="data">${dateInput.value}</td>
            <td data-field="operatore" data-id="${operatorSelect.value}">${operatorSelect.options[operatorSelect.selectedIndex].text}</td>
            <td data-field="commessa" data-id="${commessaSelect.value}">${commessaSelect.options[commessaSelect.selectedIndex].text}</td>
            <td data-field="lavorazione" data-id="${lavorazioneSelect.value}">${lavorazioneSelect.options[lavorazioneSelect.selectedIndex].text}</td>
            <td data-field="ore" class="editable">${parseFloat(oreInput.value).toFixed(1)}</td>
            <td data-field="descrizione" class="editable">${descrizioneInput.value}</td>
            <td>
                <button class="delete-row-btn">
                    <img src="img/trash-2.png" alt="Elimina">
                </button>
            </td>
        `;
        
        // Aggiungi l'evento per l'eliminazione della riga
        newRow.querySelector('.delete-row-btn').addEventListener('click', () => {
            newRow.remove();
            updateSummary();
        });

        resetInputForm();
        updateSummary();
    });

    function resetInputForm() {
        // Resetta solo i campi variabili, mantenendo la data
        operatorSelect.value = "";
        commessaSelect.value = "";
        lavorazioneSelect.value = "";
        oreInput.value = "";
        descrizioneInput.value = "";
        operatorSelect.focus(); // Sposta il focus sul primo campo da reinserire
    }

    function updateSummary() {
        const rowCount = provisionalTableBody.rows.length;
        let totalHours = 0;
        for (const row of provisionalTableBody.rows) {
            totalHours += parseFloat(row.cells[4].textContent);
        }
        summaryFooter.innerHTML = `<span>Righe Inserite: ${rowCount}</span> | <span>Totale Ore: ${totalHours.toFixed(1)}</span>`;
    }
    
    function clearProvisionalTable() {
        provisionalTableBody.innerHTML = '';
        updateSummary();
    }


    // 4. SALVATAGGIO FINALE NEL DATABASE
    saveHoursBtn.addEventListener('click', async () => {
        if (provisionalTableBody.rows.length === 0) {
            alert("Nessun dato da salvare.");
            return;
        }

        const dataToSend = [];
        for (const row of provisionalTableBody.rows) {
            const rowData = {
                data_lavoro: row.cells[0].textContent,
                operatore_id: row.cells[1].dataset.id,
                commessa_id: row.cells[2].dataset.id,
                lavorazione_id: row.cells[3].dataset.id,
                ore: parseFloat(row.cells[4].textContent),
                descrizione_dettaglio: row.cells[5].textContent
            };
            dataToSend.push(rowData);
        }

        try {
            const response = await apiFetch('/api/registrazioni/batch', {
                method: 'POST',
                body: JSON.stringify(dataToSend)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Errore durante il salvataggio dei dati.');
            }

            alert("Dati salvati con successo!");
            clearProvisionalTable();
            modal.style.display = 'none';

        } catch (error) {
            console.error("Errore nel salvataggio massivo:", error);
            alert(`Salvataggio fallito: ${error.message}`);
        }
    });

});