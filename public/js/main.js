let legendInstance;
let insertDataModalElement; 
let insertDataModalInstance; 
let chatModalInstance;
let newOrderModalInstance;
let trainingModalInstance;
let modalOverlay; // Dichiarazione corretta a livello globale

document.addEventListener('DOMContentLoaded', function() {
    legendInstance = new Legend(); 
    window.legendInstance = legendInstance;
    modalOverlay = document.getElementById('modalOverlay'); // Assegnazione del valore

    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', function(event) {
            event.preventDefault(); 
            logoutUser();
        });
    }

    // Carica gli ultimi inserimenti all'avvio
    loadLatestEntries();
});


//----Funzioni per aprire i modali
function openInsertDataModal() {
    if (!insertDataModalInstance) {
        // Crea una nuova istanza della classe e la memorizza
        insertDataModalInstance = new InsertDataModal('insertDataModal', 'modalOverlay', '#openInsertDataModalBtn');
        window.insertDataModalInstance = insertDataModalInstance;
    }
    // Chiama il metodo open() sull'istanza creata
    insertDataModalInstance.open();
}

function openChatModal() {
    if (!chatModalInstance) {
        chatModalInstance = document.getElementById('chatModal');
        window.chatModalInstance = chatModalInstance;
    }
    if (chatModalInstance) {
        chatModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
    }
}

function openNewOrderModal() {
    if (!newOrderModalInstance) {
        newOrderModalInstance = document.getElementById('newOrderModal');
        window.newOrderModalInstance = newOrderModalInstance;
    }
    if (newOrderModalInstance) {
        newOrderModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
    }
}

// Funzione per aprire il modale Addestramento
function openTrainingModal() {
    if (!trainingModalInstance) {
        trainingModalInstance = document.getElementById('trainingModal');
        window.trainingModalInstance = trainingModalInstance;
    }
    if (trainingModalInstance) {
        trainingModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
    }
}


// Collega le funzioni ai rispettivi pulsanti
document.getElementById('openInsertDataModalBtn')?.addEventListener('click', openInsertDataModal);
document.getElementById('closeInsertDataModalBtn')?.addEventListener('click', closeInsertDataModal);

document.getElementById('openChatModalBtn')?.addEventListener('click', openChatModal);
document.getElementById('closeChatModalBtn')?.addEventListener('click', closeChatModal);

document.getElementById('openNewOrderModalBtn')?.addEventListener('click', openNewOrderModal);
document.getElementById('closeNewOrderModalBtn')?.addEventListener('click', closeNewOrderModal);

document.getElementById('openTrainingModalBtn')?.addEventListener('click', openTrainingModal);
document.getElementById('closeTrainingModalBtn')?.addEventListener('click', closeTrainingModal);


//---Chiusura modali
function closeInsertDataModal() {
    // Usiamo la variabile che punta all'elemento DOM del modale
    if (insertDataModalElement) {
        insertDataModalElement.style.display = 'none';
    }
    // Assicuriamoci che anche l'overlay venga nascosto
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
    }
}

function closeChatModal() {
    if (chatModalInstance) {
        chatModalInstance.style.display = 'none';
        modalOverlay.style.display = 'none';
    }
}

function closeNewOrderModal() {
    if (newOrderModalInstance) {
        newOrderModalInstance.style.display = 'none';
        modalOverlay.style.display = 'none';
    }
}

function closeTrainingModal() {
    if (trainingModalInstance) {
        trainingModalInstance.style.display = 'none';
        modalOverlay.style.display = 'none';
    }
}

//---Caricamento latest entries
function loadLatestEntries() {
  const backendUrl = window.BACKEND_URL;
  // Cerca prima in localStorage, poi in sessionStorage
  const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken'); 

  if (!token) {
    console.error("Token di autenticazione non trovato. Impossibile caricare gli inserimenti recenti.");
    return; // Interrompe l'esecuzione se il token non c'è
  }

  fetch(`${backendUrl}/api/latest-entries`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}` // Aggiunge l'header di autorizzazione
    }
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