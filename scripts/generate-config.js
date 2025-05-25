// scripts/generate-config.js
const fs = require('fs');
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

if (!backendUrl) {
  console.error("Error: NEXT_PUBLIC_BACKEND_URL environment variable not found.");
  process.exit(1);
}

const configContent = `window.BACKEND_URL = "${backendUrl}";`;

fs.writeFileSync('js/config.js', configContent);

console.log("Generated js/config.js with backend URL.");