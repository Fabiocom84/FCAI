// js/supabase-client.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://mqfhsiezsorpdnskcsgw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZmhzaWV6c29ycGRuc2tjc2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MjY3NTgsImV4cCI6MjA3MzEwMjc1OH0.JImF22KAyhAVDdVTvDWF3nwv2CyQIt8aiT76IghSFqI';

// --- MODIFICA CHIAVE ---
// Aggiungiamo l'oggetto di opzioni per garantire la persistenza della sessione
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Supabase salverà la sessione nel localStorage e la aggiornerà automaticamente.
    // Questo è FONDAMENTALE per far funzionare il login tra le pagine.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
});