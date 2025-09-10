// js/supabase-client.js

// Importa la funzione per creare il client dalla libreria di Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Inserisci qui le tue credenziali Supabase
const supabaseUrl = 'https://mqfhsiezsorpdnskcsgw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZmhzaWV6c29ycGRuc2tjc2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MjY3NTgsImV4cCI6MjA3MzEwMjc1OH0.JImF22KAyhAVDdVTvDWF3nwv2CyQIt8aiT76IghSFqI';

// Esporta il client Supabase inizializzato, così possiamo usarlo in altri file
export const supabase = createClient(supabaseUrl, supabaseAnonKey);