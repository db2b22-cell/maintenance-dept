const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwtslkpUh2oUtcgwE8ToA_tCueY_FHRXFepEyxIlsWap8X4YABgvJPab9dJX7C8ToZ7/exec';

const MEMBER_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export default async function handler(req, res) {
  // Vercel cron จะส่ง Authorization header มาให้
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results = [];
  for (const id of MEMBER_IDS) {
    try {
      const params = new URLSearchParams({ action: 'setStatus', id: String(id), status: 'present' });
      await fetch(`${SCRIPT_URL}?${params}`);
      results.push({ id, ok: true });
      console.log(`[RESET] id=${id} → present`);
    } catch (e) {
      results.push({ id, ok: false });
    }
  }

  console.log(`[RESET] รีเซ็ตสถานะ ${results.filter(r => r.ok).length}/${MEMBER_IDS.length} คน`);
  return res.status(200).json({ success: true, reset: results.length });
}
