// Genera una nuova guida educativa dal prossimo argomento in content/topics.json.
// NON pubblica: scrive i file; il workflow apre una Pull Request da approvare.
import fs from 'fs';
import { execSync } from 'child_process';
const SITE = 'https://sagomafinanziaria.it';
const guides = JSON.parse(fs.readFileSync('content/guides.json', 'utf8'));
const topics = JSON.parse(fs.readFileSync('content/topics.json', 'utf8'));
const done = new Set(guides.map(g => g.slug));
const topic = topics.find(t => !done.has(t.slug));
if (!topic) { console.log('Nessun argomento rimasto in content/topics.json'); process.exit(0); }
if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY mancante');

const system = `Scrivi guide di EDUCAZIONE FINANZIARIA GENERICA in italiano per il sito Sagoma Finanziaria.
REGOLE VINCOLANTI:
- Contenuto generico e informativo. Mai consulenza personalizzata, mai raccomandazioni ("dovresti", "ti consiglio", "conviene investire").
- Vietato citare prodotti, fondi, ETF, banche, intermediari, ISIN, ticker, tassi o rendimenti numerici, promesse di guadagno, previsioni.
- Vietato citare città, territori, ING o il nome dell'autore nel testo (c'è già un disclaimer a parte).
- Nessun invito a contattare l'autore o a "prenotare una consulenza". Nessuna call to action commerciale.
- Nessun numero o statistica non verificabile: se serve un ordine di grandezza, usa formule come "come indicazione generica".
- Tono semplice e diretto, frasi brevi, esempi concreti non finanziari quando aiutano.
- Struttura: lead (2 frasi), 3-4 sezioni H2 con paragrafi o liste, 2-3 domande FAQ con risposte brevi (risposte autonome, utili se citate da sole da un motore di ricerca o da un'AI).
Rispondi SOLO con JSON valido: {"description":"max 155 caratteri","cardTitle":"titolo breve per card","summary":"1 frase per card, max 110 caratteri","lead":"testo","sections":[{"h2":"...","html":"<p>..</p> oppure <ul class='tips'><li>..</li></ul> oppure <ol class='tips'>..</ol>"}],"faq":[{"q":"...","a":"..."}]}`;

const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
  body: JSON.stringify({ model: process.env.MODEL || 'claude-sonnet-5-5', max_tokens: 4000, system,
    messages: [{ role: 'user', content: `Titolo: ${topic.title}\nTaglio: ${topic.angle}` }] })
});
if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
const raw = (await res.json()).content.map(c => c.text || '').join('');
const g = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));

// Controlli automatici di compliance: se falliscono, nessun file viene scritto
const text = JSON.stringify(g).toLowerCase();
const banned = [/\bing\b/, /la spezia|lunigiana|massa|carrara|genova|liguria/, /\b[a-z]{2}[a-z0-9]{9}\d\b/i, /\bisin\b|\betf\b|\bticker\b/,
  /ti consigli|dovresti|ti suggerisco|conviene (investire|comprare|acquistare)/, /prenota|contattami|contattaci|consulenza gratuita/,
  /garantit|rendimento (del|di) \d|\d+ ?%/, /matteo|cariola|sagoma/];
const hit = banned.find(r => r.test(text));
if (hit) throw new Error(`Controllo compliance fallito: ${hit}`);
if (!g.sections?.length || !g.faq?.length || g.description.length > 160) throw new Error('Struttura JSON non valida');

const shortTitle = t => t.length <= 58 ? t : t.slice(0, 58).replace(/\s+\S*$/, '').replace(/[:,;–-]\s*$/, '');
const today = new Date().toISOString().slice(0, 10);
const [y, m, d] = today.split('-');
const url = `${SITE}/guide/${topic.slug}.html`;
const rel = guides.slice(0, 3);
const j = o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;
const jsonLd = [
  j({ '@context':'https://schema.org','@type':'Article',headline:topic.title,description:g.description,inLanguage:'it',
    author:{'@type':'Person',name:'Matteo Cariola'},publisher:{'@type':'Organization',name:'Sagoma Finanziaria',url:`${SITE}/`},
    mainEntityOfPage:url,image:`${SITE}/img/og.png`,datePublished:today,dateModified:today }),
  j({ '@context':'https://schema.org','@type':'FAQPage',mainEntity:g.faq.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}})) }),
  j({ '@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[
    {'@type':'ListItem',position:1,name:'Home',item:`${SITE}/`},{'@type':'ListItem',position:2,name:'Guide',item:`${SITE}/guide/`},
    {'@type':'ListItem',position:3,name:topic.title,item:url}] })
].join('\n');

// Parti fisse prese da una guida esistente, per restare identici al design e al disclaimer
const tpl = fs.readFileSync(`guide/${guides[guides.length - 1].slug}.html`, 'utf8');
const disclaimer = tpl.match(/<p class="disclaimer">[\s\S]*?<\/p>/)[0];
const e = s => s.replace(/"/g, '&quot;');
const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${shortTitle(topic.title)} | Sagoma</title>
<meta name="description" content="${e(g.description)}">
<link rel="canonical" href="${url}">
<link rel="stylesheet" href="../css/style.css?v=20261029">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#0f2238">
<meta property="og:type" content="article">
<meta property="og:locale" content="it_IT">
<meta property="og:site_name" content="Sagoma Finanziaria">
<meta property="og:title" content="${e(topic.title)}">
<meta property="og:description" content="${e(g.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/img/og.png">
<meta name="twitter:card" content="summary_large_image">
${jsonLd}
</head>
<body class="has-sticky">
<a class="skip" href="#main">Vai al contenuto</a>
<header class="top"><div class="wrap">
  <a class="logo" href="../index.html">Sagoma <span>Finanziaria</span></a>
  <nav><a href="index.html">Guide</a><a href="../test-liquidita.html">Mini-test</a></nav>
</div></header>
<main class="wrap" id="main">
  <p class="crumbs"><a href="../index.html">Home</a> › <a href="index.html">Guide</a> › ${topic.title}</p>
  <article>
    <span class="eyebrow">Guida · educazione finanziaria</span>
    <h1>${topic.title}</h1>
    <p class='meta'>Lettura: circa 2 min · aggiornata il ${d}/${m}/${y}</p>
    <p class="lead">${g.lead}</p>
    ${g.sections.map(s => `<h2>${s.h2}</h2>${s.html}`).join('')}
    <h2>Domande frequenti</h2>${g.faq.map(f => `<details><summary>${f.q}</summary><p>${f.a}</p></details>`).join('')}
    <div class="related"><h3>Continua a leggere</h3><div class="grid">${rel.map(r => `<a class="gcard" href="${r.slug}.html"><h3>${r.cardTitle}</h3><p>${r.summary}</p><span>2 min →</span></a>`).join('')}</div></div>
    <div class="card">
      <h3>Fai il punto in 2 minuti</h3>
      <p>Il mini-test gratuito ti dà un quadro generico sulla tua liquidità. Nessun dato personale per vedere il risultato.</p>
      <a class="btn gold" href="../test-liquidita.html">Inizia il mini-test</a>
    </div>
    ${disclaimer}
  </article>
</main>
<footer><div class="wrap wide"><div class="cols"><a href="../index.html">Home</a><a href="../guide/">Guide</a><a href="../test-liquidita.html">Mini-test</a><a href="../privacy.html">Privacy</a></div>Sagoma Finanziaria · di Matteo Cariola · P.IVA 01598930111 · contenuti di educazione finanziaria generica, non costituiscono consulenza né sollecitazione all’investimento.</div></footer>
<div class="sticky"><a class="btn gold" href="../test-liquidita.html">Fai il mini-test (2 min)</a></div>
</body>
</html>
`;
fs.writeFileSync(`guide/${topic.slug}.html`, html);
guides.unshift({ slug: topic.slug, title: topic.title, description: g.description, cardTitle: g.cardTitle, summary: g.summary, date: today, modified: today });
fs.writeFileSync('content/guides.json', JSON.stringify(guides, null, 2) + '\n');
execSync('node scripts/build-indexes.mjs', { stdio: 'inherit' });
console.log('Creata guida:', topic.slug);
