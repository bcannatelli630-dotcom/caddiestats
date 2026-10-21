// Vercel serverless function: turns recap text into speech with xAI Grok TTS.
// Required env var:  XAI_API_KEY
// Recommended (locks it to signed-in app users): SUPABASE_URL, SUPABASE_ANON_KEY
const VOICES = ['eve', 'ara', 'leo', 'rex', 'sal'];

module.exports = async (req, res) => {
  if (req.method === 'GET') return res.status(200).json({ ok: !!process.env.XAI_API_KEY });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const key = process.env.XAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'XAI_API_KEY is not set in Vercel' });

  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Sign in required' });
    const r = await fetch(process.env.SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: process.env.SUPABASE_ANON_KEY }
    });
    if (!r.ok) return res.status(401).json({ error: 'Sign in required' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const text = String(body.text || '').slice(0, 2000);
  if (!text.trim()) return res.status(400).json({ error: 'No text' });
  const v = String(body.voice || '').toLowerCase();
  const voice = VOICES.includes(v) ? v : (process.env.XAI_VOICE || 'eve');

  const r = await fetch('https://api.x.ai/v1/tts', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice_id: voice, language: 'en' })
  });
  if (!r.ok) {
    const msg = await r.text();
    return res.status(r.status).json({ error: 'Grok: ' + msg.slice(0, 300) });
  }
  const buf = Buffer.from(await r.arrayBuffer());
  res.setHeader('Content-Type', r.headers.get('content-type') || 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(buf);
};
