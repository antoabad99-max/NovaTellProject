export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: 'Numero manquant' });

  // Format French number to E.164
  let formatted = phoneNumber.replace(/\s/g, '').replace(/-/g, '').replace(/\./g, '');
  if (formatted.startsWith('0')) formatted = '+33' + formatted.slice(1);
  if (!formatted.startsWith('+')) formatted = '+33' + formatted;

  console.log('Calling:', formatted);

  try {
    const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
    const TELNYX_NUMBER = process.env.TELNYX_PHONE_NUMBER;
    const baseUrl = 'https://novatell-site.vercel.app';

    const response = await fetch('https://api.telnyx.com/v2/calls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TELNYX_API_KEY}`
      },
      body: JSON.stringify({
        connection_id: process.env.TELNYX_CONNECTION_ID,
        to: formatted,
        from: TELNYX_NUMBER,
        webhook_url: `${baseUrl}/api/voice`,
        webhook_url_method: 'POST'
      })
    });

    const data = await response.json();
    console.log('Telnyx response:', JSON.stringify(data));

    if (data.data && data.data.call_leg_id) {
      return res.status(200).json({ success: true, callId: data.data.call_leg_id });
    } else {
      return res.status(400).json({ error: data.errors?.[0]?.detail || 'Erreur Telnyx', details: data });
    }
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
