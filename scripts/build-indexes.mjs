// Ricostruisce indici, sitemap, feed RSS e llms.txt a partire da content/guides.json
import fs from 'fs';
const SITE = 'https://sagomafinanziaria.it';
const guides = JSON.parse(fs.readFileSync('content/guides.json', 'utf8'));
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const card = (g, prefix, label) =>
  `<a class="gcard" href="${prefix}${g.slug}.html"><h3>${g.cardTitle}</h3><p>${g.summary}</p><span>${label} →</span></a>`;
const swap = (file, tag, html) => {
  const s = fs.readFileSync(file, 'utf8');
  const re = new RegExp(`(<!--${tag}-->)[\\s\\S]*?(<!--/${tag}-->)`);
  if (!re.test(s)) throw new Error(`marker ${tag} mancante in ${file}`);
  fs.writeFileSync(file, s.replace(re, `$1${html}$2`));
};

// Home: ultime 6 guide
swap('index.html', 'GUIDE-HOME',
  `<div class="grid">${guides.slice(0,6).map(g=>card(g,'guide/','2 min')).join('')}</div>` +
  `<p style="margin-top:16px"><a href="guide/">Tutte le ${guides.length} guide →</a></p>`);

// Indice guide + ItemList + descrizione
swap('guide/index.html', 'GUIDE-LIST',
  `<div class="grid">${guides.map(g=>card(g,'','2 min di lettura')).join('')}</div>`);
let gi = fs.readFileSync('guide/index.html', 'utf8');
const list = { '@context':'https://schema.org','@type':'ItemList',
  itemListElement: guides.map((g,i)=>({'@type':'ListItem',position:i+1,url:`${SITE}/guide/${g.slug}.html`,name:g.title})) };
gi = gi.replace(/<script type="application\/ld\+json">\{"@context": "https:\/\/schema.org", "@type": "ItemList".*?<\/script>/s,
  `<script type="application/ld+json">${JSON.stringify(list)}</script>`);
gi = gi.replace(/content="\d+ guide pratiche/, `content="${guides.length} guide pratiche`);
fs.writeFileSync('guide/index.html', gi);

// Sitemap
const today = new Date().toISOString().slice(0,10);
const urls = [[`${SITE}/`,today],[`${SITE}/test-liquidita.html`,'2026-10-26'],[`${SITE}/guide/`,guides[0].date],
  ...guides.map(g=>[`${SITE}/guide/${g.slug}.html`,g.modified||g.date])];
fs.writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(([u,d])=>`  <url><loc>${u}</loc><lastmod>${d}</lastmod></url>`).join('\n') + `\n</urlset>\n`);

// RSS
const rfc = d => new Date(d+'T07:00:00Z').toUTCString();
fs.writeFileSync('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n<title>Sagoma Finanziaria – Guide</title><link>${SITE}/guide/</link>\n<description>Guide di educazione finanziaria generica su liquidità e risparmio.</description><language>it</language>\n` +
  guides.map(g=>`<item><title>${esc(g.title)}</title><link>${SITE}/guide/${g.slug}.html</link><guid>${SITE}/guide/${g.slug}.html</guid><pubDate>${rfc(g.date)}</pubDate><description>${esc(g.description)}</description></item>`).join('\n') + `\n</channel></rss>\n`);

// llms.txt
fs.writeFileSync('llms.txt', `# Sagoma Finanziaria\n\n> Sito di educazione finanziaria generica in italiano, di Matteo Cariola. Contenuti informativi: non costituiscono consulenza, raccomandazione di investimento né sollecitazione all'acquisto di prodotti.\n\n## Guide\n\n` +
  guides.map(g=>`- [${g.title}](${SITE}/guide/${g.slug}.html): ${g.description}`).join('\n') +
  `\n\n## Strumenti\n\n- [Mini-test: la tua liquidità lavora o dorme?](${SITE}/test-liquidita.html): test gratuito di 2 minuti, risultato generico, nessun dato richiesto.\n\n## Note\n\n- Autore: Matteo Cariola, che opera anche come consulente finanziario ING Italia (agente con contratto); Sagoma Finanziaria è un'attività di educazione finanziaria separata.\n- Feed: ${SITE}/feed.xml\n`);
console.log('ok', guides.length);
