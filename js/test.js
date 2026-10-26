/* Mini-test "La tua liquidità lavora o dorme?" — contenuto educativo generico */
(function (root) {
  'use strict';

  var QUESTIONS = [
    { id: 'importo', q: 'Quanta liquidità hai oggi sui conti?', opts: [
      { t: 'Meno di 5.000 €', p: 0 }, { t: 'Tra 5.000 e 20.000 €', p: 0 },
      { t: 'Tra 20.000 e 50.000 €', p: 1 }, { t: 'Tra 50.000 e 100.000 €', p: 1 },
      { t: 'Oltre 100.000 €', p: 2 } ] },
    { id: 'durata', q: 'Da quanto tempo è ferma la maggior parte di questa liquidità?', opts: [
      { t: 'Meno di 3 mesi', p: 0 }, { t: 'Tra 3 e 12 mesi', p: 1 },
      { t: 'Oltre un anno', p: 2 }, { t: 'Non so dirlo', p: 2 } ] },
    { id: 'rende', q: 'Sai se oggi ti sta rendendo qualcosa?', opts: [
      { t: 'Sì, so quanto e fino a quando', p: 0 }, { t: 'Qualcosa, ma non ho mai verificato', p: 1 },
      { t: 'No, è su un conto ordinario', p: 2 }, { t: 'Non lo so', p: 2 } ] },
    { id: 'uso', q: 'A cosa potrebbe servirti nei prossimi 3 anni?', opts: [
      { t: 'Acquisto casa o ristrutturazione', p: 0, tag: 'casa' },
      { t: 'Avviare o sostenere un’attività', p: 0 },
      { t: 'Imprevisti e tranquillità', p: 0 },
      { t: 'Niente di preciso', p: 0 } ] },
    { id: 'scadenza', q: 'Hai una scadenza vicina (deposito che scade, acquisto, pagamento importante)?', opts: [
      { t: 'Sì, entro 3 mesi', p: 0, tag: 'scadenza' }, { t: 'Sì, entro 12 mesi', p: 0, tag: 'scadenza' },
      { t: 'No, nessuna scadenza', p: 0 } ] },
    { id: 'peso', q: 'Quanto ti pesa oggi questo tema?', opts: [
      { t: '1 — per niente', p: 0 }, { t: '2', p: 0 }, { t: '3', p: 0 },
      { t: '4', p: 0 }, { t: '5 — mi pesa molto', p: 0 } ] }
  ];

  var RESULTS = {
    ferma: { label: 'Liquidità ferma', cls: 'ferma',
      lead: 'Dalle tue risposte, buona parte della liquidità sembra ferma da tempo, senza una destinazione chiara.',
      tips: [
        'Dividi la liquidità in tre “secchielli”: emergenze (indicativamente da 3 a 6 mesi di spese), obiettivi a 1-3 anni, e il resto di lungo periodo. Ogni secchiello ha tempi e regole diverse.',
        'Controlla cosa sta facendo oggi ogni conto: condizioni, eventuali vincoli e scadenze. Spesso basta una mezz’ora per avere il quadro.',
        'Scrivi accanto a ogni importo a cosa serve e quando. Una somma senza data e senza scopo tende a restare ferma.'
      ] },
    parziale: { label: 'Liquidità parzialmente organizzata', cls: 'parziale',
      lead: 'Hai già messo un po’ d’ordine, ma una parte della liquidità sembra senza una destinazione precisa.',
      tips: [
        'Individua la quota che non ha uno scopo e una data: è quella su cui ha più senso fare una riflessione.',
        'Verifica che emergenze e obiettivi a breve termine siano separati dal resto, così non devi mai toccare ciò che ti serve più avanti.',
        'Segna in calendario le scadenze di depositi e vincoli, così nessuna scade senza che tu abbia deciso cosa farne.'
      ] },
    ok: { label: 'Liquidità ben organizzata', cls: 'ok',
      lead: 'Le tue risposte indicano una liquidità gestita con consapevolezza: bene così.',
      tips: [
        'Rivedi il quadro almeno una volta l’anno e a ogni cambiamento importante (casa, lavoro, famiglia).',
        'Controlla che l’importo tenuto per le emergenze sia ancora adeguato alle tue spese attuali.',
        'Annota gli obiettivi dei prossimi 3 anni e verifica che la liquidità prevista sia coerente con le date.'
      ] }
  };

  var CHECKLIST_CASA = [
    'Tieni separato il fondo emergenze dalla liquidità destinata alla casa.',
    'Elenca tutti i costi oltre al prezzo: imposte, notaio, eventuale agenzia, spese di trasloco e arredo.',
    'Segna la data del rogito e verifica che le liquidità necessarie siano disponibili in quel momento, senza vincoli in scadenza dopo.',
    'Controlla che la rata prevista sia sostenibile rispetto al reddito netto, con un margine di sicurezza.',
    'Mantieni un cuscinetto di liquidità anche dopo l’acquisto: i primi mesi hanno spesso spese impreviste.',
    'Controlla scadenze e condizioni di eventuali depositi o strumenti che userai per l’acquisto.',
    'Dopo l’acquisto, rivedi obiettivi e risparmio mensile: il quadro cambia.'
  ];

  function compute(answers) {
    // answers: { id: index }
    var score = 0, tags = {};
    QUESTIONS.forEach(function (q) {
      var i = answers[q.id];
      if (i == null) return;
      var o = q.opts[i];
      score += o.p || 0;
      if (o.tag) tags[o.tag] = true;
    });
    // punteggio 0-6 su importo, durata, rende
    var level = score >= 4 ? 'ferma' : (score >= 2 ? 'parziale' : 'ok');
    return { score: score, level: level, tags: tags };
  }

  var api = { QUESTIONS: QUESTIONS, RESULTS: RESULTS, CHECKLIST_CASA: CHECKLIST_CASA, compute: compute };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.MiniTest = api;
})(typeof window !== 'undefined' ? window : this);
