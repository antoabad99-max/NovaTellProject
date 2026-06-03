export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const event = req.body;
  console.log('Telnyx event:', JSON.stringify(event));

  const eventType = event?.data?.event_type;
  const callControlId = event?.data?.payload?.call_control_id;

  try {
    const TELNYX_API_KEY = process.env.TELNYX_API_KEY;

    if (eventType === 'call.initiated') {
      // Answer the call
      await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TELNYX_API_KEY}` },
        body: JSON.stringify({})
      });
    }

    if (eventType === 'call.answered') {
      // Speak welcome message
      await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TELNYX_API_KEY}` },
        body: JSON.stringify({
          payload: "Bonjour, je suis NOVA, l'assistant intelligent de NovaTel. Comment puis-je vous aider aujourd'hui ?",
          voice: 'female',
          language: 'fr-FR'
        })
      });
    }

    if (eventType === 'call.speak.ended') {
      // Gather speech input
      await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/gather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TELNYX_API_KEY}` },
        body: JSON.stringify({
          minimum_digits: 0,
          timeout_millis: 8000,
          speech: {
            model: 'enhanced',
            language: 'fr-FR',
            profanity_filter: false
          }
        })
      });
    }

    if (eventType === 'call.gather.ended') {
      const speechResult = event?.data?.payload?.speech?.transcript || '';
      console.log('Speech result:', speechResult);

      if (speechResult) {
        // Ask Claude for response
        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-opus-4-5',
            max_tokens: 150,
            system: `Tu es NOVA, l'assistant vocal de NovaTel. Tu réponds à des appels téléphoniques.
Tes réponses doivent être courtes (2-3 phrases max), claires et naturelles à l'oral.
Tu vouvoies toujours le client. Termine par une question ou une formule de politesse.`,
            messages: [{ role: 'user', content: speechResult }]
          })
        });

        const claudeData = await claudeRes.json();
        const reply = claudeData.content?.[0]?.text || "Je suis désolé, je n'ai pas bien compris. Pouvez-vous répéter ?";

        // Check if goodbye
        const goodbyeWords = ['bonne journée', 'au revoir', 'bonsoir', 'merci', 'à bientôt'];
        const isGoodbye = goodbyeWords.some(w => reply.toLowerCase().includes(w));

        // Speak Claude's response
        await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TELNYX_API_KEY}` },
          body: JSON.stringify({
            payload: reply,
            voice: 'female',
            language: 'fr-FR'
          })
        });

        // If goodbye, hangup after speaking
        if (isGoodbye) {
          setTimeout(async () => {
            await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/hangup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TELNYX_API_KEY}` },
              body: JSON.stringify({})
            });
          }, 5000);
        }
      } else {
        // No speech detected
        await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TELNYX_API_KEY}` },
          body: JSON.stringify({
            payload: "Je n'ai pas entendu votre réponse. N'hésitez pas à nous rappeler au 3266. Bonne journée !",
            voice: 'female',
            language: 'fr-FR'
          })
        });
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Voice error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
