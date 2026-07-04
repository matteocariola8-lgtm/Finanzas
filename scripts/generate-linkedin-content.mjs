// Sagoma Finanziaria — Generatore autonomo contenuti LinkedIn + Blog
// Gira dentro una GitHub Action schedulata. Non richiede input manuale:
// sceglie da solo l'argomento (evitando ripetizioni), genera testo LinkedIn,
// immagine brandizzata, hashtag, e pubblica lo stesso contenuto come articolo
// sul blog del sito (blog.html) tramite commit diretto sul repo.
// Infine invia il contenuto al webhook Make.com per la pubblicazione su LinkedIn.

import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
const SITE_BASE_URL = process.env.SITE_BASE_URL || 'https://sagomafinanziaria.it';
const MODEL = 'claude-sonnet-4-6';

const ROOT = process.cwd();
const HISTORY_PATH = path.join(ROOT, 'content', 'topics-history.json');
const BLOG_PATH = path.join(ROOT, 'blog.html');
const ASSETS_DIR = path.join(ROOT, 'assets', 'social');

if (!ANTHROPIC_API_KEY) throw new Error('Manca il secret ANTHROPIC_API_KEY.');
if (!MAKE_WEBHOOK_URL) throw new Error('Manca il secret MAKE_WEBHOOK_URL.');

async function loadHistory() {
  try {
    const raw = await fs.readFile(HISTORY_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveHistory(history) {
  await fs.mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  await fs.writeFile(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n', 'utf-8');
}

function stripCodeFence(s) {
  return s.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
}

async function callClaude(prompt, maxTokens = 2600) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Errore API Anthropic: ${res.status} ${errText}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

async function generateContent(history) {
  const pastTopics = history.slice(-40).map(h => `- ${h.topic} (${h.date})`).join('\n') || '(nessuno finora)';

  const prompt = `Sei il copywriter di Sagoma Finanziaria (Matteo Cariola, consulente finanziario ING Italia, zona La Spezia/Massa Carrara/Lunigiana). Target: professionisti, imprenditori, liberi professionisti/partite IVA italiane. Tono autorevole ma accessibile, italiano, niente gergo tecnico non spiegato.

Il tuo compito oggi è scegliere TU un argomento nuovo di educazione finanziaria (fiscalità, investimenti, previdenza, protezione del reddito, gestione della liquidità per partite IVA, pianificazione patrimoniale) che NON sia già stato trattato di recente. Ecco gli argomenti già coperti (evita ripetizioni tematiche, anche se puoi affrontare lo stesso macro-tema da un angolo diverso dopo molte settimane):
${pastTopics}

Genera:
1. "topic": una frase breve che riassume l'argomento scelto (per tenerne traccia)
2. "hook": titolo breve per l'immagine di accompagnamento (max 10 parole)
3. "linkedin_post": post LinkedIn nativo (1200-1800 caratteri), hook nella prima riga (deve reggersi da solo prima del "vedi altro"), corpo con interruzioni di riga frequenti, un dato concreto o esempio, domanda finale che inviti al confronto nei commenti
4. "hashtags": 5-8 hashtag performanti per il settore consulenza/educazione finanziaria in Italia su LinkedIn
5. "blog_title": titolo articolo per il blog (max 90 caratteri)
6. "blog_excerpt": estratto breve (180-220 caratteri)
7. "blog_category": una tra "ETF & Fondi", "Pianificazione", "Fiscalità", "Mercati", "Educazione"
8. "blog_tags": 3 tag brevi

Rispondi SOLO con un oggetto JSON valido, nessun testo prima o dopo, nessun blocco markdown:
{
  "topic": "...",
  "hook": "...",
  "linkedin_post": "...",
  "hashtags": ["#tag1","#tag2"],
  "blog_title": "...",
  "blog_excerpt": "...",
  "blog_category": "...",
  "blog_tags": ["Tag1","Tag2","Tag3"]
}`;

  const raw = await callClaude(prompt);
  const clean = stripCodeFence(raw);
  let data;
  try {
    data = JSON.parse(clean);
  } catch (e) {
    console.error('--- Risposta grezza AI (non parsabile come JSON) ---');
    console.error(raw);
    throw new Error('Risposta AI non in JSON valido: ' + e.message);
  }
  if (!data.linkedin_post || !data.hook || !data.topic) {
    console.error('--- Risposta AI (JSON incompleto) ---');
    console.error(JSON.stringify(data, null, 2));
    throw new Error('Risposta AI incompleta: mancano campi obbligatori (topic/hook/linkedin_post).');
  }
  return data;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function renderImage(hook, outPath) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@500;600&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;}
    body{width:1080px;height:1080px;background:linear-gradient(155deg,#0A1628 0%,#0d1d33 100%);
         font-family:'Inter',Arial,sans-serif;position:relative;overflow:hidden;}
    .brand{position:absolute;top:60px;left:60px;display:flex;align-items:center;gap:16px;}
    .logo{width:56px;height:56px;background:#C5A84B;border-radius:12px;display:flex;align-items:center;
          justify-content:center;font-family:'Playfair Display',serif;font-weight:700;color:#0A1628;font-size:26px;}
    .brandname{font-size:20px;letter-spacing:.12em;text-transform:uppercase;color:#C5A84B;font-weight:600;}
    .body{position:absolute;left:80px;right:80px;top:50%;transform:translateY(-50%);}
    .title{font-family:'Playfair Display',Georgia,serif;font-weight:700;color:#fff;font-size:58px;line-height:1.3;}
    .foot{position:absolute;bottom:60px;left:80px;right:80px;display:flex;justify-content:space-between;
          align-items:center;border-top:1px solid rgba(197,168,75,0.25);padding-top:24px;}
    .handle{font-size:20px;color:rgba(255,255,255,0.55);letter-spacing:.03em;}
  </style></head>
  <body>
    <div class="brand"><div class="logo">SF</div><div class="brandname">Sagoma Finanziaria</div></div>
    <div class="body"><div class="title">${escapeHtml(hook)}</div></div>
    <div class="foot"><div class="handle">Matteo Cariola · Consulente Finanziario</div></div>
  </body></html>`;

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await page.screenshot({ path: outPath, type: 'png' });
  } finally {
    await browser.close();
  }
}

async function publishToBlog({ blog_title, blog_excerpt, blog_category, blog_tags }) {
  const content = await fs.readFile(BLOG_PATH, 'utf-8');
  const marker = '<!-- ═══ INIZIO POSTS — inserire nuovi articoli qui sotto ═══ -->';
  if (!content.includes(marker)) throw new Error('Marker non trovato in blog.html.');

  const now = new Date();
  const mesi = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  const dataStr = `${now.getDate()} ${mesi[now.getMonth()]} ${now.getFullYear()}`;
  const ALLOWED_CATEGORIES = ['ETF & Fondi', 'Pianificazione', 'Fiscalità', 'Mercati', 'Educazione'];
  const emojiByCategory = {
    'ETF & Fondi': '📊', 'Pianificazione': '📈', 'Fiscalità': '🧾', 'Mercati': '📉', 'Educazione': '🎯'
  };
  const safeCategory = ALLOWED_CATEGORIES.includes(blog_category) ? blog_category : 'Educazione';
  if (safeCategory !== blog_category) {
    console.warn(`Categoria AI non riconosciuta ("${blog_category}"), uso fallback "Educazione".`);
  }
  const emoji = emojiByCategory[safeCategory];
  const tagsHtml = (blog_tags || []).map(t => `<span class="post-tag">${escapeHtml(t)}</span>`).join('');

  const postHtml = `
      <a href="#" class="blog-post-card" style="display:grid;">
        <div class="blog-post-thumb" style="background:var(--navy);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:2rem;">${emoji}</div>
        <div>
          <div class="post-meta"><span class="post-cat">${escapeHtml(safeCategory)}</span><span class="post-date">${dataStr}</span></div>
          <h2 class="post-title">${escapeHtml(blog_title)}</h2>
          <p class="post-excerpt">${escapeHtml(blog_excerpt)}</p>
          <div class="post-tags">${tagsHtml}</div>
        </div>
      </a>`;

  const updated = content.replace(marker, marker + postHtml);
  await fs.writeFile(BLOG_PATH, updated, 'utf-8');
}

async function notifyMakeWebhook({ linkedin_post, hashtags, hook, imageFileName }) {
  const imagePath = path.join(ASSETS_DIR, imageFileName);
  const imageBuffer = await fs.readFile(imagePath);
  const imageBase64 = imageBuffer.toString('base64');
  const imageUrl = `${SITE_BASE_URL}/assets/social/${imageFileName}`;

  const fullText = `${linkedin_post}\n\n${(hashtags || []).join(' ')}`;

  const res = await fetch(MAKE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: fullText,
      linkedin_post,
      hashtags: hashtags || [],
      hook,
      imageUrl,
      imageBase64,
      imageMimeType: 'image/png'
    })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Webhook Make.com fallito: ${res.status} ${t}`);
  }
}

async function main() {
  console.log('[1/5] Carico storico argomenti...');
  const history = await loadHistory();

  const today = new Date().toISOString().slice(0, 10);
  if (history.length && history[history.length - 1].date === today) {
    console.log(`Esiste già un contenuto generato oggi (${today}). Salto per evitare doppioni.`);
    console.log('Se vuoi forzare una seconda generazione oggi, lancia comunque "Run workflow" manualmente: questo controllo blocca solo esecuzioni automatiche duplicate nello stesso giorno.');
    return;
  }

  console.log('[2/5] Genero contenuto con Claude...');
  const data = await generateContent(history);
  console.log('Argomento scelto:', data.topic);

  console.log('[3/5] Rendo immagine...');
  const imageFileName = `linkedin-${Date.now()}.png`;
  await renderImage(data.hook, path.join(ASSETS_DIR, imageFileName));

  console.log('[4/5] Pubblico articolo su blog.html...');
  await publishToBlog(data);

  console.log('[5/5] Aggiorno storico e invio a Make.com...');
  history.push({ topic: data.topic, title: data.blog_title, date: new Date().toISOString().slice(0, 10) });
  await saveHistory(history);

  await notifyMakeWebhook({
    linkedin_post: data.linkedin_post,
    hashtags: data.hashtags,
    hook: data.hook,
    imageFileName
  });

  console.log('Fatto. Argomento:', data.topic);
}

main().catch(err => {
  console.error('ERRORE:', err);
  process.exit(1);
});
