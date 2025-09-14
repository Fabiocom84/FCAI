// js/inserimento-ore.js (Versione aggiornata per parlare con il Backend)

import { API_BASE_URL } from './config.js'; // Importa l'URL del backend

document.addEventListener('DOMContentLoaded', () => {
    // --- SELEZIONE ELEMENTI DEL DOM ---
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
    function getPreviousWorkingDay() {
        const today = new Date();
        const currentDay = today.getDay(); // 0=Domenica, 1=Lunedì...
        let daysToSubtract = 1;
        if (currentDay === 1) { // Se è Lunedì
            daysToSubtract = 3; // Vai a Venerdì
        } else if (currentDay === 0) { // Se è Domenica
            daysToSubtract = 2; // Vai a Venerdì
        }
        today.setDate(today.getDate() - daysToSubtract);
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
            if (!confirm("Ci sono dati non salvati. Sei sicuro di voler chiudere?")) { return; }
        }
        modal.style.display = 'none';
        clearProvisionalTable();
    };
    closeModalBtn.addEventListener('click', closeModal);

    // --- FUNZIONI DI POPOLAMENTO ---
    async function populateInitialData() {
        try {
            // Chiama la nostra API sul backend che restituisce tutti i dati necessari
            const response = await fetch(`${API_BASE_URL}/api/init-inserimento-ore`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Errore dal backend: ${response.status}`);
            }

            const initData = await response.json();
            
            // Popola i menu con i dati ricevuti dal backend
            populateSelect(operatoreSelect, initData.personale, 'id_personale', 'nome_cognome');
            // Nota: Ho usato 'lavorazioni' e 'id_lavorazione' basandomi sul nostro ultimo app.py
            populateSelect(lavorazioneSelect, initData.lavorazioni, 'id_lavorazione', 'nome_lavorazione');
            
            populatePersonnelList(initData.personale);

        } catch (error) {
            console.error("Errore nel caricamento dei dati iniziali dal backend:", error);
            alert(`Impossibile caricare i dati per il modale: ${error.message}`);
        }
    }   

    function populateSelect(selectElement, data, valueKey, textKey) {
        if (!selectElement) return;
        selectElement.innerHTML = '<option value="">Seleziona...</option>';
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueKey];
            // Per le lavorazioni, potremmo voler mostrare anche il tipo
            if (item.tipi_lavorazione && item.tipi_lavorazione.nome_tipo) {
                 option.textContent = `${item.tipi_lavorazione.nome_tipo} - ${item[textKey]}`;
            } else {
                 option.textContent = item[textKey];
            }
            selectElement.appendChild(option);
        });
    }

    function populatePersonnelList(operatori) {
        // ... (questa funzione rimane la stessa)
        personnelList.innerHTML = '';
        operatori.forEach(op => {
            const li = document.createElement('li');
            li.dataset.operatorId = op.id_personale; 
            li.style.cursor = 'pointer';
            li.innerHTML = `<span>${op.nome_cognome}</span><span class="entry-count-badge">0</span>`;
            li.addEventListener('click', () => {
                operatoreSelect.value = op.id_personale;
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

        newRow.querySelector('.delete-row-btn').addEventListener('click', () => {
            newRow.remove();
            updateAll();
        });
    
        resetInputForm();
        updateAll();
    });

    // --- AGGIORNAMENTO UI ---
    function resetInputForm() { 
        operatoreSelect.value = ""; oreInput.value = ""; etichettaSelect.value = "";
        descrizioneSelect.value = ""; noteInput.value = ""; operatoreSelect.focus();
    }
    
    function updateAll() {
        updateFeedbackHours();
        updateSummary();
    }
    
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
    
    function updateSummary() {
        const rowCount = provisionalTableBody.rows.length;
        let totalHours = 0;
        for (const row of provisionalTableBody.rows) {
            totalHours += parseFloat(row.cells[2].textContent) || 0;
        }
        summaryFooter.innerHTML = `<span>Righe Inserite: ${rowCount}</span> | <span>Totale Ore: ${totalHours.toFixed(1)}</span>`;
    }

    function clearProvisionalTable() {
        provisionalTableBody.innerHTML = '';
        updateAll();
    }

    saveHoursBtn.addEventListener('click', async () => {
        if (provisionalTableBody.rows.length === 0) {
            alert("Nessun dato da salvare.");
            return;
        }

        const rowsToInsert = Array.from(provisionalTableBody.rows).map(row => ({
            data_lavoro: row.cells[0].textContent,
            id_personale_fk: parseInt(row.cells[1].dataset.id, 10),
            ore_lavorate: parseFloat(row.cells[2].textContent),
            id_etichetta_fk: row.cells[3].dataset.id ? parseInt(row.cells[3].dataset.id, 10) : null,
            id_descrizione_fk: row.cells[4].dataset.id ? parseInt(row.cells[4].dataset.id, 10) : null,
            note: row.cells[5].textContent,
            stato: 'Da Registrare',
            data_aggiornamento_stato: null
        }));

        console.log("Invio dei seguenti dati a Supabase:", rowsToInsert);

        try {
            const { error } = await supabase
                .from('registrazioni_ore')
                .insert(rowsToInsert);

            if (error) {
                throw error;
            }

            alert(`Salvataggio completato! Sono state aggiunte ${rowsToInsert.length} righe.`);
            
            clearProvisionalTable();
            modal.style.display = 'none';

        } catch (error) {
            console.error("Errore durante il salvataggio dei dati su Supabase:", error);
            alert(`Errore nel salvataggio dei dati: ${error.message}`);
        }
    });
    
}); // <-- QUESTA E' LA CHIUSURA CORRETTA DEL DOMContentLoaded