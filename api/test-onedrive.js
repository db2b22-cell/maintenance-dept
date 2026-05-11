export default async function handler(req, res) {
  const key = process.env.MATON_API_KEY;
  const connectionId = '5ede5238-487d-44f2-b146-3de025335451';
  const headers = {
    'Authorization': `Bearer ${key}`,
    'Maton-Connection': connectionId,
  };

  // Test 1: binary PUT to OneDrive
  // Minimal 1x1 red PNG (67 bytes)
  const pngBytes = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
    '2e00000000c4944415478016360f8cfc00000000200012721bc530000000049454e44ae426082',
    'hex'
  );
  const testUrl = 'https://api.maton.ai/one-drive/v1.0/me/drive/root:/Apps/remotely-save/Makatoon/LINE-Media/test/test.png:/content';
  const r = await fetch(testUrl, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'image/png' },
    body: pngBytes,
  });
  const binaryOk = r.ok;
  const binaryStatus = r.status;

  // Test 2: LINE content download if msgId provided
  let lineOk = null, lineStatus = null, lineType = null;
  const msgId = req.query && req.query.msgId;
  if (msgId) {
    const CHANNEL_ACCESS_TOKEN = '9UBzhgK+eli/utMHi1KicoF9Okr0IzxDGJuyme9qPHQrP7MnoivSGZhTzNK/7jZHGkSV3IfYCXntYMZiQ6t0j7+JKpF5Lq2mGXNszncGzw8M/uGn3HRCeAx2X1pQHr0cWjRbIkPIP1BVVp8EQNgxXAdB04t89/1o/w1cDnyilFU=';
    const lr = await fetch(`https://api-data.line.me/v2/bot/message/${msgId}/content`, {
      headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` }
    });
    lineOk = lr.ok;
    lineStatus = lr.status;
    lineType = lr.headers.get('content-type');
    if (lr.ok) {
      const buf = await lr.arrayBuffer();
      const upUrl = `https://api.maton.ai/one-drive/v1.0/me/drive/root:/Apps/remotely-save/Makatoon/LINE-Media/test/line_${msgId}.jpg:/content`;
      const up = await fetch(upUrl, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': lineType || 'image/jpeg' },
        body: buf,
      });
      return res.json({ binaryOk, binaryStatus, lineOk, lineStatus, lineType, uploadStatus: up.status });
    }
  }

  return res.json({ binaryOk, binaryStatus, lineOk, lineStatus, lineType });
}
