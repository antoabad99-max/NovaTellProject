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
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

    console.log('AccountSID:', accountSid ? 'OK' : 'MISSING');
    console.log('AuthToken:', authToken ? 'OK' : 'MISSING');
    console.log('TwilioNumber:', twilioNumber);

    const baseUrl = 'https://novatell-site.vercel.app';

    const body = new URLSearchParams({
      To: formatted,
      From: twilioNumber,
      Url: `${baseUrl}/api/voice`,
      Method: 'GET'
    });

    console.log('Request body:', body.toString());

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
      }
    );

    const data = await response.json();
    console.log('Twilio response:', JSON.stringify(data));

    if (data.sid) {
      return res.status(200).json({ success: true, callSid: data.sid });
    } else {
      return res.status(400).json({ 
        error: data.message || 'Erreur Twilio',
        code: data.code,
        details: data
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
