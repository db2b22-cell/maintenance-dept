import crypto from 'crypto';

const CHANNEL_SECRET = '64fb0187ad83708a38015d673ab321d1';
const CHANNEL_ACCESS_TOKEN = 'zAxex+H02fBeebm6uRsJz4gYYxWk7Jxpxa+w2Hzc5XYLEFBxT1CCXT/IFkC+TYb8GkSV3IfYCXntYMZiQ6t0j7+JKpF5Lq2mGXNszncGzw/rE6xOdsnYVA7P+wFbt/c7/v8hHXXE1IAYyp+i86mUOgdB04t89/1O/w1cDnyilFU=';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwtslkpUh2oUtcgwE8ToA_tCueY_FHRXFepEyxIlsWap8X4YABgvJPab9dJX7C8ToZ7/exec';
const GDRIVE_CONNECTION_ID = '9d9d8ae1-7cff-44ca-b29c-3e95f9aaac7e';
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

const groupNameCache = {};

// ---- Google Drive helpers ----
const folderIdCache = {}; // module-level cache (reused across warm Vercel instances)

const gdriveHeaders = () => ({
  'Authorization': `Bearer ${process.env.MATON_API_KEY}`,
  'Maton-Connection': GDRIVE_CONNECTION_ID,
});

async function gdriveSearch(q, fields = 'files(id)') {
  const params = new URLSearchParams({ q, fields, spaces: 'drive' });
  const res = await fetch(`https://api.maton.ai/google-drive/drive/v3/files?${params}`, {
    headers: gdriveHeaders(),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.files || [];
}

async function gdriveGetOrCreateFolder(name, parentId) {
  const key = `${parentId}::${name}`;
  if (folderIdCache[key]) return folderIdCache[key];
  const files = await gdriveSearch(
    `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
  );
  if (files.length > 0) {
    folderIdCache[key] = files[0].id;
    return files[0].id;
  }
  const res = await fetch('https://api.maton.ai/google-drive/drive/v3/files', {
    method: 'POST',
    headers: { ...gdriveHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  if (!res.ok) throw new Error(`Cannot create folder ${name}: ${res.status}`);
  const data = await res.json();
  folderIdCache[key] = data.id;
  return data.id;
}

async function gdriveGetRootId() {
  if (folderIdCache['__root__']) return folderIdCache['__root__'];
  const files = await gdriveSearch(
    `name='Makatoon' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`
  );
  if (files.length > 0) {
    folderIdCache['__root__'] = files[0].id;
    return files[0].id;
  }
  const res = await fetch('https://api.maton.ai/google-drive/drive/v3/files', {
    method: 'POST',
    headers: { ...gdriveHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Makatoon', mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (!res.ok) throw new Error('Cannot create Makatoon root folder');
  const data = await res.json();
  folderIdCache['__root__'] = data.id;
  return data.id;
}

async function gdriveReadText(fileId) {
  const res = await fetch(`https://api.maton.ai/google-drive/drive/v3/files/${fileId}?alt=media`, {
    headers: gdriveHeaders(),
  });
  if (!res.ok) return null;
  return await res.text();
}

function buildMultipartText(metadata, textContent) {
  const boundary = 'gdrive_boundary_maton';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    textContent,
    `--${boundary}--`,
  ].join('\r\n');
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

async function gdriveWriteText(name, folderId, content, existingId = null) {
  const { body, contentType } = buildMultipartText(
    existingId ? {} : { name, parents: [folderId] },
    content
  );
  const url = existingId
    ? `https://api.maton.ai/google-drive/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : 'https://api.maton.ai/google-drive/upload/drive/v3/files?uploadType=multipart';
  const method = existingId ? 'PATCH' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { ...gdriveHeaders(), 'Content-Type': contentType },
    body,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`gdriveWriteText failed: ${res.status} ${err.slice(0, 100)}`);
  }
  return await res.json();
}

async function gdriveUploadBinary(name, folderId, buffer, mimeType) {
  // Step 1: create metadata
  const metaRes = await fetch('https://api.maton.ai/google-drive/drive/v3/files', {
    method: 'POST',
    headers: { ...gdriveHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parents: [folderId] }),
  });
  if (!metaRes.ok) throw new Error(`Create metadata failed: ${metaRes.status}`);
  const { id: fileId } = await metaRes.json();
  // Step 2: upload content
  const upRes = await fetch(`https://api.maton.ai/google-drive/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { ...gdriveHeaders(), 'Content-Type': mimeType },
    body: buffer,
  });
  if (!upRes.ok) throw new Error(`Upload binary failed: ${upRes.status}`);
  return fileId;
}

// ---- Core logging ----
async function appendToLog(groupName, dateStr, htmlBlock) {
  try {
    const rootId = await gdriveGetRootId();
    const logsId = await gdriveGetOrCreateFolder('LINE-Logs', rootId);
    const groupFolderId = await gdriveGetOrCreateFolder(groupName, logsId);
    const fileName = `${dateStr}.md`;
    const files = await gdriveSearch(`name='${fileName}' and '${groupFolderId}' in parents and trashed=false`);
    let existing = '<div class="lc">\n';
    let fileId = null;
    if (files.length > 0) {
      fileId = files[0].id;
      const content = await gdriveReadText(fileId);
      if (content) existing = content;
    }
    await gdriveWriteText(fileName, groupFolderId, existing + htmlBlock, fileId);
    console.log(`[GDRIVE] Log: ${groupName}/${dateStr}`);
  } catch (e) {
    console.error('[GDRIVE] Log error:', e.message);
  }
}

// ---- Utility ----
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

async function getGroupName(source) {
  if (source.type === 'group') {
    const gid = source.groupId;
    if (groupNameCache[gid]) return groupNameCache[gid];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`https://api.line.me/v2/bot/group/${gid}/summary`, {
        headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const name = (data.groupName || gid).replace(/[\/\\:*?"<>|]/g, '_');
        groupNameCache[gid] = name;
        return name;
      }
    } catch (e) {
      console.log(`[GROUP] name fetch skipped: ${e.message}`);
    }
    groupNameCache[gid] = gid;
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

async function ensureProfilePic(userId, senderName, source) {
  try {
    const rootId = await gdriveGetRootId();
    const profilesId = await gdriveGetOrCreateFolder('LINE-Profiles', rootId);
    const picName = `${senderName}.jpg`;
    const existing = await gdriveSearch(`name='${picName}' and '${profilesId}' in parents and trashed=false`);
    if (existing.length > 0) return;
    let profileUrl;
    if (source && source.type === 'group') {
      profileUrl = `https://api.line.me/v2/bot/group/${source.groupId}/member/${userId}`;
    } else {
      profileUrl = `https://api.line.me/v2/bot/profile/${userId}`;
    }
    const profile = await fetch(profileUrl, { headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` } });
    if (!profile.ok) return;
    const { pictureUrl } = await profile.json();
    if (!pictureUrl) return;
    const imgRes = await fetch(pictureUrl);
    if (!imgRes.ok) return;
    const buf = await imgRes.arrayBuffer();
    await gdriveUploadBinary(picName, profilesId, buf, 'image/jpeg');
    console.log(`[PROFILE] Saved ${senderName}`);
  } catch (e) {
    console.error(`[PROFILE] Error: ${e.message}`);
  }
}

async function buildTextEntry(text, senderName, userId, source, groupName) {
  try {
    const { dateStr, timeStr } = getThaiNow();
    const av = `LINE-Profiles/${senderName}.jpg`;
    if (userId) ensureProfilePic(userId, senderName, source).catch(() => {});
    let html = `<div class="msg"><div class="mh"><img class="av" src="${av}"><b class="nm">${senderName}</b><span class="ts">${timeStr}</span></div>`;
    if (text) html += `<span class="ct">${text}</span>`;
    html += `</div>\n`;
    return { groupName, dateStr, html };
  } catch (e) {
    console.error('[BUILD] Text Error:', e.message);
    return null;
  }
}

async function buildMediaEntry(messageId, messageType, fileName, userId, source, groupName) {
  try {
    const { dateStr, timeStr } = getThaiNow();
    const [lineRes, mediaMemberIdRaw] = await Promise.all([
      fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
        headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` }
      }),
      getMemberIdFromSheets(userId).catch(() => null),
    ]);
    if (!lineRes.ok) {
      console.error(`[LINE] Content fetch failed: ${lineRes.status} msgId=${messageId}`);
      return null;
    }
    let mediaMemberId = mediaMemberIdRaw;
    if (!mediaMemberId) {
      const dn = await getLineDisplayName(userId, source || { type: 'user' }).catch(() => null);
      if (dn) { const m = findMemberByName(dn); if (m) mediaMemberId = m.id; }
    }
    const mediaMember = MEMBERS.find(m => m.id === mediaMemberId);
    const mediaSender = mediaMember ? mediaMember.names[0] : 'unknown';
    const av = `LINE-Profiles/${mediaSender}.jpg`;
    if (userId) ensureProfilePic(userId, mediaSender, source).catch(() => {});
    const contentType = lineRes.headers.get('content-type') || 'application/octet-stream';
    const ext = getExtension(contentType, fileName);
    const finalFileName = fileName || `${messageType}_${messageId}${ext}`;
    const buffer = await lineRes.arrayBuffer();
    // Upload to Google Drive
    const rootId = await gdriveGetRootId();
    const mediaRootId = await gdriveGetOrCreateFolder('LINE-Media', rootId);
    const mediaGroupId = await gdriveGetOrCreateFolder(groupName, mediaRootId);
    const mediaDayId = await gdriveGetOrCreateFolder(dateStr, mediaGroupId);
    let fileId = null;
    let html;
    try {
      fileId = await gdriveUploadBinary(finalFileName, mediaDayId, buffer, contentType);
      html = `<div class="msg"><div class="mh"><img class="av" src="${av}"><b class="nm">${mediaSender}</b><span class="ts">${timeStr}</span></div><img src="LINE-Media/${groupName}/${dateStr}/${finalFileName}" class="ci"></div>\n`;
      console.log(`[GDRIVE] Media: ${finalFileName} in [${groupName}]`);
    } catch (e) {
      html = `<div class="msg"><div class="mh"><b class="nm">${mediaSender}</b><span class="ts">${timeStr}</span></div><span class="ct">[upload failed: ${e.message.slice(0,60)}]</span></div>\n`;
      console.error(`[GDRIVE] Upload error: ${e.message}`);
    }
    return { groupName, dateStr, html };
  } catch (e) {
    console.error('[GDRIVE] Media Error:', e.message);
    return null;
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

  async function processEvent(event) {
    if (event.type !== 'message') return null;
    const msgType = event.message.type;
    const messageId = event.message.id;
    const userId = event.source.userId;
    const source = event.source;
    const groupName = await getGroupName(source);
    if (msgType === 'video') {
      console.log(`[SKIP] Video skipped: ${messageId}`);
      return null;
    }
    if (msgType === 'image') {
      return await buildMediaEntry(messageId, 'image', null, userId, source, groupName);
    }
    if (msgType === 'file') {
      const fileName = event.message.fileName || null;
      return await buildMediaEntry(messageId, 'file', fileName, userId, source, groupName);
    }
    if (msgType !== 'text') return null;

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
    const registerMatch = text.match(/^ฉัน\s+(.+)$/);
    if (registerMatch) {
      const inputName = registerMatch[1].trim();
      const member = findMemberByName(inputName);
      if (member) {
        await saveUserToSheets(userId, inputName, member.id);
        console.log(`[REGISTER] ${inputName} → id=${member.id}`);
      }
      return null;
    }
    const entry = await buildTextEntry(text, senderName, userId, source, groupName);
    const hasTrigger = LEAVE_RE.test(text) || TRIGGER_WORDS.some(w => text.includes(w));
    if (hasTrigger && knownMemberId) {
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
    return entry;
  }

  const entries = await Promise.all(events.map(event => processEvent(event).catch(e => {
    console.error('[EVENT] Error:', e.message);
    return null;
  })));

  const batches = {};
  for (const entry of entries.filter(Boolean)) {
    const key = `${entry.groupName}:::${entry.dateStr}`;
    if (!batches[key]) batches[key] = { groupName: entry.groupName, dateStr: entry.dateStr, html: '' };
    batches[key].html += entry.html;
  }
  await Promise.all(Object.values(batches).map(b => appendToLog(b.groupName, b.dateStr, b.html)));
  return res.status(200).json({ success: true });
}
