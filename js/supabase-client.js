// js/supabase-client.js (Versione Locale Offline-First)

// [OPTIMIZATION] Usiamo la versione caricata in window da 'js/libs/supabase.min.js'
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = 'https://mqfhsiezsorpdnskcsgw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZmhzaWV6c29ycGRuc2tjc2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MjY3NTgsImV4cCI6MjA3MzEwMjc1OH0.JImF22KAyhAVDdVTvDWF3nwv2CyQIt8aiT76IghSFqI';

// Verifica disponibilità libreria
if (!window.supabase || !window.supabase.createClient) {
  console.error("CRITICAL: Supabase library not loaded correctly!");
  alert("Errore caricamento librerie sistema. Ricarica la pagina.");
}

// Creiamo un client "passivo"
export const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,      // NON deve salvare sessioni nel localStorage
    autoRefreshToken: false,    // NON deve tentare il refresh automatico del token
    detectSessionInUrl: false   // NON deve leggere i token dall'URL
  },
});