export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/xml');

  const speechResult = req.body?.SpeechResult || '';

  let novaReply = '';

  try {
    // Ask Claude to generate NOVA's vocal response
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 200,
        system: `Tu es NOVA, l'assistant vocal de NovaTel. Tu réponds à des appels téléphoniques. 
Tes réponses doivent être courtes (2-3 phrases maximum), claires et naturelles à l'oral.
Tu vouvoies toujours le client. Tu ne mentionnes jamais que tu es une IA sauf si on te le demande.
Si le client a une panne, rassure-le et dis-lui qu'un technicien sera contacté.
Si le client veut parler à un humain, dis-lui qu'un conseiller le rappellera dans les 30 minutes.
Termine toujours par une formule de politesse courte.`,
        messages: [{ role: 'user', content: speechResult || 'Bonjour' }]
      })
    });

    const data = await response.json();
    novaReply = data.content?.[0]?.text || 'Je suis désolé, je n\'ai pas bien compris. Un conseiller NovaTel vous rappellera rapidement. Bonne journée !';
  } catch (e) {
    novaReply = 'Je rencontre une difficulté technique. Un conseiller NovaTel vous rappellera dans les 30 minutes. Merci de votre patience. Bonne journée !';
  }

  // Check if conversation should end
  const endWords = ['au revoir', 'merci', 'bonne journée', 'bonsoir', 'ça suffit'];
  const shouldEnd = endWords.some(w => novaReply.toLowerCase().includes(w));

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="fr-FR" voice="Polly.Lea">${novaReply.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</Say>
  ${shouldEnd ? '' : `<Gather input="speech" language="fr-FR" timeout="5" action="/api/voice-response" method="POST">
    <Say language="fr-FR" voice="Polly.Lea">Je vous écoute.</Say>
  </Gather>`}
</Response>`;

  return res.status(200).send(twiml);
}
