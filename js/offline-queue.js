// js/offline-queue.js
// Coda offline per note vocali/testuali — IndexedDB + auto-sync

import { API_BASE_URL } from './config.js';

const DB_NAME = 'segretario-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-notes';

// --- 1. DATABASE SETUP ---

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

// --- 2. OPERAZIONI CRUD ---

/**
 * Salva una nota nella coda offline.
 * @param {Object} note - { audioBlob?: Blob, mimeType?: string, textNote?: string, timestamp: string }
 */
export async function saveToQueue(note) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        const entry = {
            audioBlob: note.audioBlob || null,
            mimeType: note.mimeType || null,
            textNote: note.textNote || null,
            timestamp: note.timestamp || new Date().toISOString(),
            status: 'pending' // pending | syncing | failed
        };

        const req = store.add(entry);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/**
 * Restituisce il conteggio delle note in coda.
 */
export async function getPendingCount() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/**
 * Restituisce tutte le note in coda.
 */
export async function getAllPending() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/**
 * Rimuove una nota dalla coda (dopo sync riuscita).
 */
async function removeFromQueue(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// --- 3. SINCRONIZZAZIONE ---

let isSyncing = false;

/**
 * Sincronizza tutte le note in coda con il backend.
 * Per ogni nota: trascrivi audio (se presente) → salva su DB → elimina da IndexedDB.
 */
export async function syncQueue() {
    if (isSyncing) return;
    if (!navigator.onLine) return;

    const pending = await getAllPending();
    if (pending.length === 0) return;

    isSyncing = true;
    const token = localStorage.getItem('session_token');
    if (!token) { isSyncing = false; return; }

    console.log(`🔄 [Sync] Inizio sincronizzazione ${pending.length} note in coda...`);

    for (const note of pending) {
        try {
            let transcription = note.textNote || '';

            // Se c'è audio, trascrivilo prima
            if (note.audioBlob) {
                const ext = (note.mimeType || '').includes('mp4') ? 'mp4' :
                            (note.mimeType || '').includes('aac') ? 'aac' : 'webm';

                const formData = new FormData();
                formData.append('audio', note.audioBlob, `recording.${ext}`);

                const transcribeRes = await fetch(`${API_BASE_URL}/api/transcribe-voice`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                if (!transcribeRes.ok) {
                    console.warn(`⚠️ [Sync] Trascrizione fallita per nota #${note.id}, riproverò dopo.`);
                    continue; // Lascia in coda, riproverà al prossimo sync
                }

                const data = await transcribeRes.json();
                transcription = data.transcription || transcription;
            }

            // Salva la registrazione sul backend (senza commessa)
            if (transcription) {
                const saveForm = new FormData();
                saveForm.append('transcription', transcription);

                const saveRes = await fetch(`${API_BASE_URL}/api/registrazioni`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: saveForm
                });

                if (!saveRes.ok) {
                    console.warn(`⚠️ [Sync] Salvataggio fallito per nota #${note.id}, riproverò dopo.`);
                    continue;
                }
            }

            // Successo! Rimuovi dalla coda (libera memoria telefono)
            await removeFromQueue(note.id);
            console.log(`✅ [Sync] Nota #${note.id} sincronizzata e rimossa dalla coda.`);

        } catch (err) {
            console.warn(`⚠️ [Sync] Errore su nota #${note.id}:`, err);
            // Non rimuovere, riproverà al prossimo sync
        }
    }

    isSyncing = false;
    console.log('🔄 [Sync] Sincronizzazione completata.');
}

// --- 4. AUTO-SYNC: ascolta il ritorno della connettività ---
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('🌐 [Sync] Connessione ristabilita, avvio sync...');
        setTimeout(() => syncQueue(), 2000); // Piccolo delay per stabilizzazione rete
    });
}
