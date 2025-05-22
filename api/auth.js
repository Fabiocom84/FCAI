export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { username, password } = req.body;

    // Ottieni le variabili d'ambiente di Vercel
    const storedUsername = process.env.AUTH_USERNAME;
    const storedPassword = process.env.AUTH_PASSWORD;

    console.log('La funzione /api/auth è stata chiamata');

    if (username === storedUsername && password === storedPassword) {
      // Autenticazione riuscita
      const token = 'ilMioTokenSegreto'; // Ricorda di generare token sicuri in produzione
      res.status(200).json({ success: true, token: token });
    } else {
      // Autenticazione fallita
      res.status(401).json({ success: false, message: 'Credenziali non valide' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).send(`Method ${req.method} Not Allowed`);
  }
}