// js/inserimento-ore.js (Versione 2.4)

import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- SELEZIONE ELEMENTI DEL DOM (invariata) ---
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

    // --- FUNZIONI DI UTILITÀ (invariate) ---
    function getPreviousWorkingDay() {
        const today = new Date();
        const currentDay = today.getDay(); // 0=Domenica, 1=Lunedì...
        
        // Oggi è il 9 Settembre 2025, che è un Martedì (giorno 2)
        // Il giorno lavorativo precedente è Lunedì 8.
        let daysToSubtract = 1;
        if (currentDay === 1) { // Se è Lunedì
            daysToSubtract = 3; // Vai a Venerdì
        } else if (currentDay === 0) { // Se è Domenica
            daysToSubtract = 2; // Vai a Venerdì
        }
        today.setDate(today.getDate() - daysToSubtract);
        return today;
    }
    
    // --- GESTIONE MODALE (invariata) ---
    openModalBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
        giornoInput.valueAsDate = getPreviousWorkingDay();
        if (!initialDataLoaded) { populateInitialData(); initialDataLoaded = true; }
    });

    const closeModal = () => {
        if (provisionalTableBody.rows.length > 0) {
            if (!confirm("Ci sono dati non salvati. Sei sicuro di voler chiudere?")) { return; }
        }
        modal.style.display = 'none';
        clearProvisionalTable();
    };
    closeModalBtn.addEventListener('click', closeModal);

    function populateSelect(selectElement, data, valueKey, textKey) {
        // Pulisce le opzioni esistenti e aggiunge quella di default
        selectElement.innerHTML = '<option value="">Seleziona...</option>';
        
        // Aggiunge un'opzione per ogni elemento ricevuto dai dati
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueKey];
            option.textContent = item[textKey];
            selectElement.appendChild(option);
        });
    }
    
    async function populateInitialData() {
        try {
            // 1. Carica il personale attivo dalla tabella 'personale'
            const { data: operatori, error: errorOperatori } = await supabase
                .from('personale')
                .select('*')
                .eq('attivo', true); // Seleziona solo il personale 'attivo'
            if (errorOperatori) throw errorOperatori;

            // 2. Carica le etichette dalla tabella 'etichette'
            const { data: etichette, error: errorEtichette } = await supabase
                .from('etichette')
                .select('*');
            if (errorEtichette) throw errorEtichette;

            // 3. Carica le descrizioni dalla tabella 'descrizioni_lavoro'
            const { data: descrizioni, error: errorDescrizioni } = await supabase
                .from('descrizioni_lavoro')
                .select('*');
            if (errorDescrizioni) throw errorDescrizioni;

            // Popola i menu a tendina e la lista con i dati reali
            populateSelect(operatoreSelect, operatori, 'id_personale', 'nome_cognome');
            populateSelect(etichettaSelect, etichette, 'id_etichetta', 'nome_etichetta');
            populateSelect(descrizioneSelect, descrizioni, 'id_descrizione', 'nome_descrizione');

            populatePersonnelList(operatori);

        } catch (error) {
            console.error("Errore nel caricamento dei dati da Supabase:", error);
            alert("Impossibile caricare i dati dal database. Controlla la console per i dettagli.");
        }
    }   

    /**
     * MODIFICATO: Aggiunto event listener per pre-caricare l'operatore al click.
     */
    function populatePersonnelList(operatori) {
        personnelList.innerHTML = '';
        operatori.forEach(op => {
            const li = document.createElement('li');
            li.dataset.operatorId = op.id;
            li.style.cursor = 'pointer'; // Aggiunge il cursore a puntatore
            li.innerHTML = `<span>${op.nome}</span><span class="entry-count-badge">0</span>`;
            
            // NUOVO: Aggiungi l'evento click
            li.addEventListener('click', () => {
                operatoreSelect.value = op.id;
            });

            personnelList.appendChild(li);
        });
    }

    // --- LOGICA TABELLA PROVVISORIA ---
    
    addToTableBtn.addEventListener('click', () => {
    if (!giornoInput.value || !operatoreSelect.value || !oreInput.value || parseFloat(oreInput.value) <= 0) {
        alert("Compilare almeno i campi Giorno, Operatore e Ore (> 0).");
        return;
    }

    const newRow = provisionalTableBody.insertRow();
    newRow.dataset.operatorId = operatoreSelect.value;

    // MODIFICATO: Aggiunto l'attributo 'data-label' a ogni cella per la vista mobile
    newRow.innerHTML = `
        <td data-label="Giorno:" data-field="giorno">${giornoInput.value}</td>
        <td data-label="Operatore:" data-field="operatore" data-id="${operatoreSelect.value}">${operatoreSelect.options[operatoreSelect.selectedIndex].text}</td>
        <td data-label="Ore:" data-field="ore">${parseFloat(oreInput.value).toFixed(1)}</td>
        <td data-label="Etichetta:" data-field="etichetta" data-id="${etichettaSelect.value}">${etichettaSelect.options[etichettaSelect.selectedIndex].text}</td>
        <td data-label="Descrizione:" data-field="descrizione" data-id="${descrizioneSelect.value}">${descrizioneSelect.options[descrizioneSelect.selectedIndex].text}</td>
        <td data-label="Note:" data-field="note">${noteInput.value}</td>
        <td>
            <button class="delete-row-btn" style="background:none; border:none; cursor:pointer;" title="Elimina Riga">
                <img src="img/trash-2.png" alt="Elimina">
            </button>
        </td>
        `;

        // Listener per il pulsante Elimina appena creato
        newRow.querySelector('.delete-row-btn').addEventListener('click', () => {
            newRow.remove();
            updateAll(); // Aggiorna i totali e i badge
        });
    
        resetInputForm();
        updateAll();
    });

    // --- AGGIORNAMENTO UI ---
    function resetInputForm() { /* ... (invariata) ... */ 
        operatoreSelect.value = ""; oreInput.value = ""; etichettaSelect.value = "";
        descrizioneSelect.value = ""; noteInput.value = ""; operatoreSelect.focus();
    }
    
    function updateAll() {
        updateFeedbackHours(); // Nome funzione cambiato per chiarezza
        updateSummary();
    }
    
    /**
     * MODIFICATO: Ora calcola la SOMMA DELLE ORE, non il conteggio delle righe.
     */
    function updateFeedbackHours() {
        const hoursByOperator = {};
        for (const row of provisionalTableBody.rows) {
            const operatorId = row.dataset.operatorId;
            const hours = parseFloat(row.cells[2].textContent) || 0;
            hoursByOperator[operatorId] = (hoursByOperator[operatorId] || 0) + hours;
        }

        const listItems = personnelList.querySelectorAll('li');
        listItems.forEach(li => {
            const operatorId = li.dataset.operatorId;
            const badge = li.querySelector('.entry-count-badge');
            const totalHours = hoursByOperator[operatorId] || 0;

            if (totalHours > 0) {
                badge.textContent = totalHours.toFixed(1);
                badge.classList.add('visible');
                li.classList.add('inserted');
            } else {
                badge.classList.remove('visible');
                li.classList.remove('inserted');
            }
        });
    }
    
    function updateSummary() { /* ... (invariata) ... */ 
        const rowCount = provisionalTableBody.rows.length;
        let totalHours = 0;
        for (const row of provisionalTableBody.rows) {
            totalHours += parseFloat(row.cells[2].textContent) || 0;
        }
        summaryFooter.innerHTML = `<span>Righe Inserite: ${rowCount}</span> | <span>Totale Ore: ${totalHours.toFixed(1)}</span>`;
    }

    function clearProvisionalTable() { provisionalTableBody.innerHTML = ''; updateAll(); }

    /**
     * MODIFICATO: Aggiunti i campi 'stato' e 'data_registrazione' all'oggetto da salvare.
     */
    saveHoursBtn.addEventListener('click', () => {
        if (provisionalTableBody.rows.length === 0) { alert("Nessun dato da salvare."); return; }
        
        const dataToSend = Array.from(provisionalTableBody.rows).map(row => ({
            giorno: row.cells[0].textContent,
            operatore_id: row.cells[1].dataset.id,
            ore: parseFloat(row.cells[2].textContent),
            etichetta_id: row.cells[3].dataset.id,
            descrizione_id: row.cells[4].dataset.id,
            note: row.cells[5].textContent,
            // NUOVI CAMPI AGGIUNTI AL SALVATAGGIO
            stato: 'Da Registrare',
            data_registrazione: null
        }));

        console.log("Dati pronti per il salvataggio:", dataToSend);
        alert(`Dati pronti per essere inviati! (${dataToSend.length} righe)`);
        
        clearProvisionalTable();
        modal.style.display = 'none';
    });
});