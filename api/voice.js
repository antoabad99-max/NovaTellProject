export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/xml');

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="fr-FR" voice="Polly.Lea">
    Bonjour, je suis NOVA, l'assistant intelligent de NovaTel.
    Je vous contacte suite à votre demande d'assistance.
    Comment puis-je vous aider aujourd'hui ?
  </Say>
  <Gather input="speech" language="fr-FR" timeout="5" action="/api/voice-response" method="POST">
    <Say language="fr-FR" voice="Polly.Lea">
      Je vous écoute.
    </Say>
  </Gather>
  <Say language="fr-FR" voice="Polly.Lea">
    Je n'ai pas entendu votre réponse. N'hésitez pas à nous rappeler au 3266. Bonne journée !
  </Say>
</Response>`;

  return res.status(200).send(twiml);
}
