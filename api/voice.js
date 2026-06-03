export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const event = req.body;
  const eventType = event?.data?.event_type;
  const callControlId = event?.data?.payload?.call_control_id;

  console.log('Event:', eventType, 'CallID:', callControlId);

  // Respond immediately to avoid timeout
  res.status(200).json({ received: true });

  if (!callControlId || !eventType) return;

  const TELNYX_API_KEY = process.env.TELNYX_API_KEY;

  async function act(action, body = {}) {
    try {
      const r = await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TELNYX_API_KEY}`
        },
        body: JSON.stringify(body)
      });
      const d = await r.json();
      console.log(`${action}:`, JSON.stringify(d).substring(0, 100));
    } catch(e) {
      console.error(`${action} error:`, e.message);
    }
  }

  if (eventType === 'call.initiated') {
    await act('answer');
  }

  if (eventType === 'call.answered') {
    await act('speak', {
      payload: "Bonjour, vous avez contacté NovaTel. Je suis NOVA, votre assistant. Comment puis-je vous aider ?",
      voice: 'female',
      language: 'fr-FR'
    });
  }

  if (eventType === 'call.speak.ended') {
    await act('gather', {
      minimum_digits: 0,
      timeout_millis: 8000,
      speech: {
        model: 'enhanced',
        language: 'fr-FR',
        profanity_filter: false,
        endpointing_timeout_millis: 1500
      }
    });
  }

  if (eventType === 'call.gather.ended') {
    const transcript = event?.data?.payload?.speech?.transcript || '';
    console.log('Transcript:', transcript);

    if (transcript.trim()) {
      try {
        const cr = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-opus-4-5',
            max_tokens: 120,
            system: `Tu es NOVA, l'assistant vocal de NovaTel. Réponds en 1-2 phrases courtes, claires, naturelles à l'oral. Vouvoie toujours. Si le client dit au revoir ou merci, dis "Bonne journée !" et termine.`,
            messages: [{ role: 'user', content: transcript }]
          })
        });
        const cd = await cr.json();
        const reply = cd.content?.[0]?.text || "Je suis désolé, pouvez-vous répéter ?";
        console.log('Reply:', reply);

        const bye = ['bonne journée', 'au revoir', 'bonsoir', 'à bientôt'].some(w => reply.toLowerCase().includes(w));
        await act('speak', { payload: reply, voice: 'female', language: 'fr-FR' });
        if (bye) setTimeout(() => act('hangup'), 5000);
      } catch(e) {
        console.error('Claude error:', e.message);
        await act('speak', { payload: "Je suis désolé, une erreur est survenue. Rappellez-nous au 3266. Bonne journée !", voice: 'female', language: 'fr-FR' });
      }
    } else {
      await act('speak', { payload: "Je n'ai pas entendu votre réponse. Pouvez-vous répéter ?", voice: 'female', language: 'fr-FR' });
    }
  }
}
