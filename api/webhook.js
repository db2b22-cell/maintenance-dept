import crypto from 'crypto';

const CHANNEL_SECRET = '64fb0187ad83708a38015d673ab321d1';
const CHANNEL_ACCESS_TOKEN = '9UBzhgK+eli/utMHi1KicoF9Okr0IzxDGJuyme9qPHQrP7MnoivSGZhTzNK/7jZHGkSV3IfYCXntYMZiQ6t0j7+JKpF5Lq2mGXNszncGzw8M/uGn3HRCeAx2X1pQHr0cWjRbIkPIP1BVVp8EQNgxXAdB04t89/1o/w1cDnyilFU=';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwtslkpUh2oUtcgwE8ToA_tCueY_FHRXFepEyxIlsWap8X4YABgvJPab9dJX7C8ToZ7/exec';
const ONEDRIVE_CONNECTION_ID = '5ede5238-487d-44f2-b146-3de025335451';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MEMBERS = [
  { id: 11, names: ['ปราโมทย์', 'ไพรวรรณ์', 'Pramot'] },
  { id: 12, names: ['สกล', 'กิจเจริญ', 'nouvo'] },
  { id: 13, names: ['บัณฑิต', 'นิลอ่อน', 'plug'] },
  { id: 7,  names: ['วิทยา', 'แพงศรี', 'หมี'] },
  { id: 4,  names: ['ศิริชัย', 'แสงวงศ์', 'aek', 'เอก'] },
  { id: 6,  names: ['อุดมชัย', 'ทศรักษา', 'Ly'] },
  { id: 9,  names: ['สนธยา', 'โจ้', 'โจ้ชาวดี'] },
  { id: 1,  names: ['ภัททิยา', 'แพท์พิพัฒน์', 'Noomotasa'] },
  { id: 2,  names: ['วันชนะ', 'ฟอร์ด'] },
  { id: 3,  names: ['วัชรินทร์', 'วงษ์ตุรัณต์', 'Beerkujiki'] },
  { id: 5,  names: ['สมชาย', 'ลิขิต', 'ลิขิตอณิเนยฬ์'] },
  { id: 8,  names: ['พิพัฒน์พล', 'เบล', 'เบลดับปลู'] },
  { id: 10, names: ['สุทิน', 'รอดยิ้ม'] },
  { id: 14, names: ['ณัฐพงษ์', 'ยะล้อม', 'ไมค์', 'nattapong'] },
];

const TRIGGER_WORDS = ['ป่วย', 'ไม่สบาย', 'ไม่มา', 'หยุด', 'ติดธุระ', 'มาแล้ว', 'มาได้', 'ยกเลิกลา', 'หาหมอ', 'นัดหมอ', 'พบแพทย์', 'พรุ่งนี้'];
const LEAVE_RE = /(?<![ก-ฮ])ลา(?:ป่วย|หยุด|งาน|ก่อน|นะ|ครับ|ค่ะ|วันที่|พรุ่งนี้|มะรืน|อาทิตย์|เดือน|วัน|ล่วงหน้า)|(?:ขอ|แจ้ง|ต้อง)ลา/;
const CANCEL_WORDS = ['มาแล้ว', 'มาได้', 'ยกเลิกลา', 'ยกเลิก'];
const LEAVE_WORDS  = ['ป่วย', 'ไม่สบาย', 'ไม่มา', 'หยุด', 'ติดธุระ', 'หาหมอ', 'นัดหมอ', 'พบแพทย์'];

function quickDetect(text, memberId) {
  if (CANCEL_WORDS.some(w => text.includes(w)))
    return { action: 'cancel', memberId, status: 'present' };
  if (LEAVE_RE.test(text) || LEAVE_WORDS.some(w => text.includes(w)))
    return { action: 'leave', memberId, status: 'leave' };
  return null;
}

function verifySignature(rawBody, signature) {
  const hash = crypto.createHmac('SHA256', CHANNEL_SECRET).update(rawBody).digest('base64');
  return hash === signature;
}

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function findMemberByName(name) {
  if (!name) return null;
  for (const m of MEMBERS) {
    if (m.names.some(n => name.includes(n) || n.includes(name))) return m;
  }
  return null;
}

async function getLineDisplayName(userId, source) {
  try {
    let url;
    if (source.type === 'group') {
      url = `https://api.line.me/v2/bot/group/${source.groupId}/member/${userId}`;
    } else if (source.type === 'room') {
      url = `https://api.line.me/v2/bot/room/${source.roomId}/member/${userId}`;
    } else {
      url = `https://api.line.me/v2/bot/profile/${userId}`;
    }
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` } });
    const data = await res.json();
    return data.displayName || null;
  } catch (e) {
    return null;
  }
}

async function getMemberIdFromSheets(userId) {
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getUser&userId=${encodeURIComponent(userId)}`);
    const data = await res.json();
    return data.memberId ? +data.memberId : null;
  } catch (e) {
    return null;
  }
}

async function saveUserToSheets(userId, displayName, memberId) {
  try {
    const params = new URLSearchParams({ action: 'saveUser', userId, displayName: displayName || '', memberId: String(memberId) });
    await fetch(`${SCRIPT_URL}?${params}`);
  } catch (e) {}
}

function extractLeaveDateFromText(text) {
  const now = new Date();
  const ty = now.getFullYear().toString();
  const tm = String(now.getMonth() + 1).padStart(2, '0');

  let m = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;

  if (/พรุ่งนี้/.test(text)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
  }

  m = text.match(/วันที่?\s*(\d{1,2})/);
  if (m) return `${ty}-${tm}-${m[1].padStart(2,'0')}`;

  return null;
}

async function updateSheet(memberId, status) {
  const params = new URLSearchParams({ action: 'setStatus', id: String(memberId), status });
  try {
    await fetch(`${SCRIPT_URL}?${params}`);
    console.log(`[SHEETS] id=${memberId} → ${status}`);
  } catch (e) {}
}

function getThaiNow() {
  const now = new Date();
  const thNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return {
    dateStr: thNow.toISOString().slice(0, 10),
    timeStr: thNow.toISOString().slice(11, 16),
  };
}

function getExtension(contentType, fileName) {
  if (fileName) {
    const dot = fileName.lastIndexOf('.');
    if (dot !== -1) return fileName.slice(dot);
  }
  const map = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
    'application/pdf': '.pdf', 'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'audio/m4a': '.m4a', 'audio/mpeg': '.mp3',
  };
  return map[contentType] || '.bin';
}

const oneDriveHeaders = () => ({
  'Authorization': `Bearer ${process.env.MATON_API_KEY}`,
  'Maton-Connection': ONEDRIVE_CONNECTION_ID,
});

async function saveToOneDrive(text, senderName, mediaRef) {
  try {
    const { dateStr, timeStr } = getThaiNow();
    const filePath = `/Apps/remotely-save/Makatoon/LINE-Logs/${dateStr}.md`;
    const fileUrl = `https://api.maton.ai/one-drive/v1.0/me/drive/root:${filePath}:/content`;

    let existingContent = '';
    const getRes = await fetch(fileUrl, { headers: oneDriveHeaders() });
    if (getRes.ok) {
      existingContent = await getRes.text();
    } else {
      existingContent = `# LINE Log - ${dateStr}\n\n`;
    }

    let newLine = `## ${timeStr} - ${senderName}\n`;
    if (text) newLine += `${text}\n`;
    if (mediaRef) newLine += `${mediaRef}\n`;
    newLine += '\n';

    await fetch(fileUrl, {
      method: 'PUT',
      headers: { ...oneDriveHeaders(), 'Content-Type': 'text/plain' },
      body: existingContent + newLine
    });
    console.log(`[ONEDRIVE] Saved log from ${senderName}`);
  } catch (e) {
    console.error('[ONEDRIVE] Log Error:', e.message);
  }
}

async function saveMediaToOneDrive(messageId, messageType, fileName) {
  try {
    const { dateStr, timeStr } = getThaiNow();

    // Log that we received this media event (for debugging)
    const logUrl = `https://api.maton.ai/one-drive/v1.0/me/drive/root:/Apps/remotely-save/Makatoon/LINE-Logs/${dateStr}.md:/content`;
    const getRes = await fetch(logUrl, { headers: oneDriveHeaders() });
    const existing = getRes.ok ? await getRes.text() : `# LINE Log - ${dateStr}\n\n`;
    await fetch(logUrl, {
      method: 'PUT',
      headers: { ...oneDriveHeaders(), 'Content-Type': 'text/plain' },
      body: existing + `## ${timeStr} - [${messageType} received: ${messageId}]\n\n`
    });

    // Download from LINE as buffer
    const lineRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` }
    });
    if (!lineRes.ok) {
      console.error(`[LINE] Content fetch failed: ${lineRes.status} msgId=${messageId}`);
      return;
    }

    const contentType = lineRes.headers.get('content-type') || 'application/octet-stream';
    const ext = getExtension(contentType, fileName);
    const finalFileName = fileName || `${messageType}_${messageId}${ext}`;
    const buffer = await lineRes.arrayBuffer();

    const mediaPath = `/Apps/remotely-save/Makatoon/LINE-Media/${dateStr}/${finalFileName}`;
    const mediaUrl = `https://api.maton.ai/one-drive/v1.0/me/drive/root:${mediaPath}:/content`;

    const upRes = await fetch(mediaUrl, {
      method: 'PUT',
      headers: { ...oneDriveHeaders(), 'Content-Type': contentType },
      body: buffer,
    });

    if (upRes.ok) {
      console.log(`[ONEDRIVE] Saved media: ${finalFileName}`);
    } else {
      const errText = await upRes.text().catch(() => '');
      console.error(`[ONEDRIVE] Upload failed: ${upRes.status} ${errText.slice(0, 200)}`);
    }
  } catch (e) {
    console.error('[ONEDRIVE] Media Error:', e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rawBody = await readRawBody(req);
  const signature = req.headers['x-line-signature'];

  if (!signature || !verifySignature(rawBody, signature)) {
    console.error('[WEBHOOK] Invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString());
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const events = body.events || [];

  for (const event of events) {
    if (event.type !== 'message') continue;

    const msgType = event.message.type;
    const messageId = event.message.id;
    const userId = event.source.userId;

    // Handle media BEFORE member lookup to save time
    if (msgType === 'image') {
      await saveMediaToOneDrive(messageId, 'image', null);
      continue;
    }

    if (msgType === 'file') {
      const fileName = event.message.fileName || null;
      await saveMediaToOneDrive(messageId, 'file', fileName);
      continue;
    }

    if (msgType !== 'text') continue;

    // Member lookup only for text messages
    let knownMemberId = await getMemberIdFromSheets(userId);
    if (!knownMemberId) {
      const displayName = await getLineDisplayName(userId, event.source);
      if (displayName) {
        const member = findMemberByName(displayName);
        if (member) {
          knownMemberId = member.id;
          await saveUserToSheets(userId, displayName, member.id);
        }
      }
    }

    const memberForLog = MEMBERS.find(m => m.id === knownMemberId);
    const senderName = memberForLog ? memberForLog.names[0] : userId;

    const text = event.message.text.trim();

    // ระบบลงทะเบียน
    const registerMatch = text.match(/^ฉัน\s+(.+)$/);
    if (registerMatch) {
      const inputName = registerMatch[1].trim();
      const member = findMemberByName(inputName);
      if (member) {
        await saveUserToSheets(userId, inputName, member.id);
        console.log(`[REGISTER] ${inputName} → id=${member.id}`);
      }
      continue;
    }

    await saveToOneDrive(text, senderName, null);

    // ตรวจการลางาน
    const hasTrigger = LEAVE_RE.test(text) || TRIGGER_WORDS.some(w => text.includes(w));
    if (!hasTrigger) continue;
    if (!knownMemberId) continue;

    const result = quickDetect(text, knownMemberId);
    if (result && result.action !== 'none') {
      const finalId = result.memberId || knownMemberId;
      if (finalId) {
        let status = result.status;
        if (status === 'leave' || status === 'absent') {
          const leaveDate = extractLeaveDateFromText(text);
          if (leaveDate) {
            const today = new Date().toISOString().slice(0, 10);
            if (leaveDate > today) status = `leave_advance:${leaveDate}`;
          }
        }
        await updateSheet(finalId, status);
      }
    }
  }

  return res.status(200).json({ success: true });
}
