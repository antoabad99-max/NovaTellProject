export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const event = req.body;
  const eventType = event?.data?.event_type;
  const callControlId = event?.data?.payload?.call_control_id;

  console.log('Event type:', eventType);
  console.log('Call control ID:', callControlId);

  const TELNYX_API_KEY = process.env.TELNYX_API_KEY;

  async function telnyxAction(action, body = {}) {
    const r = await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TELNYX_API_KEY}`
      },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    console.log(`${action} response:`, JSON.stringify(data));
    return data;
  }

  try {
    // Incoming call - answer it
    if (eventType === 'call.initiated') {
      await telnyxAction('answer');
    }

    // Call answered - play welcome message
    if (eventType === 'call.answered') {
      await telnyxAction('speak', {
        payload: "Bonjour, vous avez contacté NovaTel. Je suis NOVA, votre assistant intelligent. Comment puis-je vous aider aujourd'hui ?",
        voice: 'female',
        language: 'fr-FR',
        command_id: 'welcome'
      });
    }

    // Welcome message finished - listen for speech
    if (eventType === 'call.speak.ended') {
      await telnyxAction('gather', {
        minimum_digits: 0,
        timeout_millis: 8000,
        speech: {
          model: 'enhanced',
          language: 'fr-FR',
          profanity_filter: false,
          endpointing_timeout_millis: 2000
        }
      });
    }

    // Speech received - ask Claude and respond
    if (eventType === 'call.gather.ended') {
      const speechResult = event?.data?.payload?.speech?.transcript || '';
      const reason = event?.data?.payload?.reason;
      console.log('Speech:', speechResult, 'Reason:', reason);

      if (speechResult && speechResult.trim()) {
        // Get Claude response
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
            system: `Tu es NOVA, l'assistant vocal de NovaTel. Tu réponds à des appels téléphoniques entrants.
Règles : réponses courtes (2 phrases max), claires et naturelles à l'oral. Tu vouvoies toujours.
Si le problème est résolu ou le client dit au revoir, dis "Bonne journée !" et raccroche.
Ne mentionne pas que tu es une IA sauf si demandé.`,
            messages: [{ role: 'user', content: speechResult }]
          })
        });

        const claudeData = await claudeRes.json();
        const reply = claudeData.content?.[0]?.text || "Je suis désolé, pouvez-vous répéter ?";
        console.log('NOVA reply:', reply);

        const goodbyeWords = ['bonne journée', 'au revoir', 'bonsoir', 'à bientôt'];
        const isGoodbye = goodbyeWords.some(w => reply.toLowerCase().includes(w));

        await telnyxAction('speak', {
          payload: reply,
          voice: 'female',
          language: 'fr-FR'
        });

        if (isGoodbye) {
          setTimeout(async () => {
            await telnyxAction('hangup');
          }, 6000);
        }
      } else {
        // No speech - prompt again
        await telnyxAction('speak', {
          payload: "Je n'ai pas entendu votre réponse. Pouvez-vous répéter s'il vous plaît ?",
          voice: 'female',
          language: 'fr-FR'
        });
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
