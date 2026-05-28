export default async function handler(req, res) {
  // Log call status (can be extended to update dashboard)
  console.log('Call status:', req.body?.CallStatus, 'Duration:', req.body?.CallDuration);
  return res.status(200).end();
}
