// Animazioni leggere: GSAP + ScrollTrigger + Lenis (self-hosted, nessuna richiesta a terzi).
// Rispetta prefers-reduced-motion; se qualcosa non carica, i contenuti restano visibili.
(function(){
  if(!window.gsap||!window.ScrollTrigger) return;
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ScrollTrigger);
  var q=function(s){return gsap.utils.toArray(s)};

  // Scroll fluido (Lenis) collegato a GSAP/ScrollTrigger
  if(window.Lenis){
    var lenis=new Lenis({duration:1.1,smoothWheel:true});
    lenis.on('scroll',ScrollTrigger.update);
    gsap.ticker.add(function(t){lenis.raf(t*1000)});
    gsap.ticker.lagSmoothing(0);
  }

  // Sfondo animato morbido dietro la testata (due aloni sfocati)
  var host=document.querySelector('.hero2')||document.querySelector('.hero');
  if(host){
    host.style.position='relative';
    var bg=document.createElement('div');
    bg.setAttribute('aria-hidden','true');
    bg.style.cssText='position:absolute;inset:-40px -20px;z-index:-1;pointer-events:none;overflow:hidden';
    bg.innerHTML='<i style="position:absolute;left:-5%;top:0;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle,rgba(184,137,59,.28),transparent 70%);filter:blur(30px)"></i>'+
                 '<i style="position:absolute;right:-5%;bottom:-40px;width:380px;height:380px;border-radius:50%;background:radial-gradient(circle,rgba(27,53,86,.22),transparent 70%);filter:blur(34px)"></i>';
    host.insertBefore(bg,host.firstChild);
    var blobs=bg.querySelectorAll('i');
    gsap.to(blobs[0],{x:60,y:30,duration:9,ease:'sine.inOut',yoyo:true,repeat:-1});
    gsap.to(blobs[1],{x:-50,y:-30,duration:11,ease:'sine.inOut',yoyo:true,repeat:-1});
  }

  // Titolo: le parole si compongono una alla volta (testo accessibile conservato)
  var h1=document.querySelector('h1');
  if(h1&&!h1.querySelector('*')){
    var txt=h1.textContent.trim();
    h1.setAttribute('aria-label',txt);
    h1.innerHTML=txt.split(/\s+/).map(function(w){return '<span aria-hidden="true" style="display:inline-block;will-change:transform">'+w+'</span>'}).join(' ');
    gsap.from(h1.children,{opacity:0,y:28,rotate:2,duration:.65,ease:'power3.out',stagger:.07,clearProps:'all'});
  }

  // Resto della testata: entrata a cascata
  var hero=q('.hero2 > div:first-child > *:not(h1), .hero > *:not(h1)');
  if(hero.length) gsap.from(hero,{opacity:0,y:16,duration:.6,ease:'power2.out',stagger:.08,delay:.25,clearProps:'all'});
  var prev=q('.preview');
  if(prev.length) gsap.from(prev,{opacity:0,y:24,scale:.98,duration:.7,delay:.3,ease:'power2.out',clearProps:'all'});

  // Blocchi che compaiono allo scroll
  ['.steps li','.gcard','.about','details','.term','main > section > .card'].forEach(function(sel){
    q(sel).forEach(function(el){
      gsap.from(el,{opacity:0,y:22,duration:.55,ease:'power2.out',clearProps:'all',
        scrollTrigger:{trigger:el,start:'top 90%',once:true}});
    });
  });

  // Calcolatori: i numeri "salgono" fino al valore nuovo
  var out=document.getElementById('out');
  if(out){
    var fmt=new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0});
    var last={},tw=[];
    var run=function(){
      tw.forEach(function(t){t.kill()});tw=[];
      out.querySelectorAll('b').forEach(function(b,i){
        var txt=b.textContent;if(txt.indexOf('€')<0) return;
        var target=parseInt(txt.replace(/\D/g,''),10);if(isNaN(target)) return;
        var from=last[i]===undefined?0:last[i],o={v:from};
        b.textContent=fmt.format(from);
        tw.push(gsap.to(o,{v:target,duration:.6,ease:'power2.out',
          onUpdate:function(){b.textContent=fmt.format(Math.round(o.v));last[i]=o.v},
          onComplete:function(){b.textContent=txt;last[i]=target}}));
      });
    };
    new MutationObserver(function(){run()}).observe(out,{childList:true});
    run();
  }
})();
