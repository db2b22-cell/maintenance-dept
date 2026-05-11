export default async function handler(req, res) {
  const key = process.env.MATON_API_KEY;
  const hasKey = !!key && key.length > 10;
  
  if (!hasKey) return res.json({ ok: false, reason: 'MATON_API_KEY not set' });

  try {
    const r = await fetch('https://api.maton.ai/one-drive/v1.0/me/drive/root:/Apps/remotely-save/Makatoon/LINE-Logs/test-vercel.md:/content', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Maton-Connection': '5ede5238-487d-44f2-b146-3de025335451',
        'Content-Type': 'text/plain'
      },
      body: 'test from vercel'
    });
    return res.json({ ok: r.ok, status: r.status });
  } catch (e) {
    return res.json({ ok: false, error: e.message });
  }
}
