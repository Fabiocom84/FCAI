// js/supabase-client.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://mqfhsiezsorpdnskcsgw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZmhzaWV6c29ycGRuc2tjc2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MjY3NTgsImV4cCI6MjA3MzEwMjc1OH0.JImF22KAyhAVDdVTvDWF3nwv2CyQIt8aiT76IghSFqI';

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