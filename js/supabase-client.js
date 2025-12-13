// js/supabase-client.js (Versione Definitiva)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = 'https://mqfhsiezsorpdnskcsgw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZmhzaWV6c29ycGRuc2tjc2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MjY3NTgsImV4cCI6MjA3MzEwMjc1OH0.JImF22KAyhAVDdVTvDWF3nwv2CyQIt8aiT76IghSFqI';

// Creiamo un client "passivo" che NON gestisce l'autenticazione in automatico
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,      // NON deve salvare sessioni nel localStorage
    autoRefreshToken: false,    // NON deve tentare il refresh automatico del token
    detectSessionInUrl: false   // NON deve leggere i token dall'URL
  },
});