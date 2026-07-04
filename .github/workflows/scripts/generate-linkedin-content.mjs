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

Il tuo compito oggi è scegliere TU un argomento nuovo di educazione finanziaria (fiscalità, investimenti, previdenza, protezione del reddito, gestione della liquidità per partite IVA, pianificazione patrimoniale) che NON sia già stato trattato di recente. Ecco gli argomenti già coperti (evita ripetizioni tematiche, anche se puoi affrontare lo stesso macro-tema da un angolo diverso
