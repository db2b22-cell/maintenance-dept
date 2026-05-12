export default async function handler(req, res) {
  const key = process.env.MATON_API_KEY;
  const connectionId = '2fcb4244-d299-422c-909f-d6cbbc708b26';
  const headers = {
    'Authorization': `Bearer ${key}`,
    'Maton-Connection': connectionId,
  };

  // Test 1: Write a test log file  
  const testContent = `<div class="lc">\n<div class="msg">Vercel test at ${new Date().toISOString()}</div>\n`;
  const testUrl = 'https://api.maton.ai/one-drive/v1.0/me/drive/root:/Apps/remotely-save/Makatoon/LINE-Logs/MT_test/vercel-test.md:/content';
  
  let writeOk = false, writeStatus = 0, writeBody = '';
  try {
    const r = await fetch(testUrl, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'text/plain' },
      body: testContent,
    });
    writeOk = r.ok;
    writeStatus = r.status;
    writeBody = await r.text().catch(() => '');
  } catch(e) {
    writeBody = e.message;
  }

  // Test 2: List LINE-Logs folder
  let listOk = false, listStatus = 0, listItems = [];
  try {
    const r2 = await fetch('https://api.maton.ai/one-drive/v1.0/me/drive/root:/Apps/remotely-save/Makatoon/LINE-Logs:/children?$select=name,size', {
      headers
    });
    listOk = r2.ok;
    listStatus = r2.status;
    if (r2.ok) {
      const data = await r2.json();
      listItems = data.value.map(i => i.name);
    } else {
      listItems = [await r2.text().catch(() => '')];
    }
  } catch(e) {
    listItems = [e.message];
  }

  return res.json({ 
    keyPrefix: key ? key.substring(0, 10) : 'NOT SET',
    connectionId,
    writeOk, writeStatus, writeBody: writeBody.substring(0, 200),
    listOk, listStatus, listItems
  });
}
