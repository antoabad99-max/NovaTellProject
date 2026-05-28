export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: 'Numéro manquant' });

  // Format French number to E.164
  let formatted = phoneNumber.replace(/\s/g, '').replace(/-/g, '');
  if (formatted.startsWith('0')) formatted = '+33' + formatted.slice(1);
  if (!formatted.startsWith('+')) formatted = '+33' + formatted;

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://novatell-site.vercel.app';

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        To: formatted,
        From: twilioNumber,
        Url: `${baseUrl}/api/voice`,
        StatusCallback: `${baseUrl}/api/voice-status`,
        StatusCallbackMethod: 'POST'
      })
    });

    const data = await response.json();
    if (data.sid) {
      return res.status(200).json({ success: true, callSid: data.sid, message: 'Appel en cours...' });
    } else {
      return res.status(400).json({ error: data.message || 'Erreur Twilio' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
  }
}
