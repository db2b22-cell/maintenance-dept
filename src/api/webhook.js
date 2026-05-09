import crypto from 'crypto';

const CHANNEL_SECRET = '64fb0187ad83708a38015d673ab321d1';
const CHANNEL_ACCESS_TOKEN = '9UBzhgK+eli/utMHi1KicoF9Okr0IzxDGJuyme9qPHQrP7MnoivSGZhTzNK/7jZHGkSV3IfYCXntYMZiQ6t0j7+JKpF5Lq2mGXNszncGzw8M/uGn3HRCeAx2X1pQHr0cWjRbIkPIP1BVVp8EQNgxXAdB04t89/1O/w1cDnyilFU=';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwtslkpUh2oUtcgwE8ToA_tCueY_FHRXFepEyxIlsWap8X4YABgvJPab9dJX7C8ToZ7/exec';
const THAILLM_API_KEY = 'Bkz8utfd1YWQe0SBkuVzubDprXoWId1X';
const THAILLM_URL = 'https://thaillm.or.th/api/v1/chat/completions';

// ปิด body parser ของ Vercel เพื่อให้ได้ raw body สำหรับ signature verification
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

const TRIGGER_WORDS = ['ลา', 'ป่วย', 'ไม่สบาย', 'ไม่มา', 'หยุด', 'ติดธุระ', 'มาแล้ว', 'มาได้', 'ยกเลิกลา', 'ล่วงหน้า', 'พรุ่งนี้'];

// สกัดวันที่จากข้อความ รองรับ "พรุ่งนี้" และ "วันที่ X"
function extractLeaveDateFromText(text) {
  const now = new Date(new Date().getTime() + 7 * 60 * 60 * 1000); // Thai time
  const ty = now.getUTCFullYear().toString();
  const tm = String(now.getUTCMonth() + 1).padStart(2, '0');

  // รูปแบบ DD/MM/YYYY หรือ DD-MM-YYYY
  let m = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;

  // รูปแบบ "พรุ่งนี้"
  if (/พรุ่งนี้/.test(text)) {
    const tomorrow = new Date(now.getTime());
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const ty2 = tomorrow.getUTCFullYear().toString();
    const tm2 = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
    const td2 = String(tomorrow.getUTCDate()).padStart(2, '0');
    return `${ty2}-${tm2}-${td2}`;
  }

  // รูปแบบ "วันที่ 15" หรือ "วันที15"
  m = text.match(/วันที่?\s*(\d{1,2})/);
  if (m) return `${ty}-${tm}-${m[1].padStart(2,'0')}`;

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

async function analyzeWithGemini(text, senderName, knownMemberId) {
  const memberList = MEMBERS.map(m => `id=${m.id}: ${m.names.join('/')}`).join('\n');
  const senderInfo = knownMemberId
    ? `ผู้ส่ง: "${senderName}" (id=${knownMemberId})`
    : `ผู้ส่ง: "${senderName}"`;

  // Thai date context so LLM can resolve relative dates like "วันที่ 14"
  const now = new Date();
  const thaiNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const todayStr = thaiNow.toISOString().slice(0, 10);
  const thaiMonth = thaiNow.getUTCMonth() + 1;
  const thaiYear = thaiNow.getUTCFullYear();

  const prompt = `คุณคือระบบวิเคราะห์ข้อความในกลุ่มไลน์แผนกซ่อมบำรุง
วันนี้คือ ${todayStr} (เดือน ${thaiMonth} ปี ${thaiYear})

รายชื่อสมาชิก:
${memberList}

${senderInfo}
ข้อความ: "${text}"

วิเคราะห์ว่าเกี่ยวกับการลางานหรือไม่
- ถ้าไม่ระบุชื่อ ให้ถือว่าผู้ส่งเป็นคนลาเอง
- ถ้าระบุชื่อคนอื่น ให้ใช้ชื่อนั้น
- ลาล่วงหน้า = บอกล่วงหน้าว่าจะลาในวันอื่น (ไม่ใช่วันนี้)
- ถ้าบอกลาล่วงหน้า ให้คำนวณ startDate และ endDate เป็นรูปแบบ YYYY-MM-DD โดยใช้ปีและเดือนปัจจุบัน

ตอบ JSON เท่านั้น:
ลาล่วงหน้า/บอกล่วงหน้า/ลาวันที่.../ลา X วัน: {"action":"leave_advance","memberId":<id>,"memberName":"<ชื่อ>","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD"}
ลา/ป่วย/ไม่มา (วันนี้): {"action":"leave","memberId":<id>,"memberName":"<ชื่อ>","status":"<leave หรือ absent>"}
ยกเลิกลา/มาแล้ว: {"action":"cancel","memberId":<id>,"memberName":"<ชื่อ>","status":"present"}
ไม่เกี่ยว: {"action":"none"}`;

  try {
    const res = await fetch(THAILLM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${THAILLM_API_KEY}`
      },
      body: JSON.stringify({
        model: 'openthaigpt',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0
      })
    });
    const data = await res.json();
    const rawText = data?.choices?.[0]?.message?.content || '';
    const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;
    const result = JSON.parse(jsonMatch[0]);
    console.log(`[THAILLM] "${text}" → ${JSON.stringify(result)}`);
    return result;
  } catch (e) {
    console.error('[THAILLM] Error:', e.message);
    return null;
  }
}

async function updateSheet(memberId, status) {
  const params = new URLSearchParams({ action: 'setStatus', id: String(memberId), status });
  try {
    await fetch(`${SCRIPT_URL}?${params}`);
    console.log(`[SHEETS] id=${memberId} → ${status}`);
  } catch (e) {}
}

async function replyMessage(replyToken, text) {
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text }]
      })
    });
  } catch (e) {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // อ่าน raw body ก่อนแปลง JSON เพื่อ verify signature ถูกต้อง
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
    if (event.type !== 'message' || event.message.type !== 'text') continue;

    const text = event.message.text.trim();
    const userId = event.source.userId;
    const replyToken = event.replyToken;

    // === ระบบลงทะเบียน: "ฉัน [ชื่อ]" ===
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

    // ดึง memberId จาก cache (Sheets)
    let knownMemberId = await getMemberIdFromSheets(userId);

    // ถ้ายังไม่มี cache ลองดึงชื่อจาก LINE API
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

    // กรองเฉพาะข้อความที่เกี่ยวกับการลา
    const hasTrigger = TRIGGER_WORDS.some(w => text.includes(w));
    if (!hasTrigger) continue;

    const result = await analyzeWithGemini(text, '', knownMemberId);

    if (result && result.action !== 'none') {
      const finalId = result.memberId || knownMemberId;
      if (finalId) {
        if (result.action === 'leave_advance' && result.startDate) {
          const endDate = result.endDate || result.startDate;
          const status = `leave_advance:${result.startDate}:${endDate}`;
          await updateSheet(finalId, status);
        } else if (result.status) {
          // Fallback: ถ้า LLM บอกว่า leave แต่ข้อความมีวันในอนาคต → เปลี่ยนเป็น leave_advance
          let status = result.status;
          if (status === 'leave' || status === 'absent') {
            const thaiToday = new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
            const leaveDate = extractLeaveDateFromText(text);
            if (leaveDate && leaveDate > thaiToday) {
              status = `leave_advance:${leaveDate}:${leaveDate}`;
            }
          }
          await updateSheet(finalId, status);
        }
      }
    }
  }

  return res.status(200).json({ success: true });
}
