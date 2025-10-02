// js/supabase-client.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://mqfhsiezsorpdnskcsgw.supabase.co';
const supabaseAnonKey = 'INCOLLA-QUI-LA-TUA-VERA-E-CORRETTA-ANON-KEY';

// --- MODIFICA CHIAVE PER GARANTIRE UNA SOLA ISTANZA (SINGLETON) ---

// Controlliamo se un'istanza del client è GIA' stata creata e salvata nell'oggetto globale window.
// Se non esiste, la creiamo. Altrimenti, riutilizziamo quella esistente.
if (!window.supabase) {
  console.log("Creazione di una NUOVA istanza del client Supabase.");
  window.supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
  });
} else {
  console.log("Riutilizzo dell'istanza del client Supabase esistente.");
}

// Esportiamo l'istanza unica per renderla disponibile agli altri file.
export const supabase = window.supabase;