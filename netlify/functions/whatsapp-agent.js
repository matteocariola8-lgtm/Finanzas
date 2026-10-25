// Segretario AI — agente WhatsApp (Kapso + Claude + Google Calendar)
// Env richieste (Netlify): KAPSO_API_KEY, KAPSO_PHONE_NUMBER_ID, KAPSO_WEBHOOK_SECRET,
// ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
// Opzionali: GOOGLE_CALENDAR_ID (default "primary"), OWNER_WHATSAPP (tuo numero, per notifiche),
// ANTHROPIC_MODEL, SLOT_MINUTES (30), WORK_START (9), WORK_END (18)
const crypto = require('crypto');

const KAPSO_BASE = 'https://api.kapso.ai/meta/whatsapp/v24.0';
const TZ = 'Europe/Rome';
const SLOT = parseInt(process.env.SLOT_MINUTES || '30', 10);
const WSTART = parseInt(process.env.WORK_START || '9', 10);
const WEND = parseInt(process.env.WORK_END || '18', 10);
const CAL = process.env.GOOGLE_CALENDAR_ID || 'primary';

const SYSTEM = `Sei il Segretario AI di Matteo Cariola, consulente finanziario. Rispondi su WhatsApp in italiano, in modo cordiale, breve e professionale (max 3-4 righe).
Compiti: dare disponibilità e fissare appuntamenti (chiamata o incontro), confermare, spostare/annullare richieste (in tal caso avvisa che Matteo ti ricontatterà).
REGOLE RIGIDE:
- Non trattare MAI dati finanziari: niente importi, prodotti, rendimenti, consigli o dati di conto. Se il cliente li chiede, rispondi che ne parlerà direttamente Matteo in appuntamento.
- Non chiedere IBAN, password, codici o documenti.
- Per prenotare servono: nome e cognome, giorno e ora scelti tra quelli liberi. Usa gli strumenti, non inventare orari.
- Date relative ("venerdì") risolvile con la data odierna indicata sotto. Fuso: Europe/Rome.
- Se non sai o la richiesta è fuori ambito, di' che Matteo risponderà appena possibile.`;

const TOOLS = [
  {
    name: 'get_free_slots',
    description: 'Restituisce gli orari liberi in un giorno (YYYY-MM-DD) nel calendario di Matteo.',
    input_schema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] },
  },
  {
    name: 'book_appointment',
    description: 'Prenota un appuntamento. start = ISO locale es. 2026-10-30T10:00.',
    input_schema: {
      type: 'object',
      properties: { name: { type: 'string' }, start: { type: 'string' }, note: { type: 'string' } },
      required: ['name', 'start'],
    },
  },
];

// ---------- helpers ----------
const res = (code, body) => ({ statusCode: code, body: typeof body === 'string' ? body : JSON.stringify(body) });

function verify(raw, sig) {
  const secret = process.env.KAPSO_WEBHOOK_SECRET;
  if (!secret) return false; // fail closed
  const h = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(h), b = Buffer.from(String(sig || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function sendText(to, body) {
  const r = await fetch(`${KAPSO_BASE}/${process.env.KAPSO_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { 'X-API-Key': process.env.KAPSO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
  });
  if (!r.ok) console.error('Kapso send error', r.status, await r.text());
}

// Estrae {from, text} in modo tollerante (formato Meta o Kapso, singolo o batch)
function extractMessages(payload) {
  const items = payload && payload.batch && Array.isArray(payload.data) ? payload.data : [payload];
  const out = [];
  for (const p of items) {
    const m = (p && (p.message || (p.data && p.data.message))) || p;
    const from = m.from || (p.conversation && p.conversation.phone_number) || p.phone_number || (p.data && p.data.from);
    const text = (m.text && (m.text.body || m.text)) || m.body || m.content;
    if (from && typeof text === 'string' && text.trim()) out.push({ from: String(from).replace(/^\+/, ''), text });
  }
  return out;
}

// ---------- Google Calendar ----------
async function gToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google token error');
  return j.access_token;
}

// offset Europe/Rome per una data locale (gestisce ora legale)
function romeOffset(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' }).formatToParts(d);
  const n = parts.find((p) => p.type === 'timeZoneName').value; // GMT+1 / GMT+2
  const h = parseInt(n.replace('GMT', '') || '0', 10);
  return `${h < 0 ? '-' : '+'}${String(Math.abs(h)).padStart(2, '0')}:00`;
}
const iso = (local) => `${local.slice(0, 10)}T${local.slice(11, 16)}:00${romeOffset(local.slice(0, 10))}`;

async function getFreeSlots(date) {
  const tok = await gToken();
  const off = romeOffset(date);
  const r = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin: `${date}T00:00:00${off}`, timeMax: `${date}T23:59:59${off}`, timeZone: TZ, items: [{ id: CAL }],
    }),
  });
  const j = await r.json();
  const busy = ((j.calendars && j.calendars[CAL] && j.calendars[CAL].busy) || []).map((b) => [Date.parse(b.start), Date.parse(b.end)]);
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (dow === 0 || dow === 6) return [];
  const free = [];
  for (let m = WSTART * 60; m + SLOT <= WEND * 60; m += SLOT) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0'), mm = String(m % 60).padStart(2, '0');
    const s = Date.parse(iso(`${date}T${hh}:${mm}`)), e = s + SLOT * 60000;
    if (s > Date.now() && !busy.some(([bs, be]) => s < be && e > bs)) free.push(`${hh}:${mm}`);
  }
  return free;
}

async function book(name, start, note, phone) {
  const free = await getFreeSlots(start.slice(0, 10));
  if (!free.includes(start.slice(11, 16))) return { ok: false, error: 'Slot non disponibile', liberi: free };
  const tok = await gToken();
  const s = iso(start), e = new Date(Date.parse(s) + SLOT * 60000).toISOString();
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: `Appuntamento ${name}`,
      description: `Prenotato via WhatsApp (+${phone}).${note ? ' Note: ' + note : ''}`,
      start: { dateTime: s, timeZone: TZ }, end: { dateTime: e, timeZone: TZ },
    }),
  });
  if (!r.ok) return { ok: false, error: 'Errore calendario' };
  if (process.env.OWNER_WHATSAPP) {
    await sendText(process.env.OWNER_WHATSAPP, `Nuovo appuntamento: ${name} (+${phone}) il ${start.replace('T', ' alle ')}`);
  }
  return { ok: true };
}

// ---------- Claude ----------
async function runTool(name, input, phone) {
  try {
    if (name === 'get_free_slots') return { liberi: await getFreeSlots(input.date) };
    if (name === 'book_appointment') return await book(input.name, input.start, input.note, phone);
  } catch (e) {
    console.error(name, e);
  }
  return { ok: false, error: 'Errore tecnico' };
}

async function ask(history, phone) {
  const today = new Intl.DateTimeFormat('it-IT', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' }).format(new Date());
  const messages = [...history];
  for (let i = 0; i < 5; i++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 500,
        system: `${SYSTEM}\nOggi: ${today}.`,
        tools: TOOLS,
        messages,
      }),
    });
    const j = await r.json();
    if (!j.content) { console.error('Anthropic error', JSON.stringify(j)); return 'Ti risponderà Matteo appena possibile.'; }
    if (j.stop_reason !== 'tool_use') return j.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
    messages.push({ role: 'assistant', content: j.content });
    const results = [];
    for (const c of j.content.filter((x) => x.type === 'tool_use')) {
      results.push({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(await runTool(c.name, c.input, phone)) });
    }
    messages.push({ role: 'user', content: results });
  }
  return 'Ti risponderà Matteo appena possibile.';
}

// Memoria breve per conversazione (best-effort, in-memory; si azzera a freddo)
const memory = new Map();
const seen = new Set();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return res(405, 'Method not allowed');
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body || '';
  const h = event.headers || {};
  if (!verify(raw, h['x-webhook-signature'] || h['X-Webhook-Signature'])) return res(401, 'Invalid signature');

  const idem = h['x-idempotency-key'] || h['X-Idempotency-Key'];
  if (idem) { if (seen.has(idem)) return res(200, 'dup'); seen.add(idem); if (seen.size > 500) seen.clear(); }

  let payload;
  try { payload = JSON.parse(raw); } catch { return res(400, 'Bad JSON'); }

  for (const { from, text } of extractMessages(payload)) {
    if (process.env.OWNER_WHATSAPP && from === process.env.OWNER_WHATSAPP.replace(/^\+/, '')) continue;
    const hist = memory.get(from) || [];
    hist.push({ role: 'user', content: text });
    let win = hist.slice(-11);
    while (win.length && win[0].role !== 'user') win.shift();
    const reply = await ask(win, from);
    hist.push({ role: 'assistant', content: reply });
    memory.set(from, hist.slice(-12));
    await sendText(from, reply);
  }
  return res(200, 'ok');
};
