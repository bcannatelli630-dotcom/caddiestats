// Vercel serverless function: turns recap text into speech with ElevenLabs.
// Required env var:  ELEVENLABS_API_KEY
// Recommended (locks it to signed-in app users): SUPABASE_URL, SUPABASE_ANON_KEY
const VOICES = {
  matilda: 'XrExE9yKIg1WjnnlVkGX',
  charlie: 'IKne3meq5aSn9XLyUdCD',
  brian: 'nPczCjzI2devNBz1zQrb',
  chris: 'iP95p4xoKVk53GoZ742B',
  jessica: 'cgSgspJ2msm6clMCkdW9'
};

module.exports = async (req, res) => {
  if (req.method === 'GET') return res.status(200).json({ ok: !!process.env.ELEVENLABS_API_KEY });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return res.status(500).json({ error: 'ELEVENLABS_API_KEY is not set in Vercel' });

  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Sign in required' });
    const r = await fetch(process.env.SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: process.env.SUPABASE_ANON_KEY }
    });
    if (!r.ok) return res.status(401).json({ error: 'Sign in required' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const text = String(body.text || '').slice(0, 1500);
  if (!text.trim()) return res.status(400).json({ error: 'No text' });
  const voiceId = VOICES[String(body.voice || '').toLowerCase()] || process.env.ELEVENLABS_VOICE_ID || VOICES.matilda;

  const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true }
    })
  });
  if (!r.ok) {
    const msg = await r.text();
    return res.status(r.status).json({ error: 'ElevenLabs: ' + msg.slice(0, 300) });
  }
  const buf = Buffer.from(await r.arrayBuffer());
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(buf);
};
