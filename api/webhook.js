import crypto from 'crypto';

const CHANNEL_SECRET = '64fb0187ad83708a38015d673ab321d1';
const CHANNEL_ACCESS_TOKEN = '9UBzhgK+eli/utMHi1KicoF9Okr0IzxDGJuyme9qPHQrP7MnoivSGZhTzNK/7jZHGkSV3IfYCXntYMZiQ6t0j7+JKpF5Lq2mGXNszncGzw8M/uGn3HRCeAx2X1pQHr0cWjRbIkPIP1BVVp8EQNgxXAdB04t89/1O/w1cDnyilFU=';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwtslkpUh2oUtcgwE8ToA_tCueY_FHRXFepEyxIlsWap8X4YABgvJPab9dJX7C8ToZ7/exec';
const THAILLM_API_KEY = 'Bkz8utfd1YWQe0SBkuVzubDprXoWId1X';
const THAILLM_URL = 'https://thaillm.or.th/api/v1/chat/completions';

// URL ของ NLP Classifier Server (WangchanBERTa บน Google Colab + ngrok)
// ตั้งค่าใน Vercel Environment Variables: NLP_CLASSIFIER_URL
const NLP_CLASSIFIER_URL = process.env.NLP_CLASSIFIER_URL || '';

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

// ─── ขั้นที่ 1: Thai NLP Classifier (WangchanBERTa) ──────────────────────────
// เรียก inference server ที่ run บน Google Colab
// คืนค่า true = เกี่ยวกับการลา → ส่งต่อให้ LLM
// คืนค่า false = ข้อความทั่วไป → หยุดที่นี่ (ประหยัด LLM token)
async function classifyWithNLP(text) {
  if (!NLP_CLASSIFIER_URL) {
    // ถ้ายังไม่ได้ตั้งค่า NLP server ให้ fallback ไปใช้ broad regex
    console.warn('[NLP] NLP_CLASSIFIER_URL not set, using regex fallback');
    return LEAVE_BROAD_RE.test(text);
  }

  try {
    const res = await fetch(`${NLP_CLASSIFIER_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(3000), // timeout 3s ไม่ให้ block
    });
    const data = await res.json();
    console.log(`[NLP] "${text}" → is_leave=${data.is_leave} conf=${data.confidence}`);
    return data.is_leave === true;
  } catch (e) {
    // NLP server ไม่ตอบ (Colab หยุด ฯลฯ) → fallback regex
    console.warn('[NLP] classifier unavailable, using regex fallback:', e.message);
    return LEAVE_BROAD_RE.test(text);
  }
}

// broad regex fallback (ใช้ตอน NLP server ไม่พร้อม)
const LEAVE_BROAD_RE = new RegExp(
  'ลา|ไม่มา|ไม่สบาย|ป่วย|หยุด|ติดธุระ|มีธุระ|' +
  'มาแล้ว|มาได้|ยกเลิก|หาหมอ|นัดหมอ|พบแพทย์|' +
  'ลาบ่าย|ลาเช้า|ครึ่งวัน|ลากิจ|ลาพักร้อน|ลาคลอด'
);

// ─── ขั้นที่ 2: LLM (OpenThaiGPT) extract บริบท ─────────────────────────────
// เรียกเฉพาะเมื่อ NLP classifier ยืนยันว่าเกี่ยวกับการลาแล้ว
// ทำหน้าที่: ระบุว่าใคร ลาวันไหน ประเภทใด ยกเลิกหรือเปล่า
async function extractLeaveContextWithLLM(text, senderName, knownMemberId) {
  const memberList = MEMBERS.map(m => `id=${m.id}: ${m.names.join('/')}`).join('\n');
  const senderInfo = knownMemberId
    ? `ผู้ส่ง: "${senderName || '?'}" (memberId=${knownMemberId})`
    : `ผู้ส่ง: "${senderName || 'ไม่ทราบ'}"`;

  const now = new Date();
  const thaiNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const todayStr = thaiNow.toISOString().slice(0, 10);
  const thaiMonth = thaiNow.getUTCMonth() + 1;
  const thaiYear = thaiNow.getUTCFullYear();

  const prompt = `ข้อความนี้ผ่านการตรวจแล้วว่าเกี่ยวกับการลางาน
วันนี้: ${todayStr} (เดือน ${thaiMonth} ปี ${thaiYear})

รายชื่อสมาชิก:
${memberList}

${senderInfo}
ข้อความ: "${text}"

สกัด JSON เท่านั้น:
- ถ้าไม่ระบุชื่อ → memberId = ผู้ส่ง
- "พรุ่งนี้" = ${new Date(thaiNow.getTime() + 86400000).toISOString().slice(0, 10)}
- "มะรืนนี้" = ${new Date(thaiNow.getTime() + 172800000).toISOString().slice(0, 10)}
- "วันที่ X" ไม่มีเดือน → เดือน ${thaiMonth} ปี ${thaiYear}
- ลาหลายวัน → startDate ถึง endDate
- วันลา > ${todayStr} → action = leave_advance

ลาวันนี้/ไม่มาวันนี้: {"action":"leave","memberId":<id>,"memberName":"<ชื่อ>","status":"leave"}
ป่วย/ไม่สบาย: {"action":"leave","memberId":<id>,"memberName":"<ชื่อ>","status":"absent"}
ลาล่วงหน้า: {"action":"leave_advance","memberId":<id>,"memberName":"<ชื่อ>","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD"}
ยกเลิก/มาแล้ว: {"action":"cancel","memberId":<id>,"memberName":"<ชื่อ>","status":"present"}`;

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
        max_tokens: 150,
        temperature: 0
      })
    });
    const data = await res.json();
    const rawText = data?.choices?.[0]?.message?.content || '';
    const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;
    const result = JSON.parse(jsonMatch[0]);
    console.log(`[LLM] "${text}" → ${JSON.stringify(result)}`);
    return result;
  } catch (e) {
    console.error('[LLM] Error:', e.message);
    return null;
  }
}

// ─── Utility functions ────────────────────────────────────
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

// fallback สกัดวันที่จาก text เผื่อ LLM ตีความ action ผิด (leave แต่จริงๆ เป็น leave_advance)
function extractLeaveDateFromText(text) {
  const now = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
  const ty = now.getUTCFullYear().toString();
  const tm = String(now.getUTCMonth() + 1).padStart(2, '0');

  let m = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;

  if (/พรุ่งนี้/.test(text)) {
    const t = new Date(now.getTime() + 86400000);
    return t.toISOString().slice(0, 10);
  }
  if (/มะรืน/.test(text)) {
    const t = new Date(now.getTime() + 172800000);
    return t.toISOString().slice(0, 10);
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

// ─── Main handler ─────────────────────────────────────────
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

  for (const event of (body.events || [])) {
    if (event.type !== 'message' || event.message.type !== 'text') continue;

    const text = event.message.text.trim();
    const userId = event.source.userId;

    // ─── ระบบลงทะเบียน: "ฉัน [ชื่อ]" ───────────────────
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

    // ดึง memberId
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

    // ─── ขั้นที่ 1: NLP Classifier (WangchanBERTa) ──────
    // ถ้าไม่ใช่การลา → หยุด ไม่เรียก LLM (ประหยัด token)
    const isLeaveRelated = await classifyWithNLP(text);
    if (!isLeaveRelated) {
      console.log(`[NLP] skip: "${text}"`);
      continue;
    }

    // ─── ขั้นที่ 2: LLM extract context ─────────────────
    // เรียก LLM เฉพาะข้อความที่ NLP ยืนยันว่าเกี่ยวกับการลา
    const result = await extractLeaveContextWithLLM(text, '', knownMemberId);
    if (!result || result.action === 'none') continue;

    const finalId = result.memberId || knownMemberId;
    if (!finalId) continue;

    if (result.action === 'leave_advance' && result.startDate) {
      const endDate = result.endDate || result.startDate;
      await updateSheet(finalId, `leave_advance:${result.startDate}:${endDate}`);

    } else if (result.action === 'cancel' || result.status === 'present') {
      await updateSheet(finalId, 'present');

    } else if (result.status) {
      let status = result.status;
      // safety check: ถ้า LLM บอก leave แต่ข้อความมีวันอนาคต → แก้ให้ถูก
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

  return res.status(200).json({ success: true });
}
