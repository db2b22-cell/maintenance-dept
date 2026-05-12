import crypto from 'crypto';

const CHANNEL_SECRET = '64fb0187ad83708a38015d673ab321d1';
const CHANNEL_ACCESS_TOKEN = 'zAxex+H02fBeebm6uRsJz4gYYxWk7Jxpxa+w2Hzc5XYLEFBxT1CCXT/IFkC+TYb8GkSV3IfYCXntYMZiQ6t0j7+JKpF5Lq2mGXNszncGzw/rE6xOdsnYVA7P+wFbt/c7/v8hHXXE1IAYyp+i86mUOgdB04t89/1O/w1cDnyilFU=';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwtslkpUh2oUtcgwE8ToA_tCueY_FHRXFepEyxIlsWap8X4YABgvJPab9dJX7C8ToZ7/exec';
const ONEDRIVE_CONNECTION_ID = '5ede5238-487d-44f2-b146-3de025335451';
const MY_MEMBER_ID = 6; // อุดมชัย - ข้อความจะอยู่ขวา

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

// Cache ชื่อกลุ่มในหน่วยความจำ (หายเมื่อ restart แต่ช่วยลด API call)
const groupNameCache = {};

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

// ดึงชื่อกลุ่มจาก LINE API และ cache ไว้
async function getGroupName(source) {
  if (source.type === 'group') {
    const gid = source.groupId;
    if (groupNameCache[gid]) return groupNameCache[gid];
    try {
      const res = await fetch(`https://api.line.me/v2/bot/group/${gid}/summary`, {
        headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` }
      });
      if (res.ok) {
        const data = await res.json();
        const name = (data.groupName || gid).replace(/[\/\\:*?"<>|]/g, '_');
        groupNameCache[gid] = name;
        return name;
      }
    } catch (e) {}
    return gid;
  } else if (source.type === 'room') {
    return `room_${source.roomId}`;
  } else {
    return 'Direct';
  }
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

async function ensureProfilePic(userId, senderName, source) {
  try {
    const picPath = `/Apps/remotely-save/Makatoon/LINE-Profiles/${senderName}.jpg`;
    const checkUrl = `https://api.maton.ai/one-drive/v1.0/me/drive/root:${picPath}:/content`;
    const check = await fetch(checkUrl, { headers: oneDriveHeaders() });
    if (check.ok) return;

    let profileUrl;
    if (source && source.type === 'group' && source.groupId) {
      profileUrl = `https://api.line.me/v2/bot/group/${source.groupId}/member/${userId}`;
    } else if (source && source.type === 'room' && source.roomId) {
      profileUrl = `https://api.line.me/v2/bot/room/${source.roomId}/member/${userId}`;
    } else {
      profileUrl = `https://api.line.me/v2/bot/profile/${userId}`;
    }

    const profile = await fetch(profileUrl, {
      headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` }
    });
    if (!profile.ok) return;
    const { pictureUrl } = await profile.json();
    if (!pictureUrl) return;
    const imgRes = await fetch(pictureUrl);
    if (!imgRes.ok) return;
    const buf = await imgRes.arrayBuffer();
    await fetch(checkUrl, {
      method: 'PUT',
      headers: { ...oneDriveHeaders(), 'Content-Type': 'image/jpeg' },
      body: buf,
    });
    console.log(`[PROFILE] Saved profile pic for ${senderName}`);
  } catch (e) {
    console.error(`[PROFILE] Error: ${e.message}`);
  }
}

async function appendToLog(groupName, dateStr, htmlBlock) {
  const fileUrl = `https://api.maton.ai/one-drive/v1.0/me/drive/root:/Apps/remotely-save/Makatoon/LINE-Logs/${encodeURIComponent(groupName)}/${dateStr}.md:/content`;
  const getRes = await fetch(fileUrl, { headers: oneDriveHeaders() });
  const existing = getRes.ok ? await getRes.text() : `<div class="lc">\n`;
  await fetch(fileUrl, {
    method: 'PUT',
    headers: { ...oneDriveHeaders(), 'Content-Type': 'text/plain' },
    body: existing + htmlBlock
  });
}

async function saveToOneDrive(text, senderName, memberId, userId, source, groupName) {
  try {
    const { dateStr, timeStr } = getThaiNow();
    const av = `../LINE-Profiles/${senderName}.jpg`;

    if (userId) await ensureProfilePic(userId, senderName, source);

    let html = `<div class="msg"><div class="mh"><img class="av" src="${av}"><b class="nm">${senderName}</b><span class="ts">${timeStr}</span></div>`;
    if (text) html += `<span class="ct">${text}</span>`;
    html += `</div>\n`;

    await appendToLog(groupName, dateStr, html);
    console.log(`[ONEDRIVE] Saved log from ${senderName} in [${groupName}]`);
  } catch (e) {
    console.error('[ONEDRIVE] Log Error:', e.message);
  }
}

async function saveMediaToOneDrive(messageId, messageType, fileName, userId, source, groupName) {
  try {
    const { dateStr, timeStr } = getThaiNow();

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

    const mediaPath = `/Apps/remotely-save/Makatoon/LINE-Media/${encodeURIComponent(groupName)}/${dateStr}/${finalFileName}`;
    const mediaUrl = `https://api.maton.ai/one-drive/v1.0/me/drive/root:${mediaPath}:/content`;

    const upRes = await fetch(mediaUrl, {
      method: 'PUT',
      headers: { ...oneDriveHeaders(), 'Content-Type': contentType },
      body: buffer,
    });

    let mediaMemberId = await getMemberIdFromSheets(userId).catch(() => null);
    if (!mediaMemberId) {
      const dn = await getLineDisplayName(userId, source || { type: 'user' }).catch(() => null);
      if (dn) { const m = findMemberByName(dn); if (m) mediaMemberId = m.id; }
    }
    const mediaMember = MEMBERS.find(m => m.id === mediaMemberId);
    const mediaSender = mediaMember ? mediaMember.names[0] : 'unknown';
    const av = `../LINE-Profiles/${mediaSender}.jpg`;
    if (userId) await ensureProfilePic(userId, mediaSender, source);

    let html = '';
    if (upRes.ok) {
      html = `<div class="msg"><div class="mh"><img class="av" src="${av}"><b class="nm">${mediaSender}</b><span class="ts">${timeStr}</span></div><img src="../LINE-Media/${groupName}/${dateStr}/${finalFileName}" class="ci"></div>\n`;
    } else {
      html = `<div class="msg"><div class="mh"><b class="nm">${mediaSender}</b><span class="ts">${timeStr}</span></div><span class="ct">[upload failed]</span></div>\n`;
    }
    await appendToLog(groupName, dateStr, html);

    if (upRes.ok) {
      console.log(`[ONEDRIVE] Saved media: ${finalFileName} in [${groupName}]`);
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
    const source = event.source;

    // ดึงชื่อกลุ่มสำหรับแยกโฟลเดอร์
    const groupName = await getGroupName(source);

    // ข้ามวีดีโอ
    if (msgType === 'video') {
      console.log(`[SKIP] Video message skipped: ${messageId}`);
      continue;
    }

    if (msgType === 'image') {
      await saveMediaToOneDrive(messageId, 'image', null, userId, source, groupName);
      continue;
    }

    if (msgType === 'file') {
      const fileName = event.message.fileName || null;
      await saveMediaToOneDrive(messageId, 'file', fileName, userId, source, groupName);
      continue;
    }

    if (msgType !== 'text') continue;

    // Member lookup
    let knownMemberId = await getMemberIdFromSheets(userId);
    if (!knownMemberId) {
      const displayName = await getLineDisplayName(userId, source);
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

    await saveToOneDrive(text, senderName, knownMemberId, userId, source, groupName);

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
