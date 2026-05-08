export const config = { runtime: 'edge' };

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwtslkpUh2oUtcgwE8ToA_tCueY_FHRXFepEyxIlsWap8X4YABgvJPab9dJX7C8ToZ7/exec';

export default async function handler(req) {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        if (!closed) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        }
      };

      // โหลดข้อมูลเริ่มต้น + ส่งให้ client ทันที
      let lastHash = '';
      try {
        const res = await fetch(`${SCRIPT_URL}?_=${Date.now()}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          lastHash = data.map(m => `${m.id}:${m.status}`).join(',');
          send({ type: 'init', data });
        }
      } catch (e) {}

      // รอดักการเปลี่ยนแปลง สูงสุด 25 วินาที แล้ว client จะ reconnect เอง
      const deadline = Date.now() + 25000;
      while (Date.now() < deadline && !closed) {
        await new Promise(r => setTimeout(r, 3000));
        if (closed) break;
        try {
          const res = await fetch(`${SCRIPT_URL}?_=${Date.now()}`);
          const data = await res.json();
          if (Array.isArray(data)) {
            const hash = data.map(m => `${m.id}:${m.status}`).join(',');
            if (hash !== lastHash) {
              lastHash = hash;
              send({ type: 'update', data });
            }
          }
        } catch (e) {}
      }

      if (!closed) {
        send({ type: 'reconnect' });
        controller.close();
      }
    },
    cancel() { closed = true; }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
