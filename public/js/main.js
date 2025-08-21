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

function loadLatestEntries() {
      const backendUrl = window.BACKEND_URL;
  fetch(`${backendUrl}/api/latest-entries`, {
    method: 'GET',
  })
    .then(response => {
      // Verifica che la risposta sia OK (status code 200-299)
      if (!response.ok) {
        // Se la risposta non è OK, genera un errore con informazioni dettagliate
        const errorMessage = `Errore HTTP! Stato: ${response.status}, Testo: ${response.statusText}`;
        console.error(errorMessage); // Stampa l'errore nel console per debugging
        throw new Error(errorMessage); // Propaga l'errore per essere catturato nel catch
      }
      // Se la risposta è OK, analizza il JSON
      return response.json();
    })
    .then(data => {
      // Gestisci i dati ricevuti
      console.log("Dati ricevuti:", data);
      updateLatestEntries(data);
    })
    .catch(error => {
      // Gestisci gli errori di fetch o di parsing del JSON
      console.error('Errore durante il recupero degli ultimi inserimenti dal backend:', error);
      // Mostra un messaggio di errore all'utente (opzionale, ma consigliato)
      // Esempio:
      // alert('Si è verificato un errore durante il caricamento degli ultimi inserimenti. Riprovare più tardi.');
    });
}

function updateLatestEntries(data) {
    const entries = data.latest_entries; 
    const latestEntriesList = document.querySelector('.latest-entries ul');

    if (latestEntriesList) {
        latestEntriesList.innerHTML = '';

        if (entries && entries.length > 0) {
            entries.forEach(entry => {
                const listItem = document.createElement('li');
                listItem.style.marginBottom = '15px';
                listItem.style.padding = '10px';
                listItem.style.borderBottom = '1px solid #eee';

                // Usa innerHTML per interpretare i tag HTML
                listItem.innerHTML = entry; 

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