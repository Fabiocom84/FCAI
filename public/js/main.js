// js/main.js

let legendInstance;
let modalOverlay;

// Istanze dei modali
let insertDataModalInstance; 
let chatModalInstance;
let newOrderModalInstance;
let trainingModalInstance;

document.addEventListener('DOMContentLoaded', function() {
    legendInstance = new Legend();
    window.legendInstance = legendInstance;
    modalOverlay = document.getElementById('modalOverlay'); 
    window.modalOverlay = modalOverlay;

    // Gestione Logout
    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', function(event) {
            event.preventDefault(); 
            logoutUser();
        });
    }

    // Collega i pulsanti alle funzioni di apertura
    document.getElementById('openInsertDataModalBtn')?.addEventListener('click', openInsertDataModal);
    document.getElementById('openChatModalBtn')?.addEventListener('click', openChatModal);
    document.getElementById('openNewOrderModalBtn')?.addEventListener('click', openNewOrderModal);
    document.getElementById('openTrainingModalBtn')?.addEventListener('click', openTrainingModal);

    // Gestione chiusura con click sull'overlay
    if (modalOverlay) {
        modalOverlay.addEventListener('click', () => {
            const openModal = document.querySelector('.modal[style*="display: block"]');
            if (openModal) {
                switch (openModal.id) {
                    case 'insertDataModal':
                        closeInsertDataModal();
                        break;
                    case 'chatModal':
                        closeChatModal();
                        break;
                    case 'newOrderModal':
                        closeNewOrderModal();
                        break;
                    case 'trainingModal':
                        closeTrainingModal();
                        break;
                }
            }
        });
    }

    // Carica gli ultimi inserimenti all'avvio
    loadLatestEntries();
});

// --- FUNZIONI DI APERTURA MODALI ---

function openInsertDataModal() {
    if (!insertDataModalInstance) {
        insertDataModalInstance = document.getElementById('insertDataModal');
    }
    if (insertDataModalInstance) {
        insertDataModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
        
        // Chiama le funzioni specifiche dal suo file per preparare il modale
        if (window.prepareInsertDataModal) {
            window.prepareInsertDataModal();
        }
    }
}

function openChatModal() {
    if (!chatModalInstance) {
        chatModalInstance = document.getElementById('chatModal');
    }
    if (chatModalInstance) {
        chatModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
    }
}

function openNewOrderModal() {
    if (!newOrderModalInstance) {
        newOrderModalInstance = document.getElementById('newOrderModal');
    }
    if (newOrderModalInstance) {
        newOrderModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
    }
}

function openTrainingModal() {
    if (!trainingModalInstance) {
        trainingModalInstance = document.getElementById('trainingModal');
    }
    if (trainingModalInstance) {
        trainingModalInstance.style.display = 'block';
        modalOverlay.style.display = 'block';
    }
}

// --- FUNZIONI DI CHIUSURA MODALI ---

function closeInsertDataModal() {
    if (insertDataModalInstance) {
        insertDataModalInstance.style.display = 'none';
    }
    modalOverlay.style.display = 'none';
    
    // Chiama le funzioni specifiche dal suo file per resettare il modale
    if (window.cleanupInsertDataModal) {
        window.cleanupInsertDataModal();
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

// --- ALTRE FUNZIONI ---

// Funzione di logout
function logoutUser() {
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('authToken');
    console.log('Token di autenticazione rimosso. Reindirizzamento...');
    window.location.href = 'login.html'; 
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