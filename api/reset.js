const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwtslkpUh2oUtcgwE8ToA_tCueY_FHRXFepEyxIlsWap8X4YABgvJPab9dJX7C8ToZ7/exec';

export default async function handler(req, res) {
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Thai time = UTC+7, cron runs 00:30 UTC = 07:30 ICT
  const now = new Date();
  const thai = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const today = thai.toISOString().slice(0, 10); // YYYY-MM-DD

  // Read current statuses from Sheets
  let currentData = [];
  try {
    const r = await fetch(`${SCRIPT_URL}?_=${Date.now()}`);
    currentData = await r.json();
  } catch (e) {
    console.error('[RESET] ไม่สามารถอ่าน Sheets ได้:', e.message);
  }

  // Build a map: id → current status
  const statusMap = {};
  if (Array.isArray(currentData)) {
    currentData.forEach(s => { statusMap[String(s.id)] = s.status || 'present'; });
  }

  const results = [];
  for (const [id, currentStatus] of Object.entries(statusMap)) {
    let newStatus = 'present';

    if (currentStatus && currentStatus.startsWith('leave_advance:')) {
      const parts = currentStatus.slice(14).split(':');
      const startDate = parts[0];
      const endDate   = parts[1] || parts[0];

      if (today >= startDate && today <= endDate) {
        // Active leave period today — keep advance record (frontend shows as leave)
        newStatus = currentStatus;
        console.log(`[RESET] id=${id} → ลาล่วงหน้า active (${startDate}→${endDate})`);
      } else if (today < startDate) {
        // Future leave — don't reset
        newStatus = currentStatus;
        console.log(`[RESET] id=${id} → ลาล่วงหน้า pending (${startDate}→${endDate})`);
      } else {
        // Leave period ended — reset to present
        newStatus = 'present';
        console.log(`[RESET] id=${id} → leave expired, reset to present`);
      }
    } else {
      console.log(`[RESET] id=${id} → present`);
    }

    try {
      const params = new URLSearchParams({ action: 'setStatus', id, status: newStatus });
      await fetch(`${SCRIPT_URL}?${params}`);
      results.push({ id, newStatus, ok: true });
    } catch (e) {
      results.push({ id, newStatus, ok: false });
    }
  }

  const resetCount = results.filter(r => r.newStatus === 'present').length;
  const keptCount  = results.filter(r => r.newStatus !== 'present').length;
  console.log(`[RESET] รีเซ็ต ${resetCount} คน, คงสถานะลา ${keptCount} คน`);
  return res.status(200).json({ success: true, reset: resetCount, kept: keptCount });
}
