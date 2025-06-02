let legendInstance; // Definisci una variabile globale
let insertModalInstance; // Definisci una variabile per l'istanza del modal
let chatModalInstance;
let searchModalInstance;
let settingsModalInstance;

document.addEventListener('DOMContentLoaded', function() {
    insertModalInstance = new InsertDataModal('insertDataModal', 'modalOverlay', '.insert-button');
    legendInstance = new Legend(); // Inizializza la classe Legend

    // Inizializzazione degli altri modal (potrebbe essere gestita in modo più dinamico in futuro)
    chatModalInstance = document.getElementById('chatModal');
    searchModalInstance = document.getElementById('searchModal');
    settingsModalInstance = document.getElementById('settingsModal');

    window.legendInstance = legendInstance; // Rendi accessibile l'istanza della legenda globalmente
    window.insertModalInstance = insertModalInstance; // Rendi accessibile l'istanza del modal
    window.chatModalInstance = chatModalInstance;
    window.searchModalInstance = searchModalInstance;
    window.settingsModalInstance = settingsModalInstance;

    // Chiama la funzione per caricare gli ultimi inserimenti all'avvio della pagina
    loadLatestEntries();
});

function closeInsertModal() {
    if (insertModalInstance) {
        insertModalInstance.close();
    }
}

function closeChatModal() {
    if (chatModalInstance) {
        chatModalInstance.style.display = 'none';
        document.getElementById('modalOverlay').style.display = 'none';
    }
}

function closeSearchModal() {
    if (searchModalInstance) {
        searchModalInstance.style.display = 'none';
        document.getElementById('modalOverlay').style.display = 'none';
    }
}

function closeSettingsModal() {
    if (settingsModalInstance) {
        settingsModalInstance.style.display = 'none';
        document.getElementById('modalOverlay').style.display = 'none';
    }
}

function updateLatestEntries(data) {
    const latestEntriesList = document.querySelector('.latest-entries ul');
    if (latestEntriesList) {
        latestEntriesList.innerHTML = '';

        if (data && data.length > 0) {
            data.forEach(entry => {
                const listItem = document.createElement('li');
                listItem.style.marginBottom = '15px';
                listItem.style.padding = '10px';
                listItem.style.borderBottom = '1px solid #eee';

                // Prima riga: DATA/ORA - RIFERIMENTO COMMESSA
                const row1 = document.createElement('div');
                row1.style.display = 'flex';
                row1.style.alignItems = 'center';
                row1.style.marginBottom = '5px';

                const dateTimeSpan = document.createElement('span');
                dateTimeSpan.textContent = entry['DATA/ORA'] || 'N/A';
                dateTimeSpan.style.fontWeight = 'bold';
                row1.appendChild(dateTimeSpan);

                if (entry['RIFERIMENTO COMMESSA']) {
                    const riferimentoSpan = document.createElement('span');
                    riferimentoSpan.textContent = ` - Riferimento: ${entry['RIFERIMENTO COMMESSA']}`;
                    riferimentoSpan.style.marginLeft = '10px';
                    row1.appendChild(riferimentoSpan);
                }

                listItem.appendChild(row1);

                // Seconda riga: TRASCRIZIONE (troncata)
                const row2 = document.createElement('div');
                row2.style.marginBottom = '5px';
                const transcriptionSpan = document.createElement('span');
                transcriptionSpan.textContent = entry['TRASCRIZIONE'] ? entry['TRASCRIZIONE'].substring(0, 50) + '...' : 'N/A';
                row2.appendChild(transcriptionSpan);
                listItem.appendChild(row2);

                // Terza riga: URL (come link)
                if (entry['URL']) {
                    const viewLink = document.createElement('a');
                    viewLink.href = entry['URL'];
                    viewLink.textContent = 'Visualizza File';
                    viewLink.target = '_blank';
                    viewLink.classList.add('view-file-link');
                    listItem.appendChild(viewLink);
                }

                latestEntriesList.appendChild(listItem);
            });
        } else {
            const listItem = document.createElement('li');
            listItem.textContent = 'Nessun inserimento recente.';
            latestEntriesList.appendChild(listItem);
        }
    } else {
        console.error('Elemento .latest-entries ul non trovato.');
    }
}

function updateLatestEntries(data) {
    const latestEntriesList = document.querySelector('.latest-entries ul');
    if (latestEntriesList) {
        latestEntriesList.innerHTML = '';

        if (data && data.length > 0) {
            data.forEach(entry => {
                const listItem = document.createElement('li');
                let transcriptionText = '';
                if (entry && entry['data/ora'] && entry['trascrizione']) {
                    transcriptionText = entry['trascrizione'].substring(0, 50) + '...';
                    listItem.innerHTML = `<span class="entry-date-time">${entry['data/ora']}</span> - ${transcriptionText}`;

                    // Aggiungi il riferimento commessa se presente
                    if (entry.riferimento) {
                        listItem.innerHTML += ` - <span class="entry-riferimento">Riferimento: ${entry.riferimento}</span>`;
                    }

                    // Aggiungi un link per visualizzare il file se l'URL è presente
                    if (entry.url) {
                        const viewLink = document.createElement('a');
                        viewLink.href = entry.url;
                        viewLink.textContent = 'Visualizza File';
                        viewLink.target = '_blank';
                        viewLink.classList.add('view-file-link');
                        listItem.appendChild(document.createTextNode(' - '));
                        listItem.appendChild(viewLink);
                    }

                    const link = document.createElement('a');
                    link.href = '#';
                    link.classList.add('entry-item');
                    link.appendChild(listItem);
                    latestEntriesList.appendChild(link);
                } else {
                    listItem.textContent = 'Errore nel formato dei dati.';
                    latestEntriesList.appendChild(listItem);
                    console.error('Formato dei dati degli ultimi inserimenti non valido:', entry);
                }
            });
        } else {
            const listItem = document.createElement('li');
            listItem.textContent = 'Nessun inserimento recente.';
            latestEntriesList.appendChild(listItem);
        }
    } else {
        console.error('Elemento .latest-entries ul non trovato.');
    }
}