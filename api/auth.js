export default async function handler(req, res) {
  // Imposta gli header CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://fcai-tau.vercel.app'); // Permetti tutte le origini (solo per sviluppo, in produzione specifica la tua origine)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // Specifica i metodi consentiti
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Specifica gli header consent

  // Gestisci la richiesta OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    const { username, password } = req.body;

    // Ottieni le variabili d'ambiente di Vercel
    const storedUsername = process.env.AUTH_USERNAME;
    const storedPassword = process.env.AUTH_PASSWORD;

    console.log('La funzione /api/auth è stata chiamata');
    console.log('Username ricevuto:', username);
    console.log('Password ricevuta:', password);
    console.log('Username atteso:', storedUsername);
    console.log('Password attesa:', storedPassword);

    if (username === storedUsername && password === storedPassword) {
      // Autenticazione riuscita
      const token = 'ailMioTokenSegreto'; // Ricorda di generare token sicuri in produzione
      console.log('Autenticazione riuscita per l\'utente:', username);
      res.status(200).json({ success: true, token: token });
    } else {
      // Autenticazione fallita
      console.log('Autenticazione fallita per l\'utente:', username);
      res.status(401).json({ success: false, message: 'Credenziali non valide' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).send(`Method ${req.method} Not Allowed`);
  }
}