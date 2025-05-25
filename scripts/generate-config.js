// scripts/generate-config.js
const fs = require('fs');
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

if (!backendUrl) {
  console.error("Error: NEXT_PUBLIC_BACKEND_URL environment variable not found.");
  process.exit(1);
}

const configContent = `window.BACKEND_URL = "${backendUrl}";`;

// Modifica il percorso per scrivere il file dentro la cartella 'public/js'
const outputPath = 'public/js/config.js';

// Crea la directory 'public/js' se non esiste
const publicJsDir = 'public/js';
if (!fs.existsSync(publicJsDir)) {
  fs.mkdirSync(publicJsDir, { recursive: true });
}

fs.writeFileSync(outputPath, configContent);

console.log(`Generated ${outputPath} with backend URL.`);