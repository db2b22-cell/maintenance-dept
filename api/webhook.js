import crypto from 'crypto';

const CHANNEL_SECRET = '64fb0187ad83708a38015d673ab321d1';
const CHANNEL_ACCESS_TOKEN = 'zAxex+H02fBeebm6uRsJz4gYYxWk7Jxpxa+w2Hzc5XYLEFBxT1CCXT/IFkC+TYb8GkSV3IfYCXntYMZiQ6t0j7+JKpF5Lq2mGXNszncGzw/rE6xOdsnYVA7P+wFbt/c7/v8hHXXE1IAYyp+i86mUOgdB04t89/1O/w1cDnyilFU=';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwtslkpUh2oUtcgwE8ToA_tCueY_FHRXFepEyxIlsWap8X4YABgvJPab9dJX7C8ToZ7/exec';
const LINE_LOGGER_URL = process.env.LINE_LOGGER_URL || 'https://line-logger-ten.vercel.app';
const INGEST_SECRET = process.env.INGEST_SECRET || 'b652ad7b9fbc9b175a3f6c1c99406333';
const MY_MEMBER_ID = 6; // อุดมชัย

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

// ---- Utilities ----
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
        const name = (data.groupName || gid).replace(/[\/\\:*?"<>|]/g, '_').replace(/[\s.]+$/, '');
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
  }
  return 'Direct';
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

function quickDetect(text, memberId) {
  if (CANCEL_WORDS.some(w => text.includes(w)))
    return { action: 'cancel', memberId, status: 'present' };
  if (LEAVE_RE.test(text) || LEAVE_WORDS.some(w => text.includes(w)))
    return { action: 'leave', memberId, status: 'leave' };
  return null;
}

// ---- Forward to line-logger (await to prevent Vercel from freezing before request sent) ----
async function forwardToLogger(events) {
  if (!events.length) return;
  try {
    const res = await fetch(`${LINE_LOGGER_URL}/api/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ingest-secret': INGEST_SECRET,
      },
      body: JSON.stringify({ events }),
    });
    if (!res.ok) console.error('[LOGGER] Forward failed:', res.status);
  } catch (e) {
    console.error('[LOGGER] Forward error:', e.message);
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

  // Attach groupName to each event
  const enrichedEvents = await Promise.all(events.map(async event => {
    if (event.type !== 'message') return event;
    const groupName = await getGroupName(event.source).catch(() => 'unknown');
    return { ...event, groupName };
  }));

  // Run forwardToLogger concurrently with leave detection, await both before responding
  await Promise.all([
    forwardToLogger(enrichedEvents),
    Promise.all(events.map(async event => {
      if (event.type !== 'message' || event.message.type !== 'text') return;
      const userId = event.source.userId;
      const source = event.source;
      const text = event.message.text.trim();

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

      // Self-register command
      const registerMatch = text.match(/^ฉัน\s+(.+)$/);
      if (registerMatch) {
        const inputName = registerMatch[1].trim();
        const member = findMemberByName(inputName);
        if (member) await saveUserToSheets(userId, inputName, member.id);
        return;
      }

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
    }))
  ]);

  return res.status(200).json({ success: true });
}
