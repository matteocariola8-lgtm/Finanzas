// Animazioni leggere con GSAP + ScrollTrigger (self-hosted, nessuna richiesta a terzi).
// Rispetta prefers-reduced-motion e, se qualcosa non carica, i contenuti restano visibili.
(function(){
  if(!window.gsap||!window.ScrollTrigger) return;
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ScrollTrigger);
  // Scroll fluido (Lenis) collegato a GSAP/ScrollTrigger
  if(window.Lenis){
    var lenis=new Lenis({duration:1.1,smoothWheel:true});
    lenis.on('scroll',ScrollTrigger.update);
    gsap.ticker.add(function(t){lenis.raf(t*1000)});
    gsap.ticker.lagSmoothing(0);
  }
  var q=function(s){return gsap.utils.toArray(s)};
  // Hero: entrata a cascata
  var hero=q('.hero2 > div:first-child > *, .hero > *');
  if(hero.length) gsap.from(hero,{opacity:0,y:18,duration:.6,ease:'power2.out',stagger:.08,clearProps:'all'});
  var prev=q('.preview');
  if(prev.length) gsap.from(prev,{opacity:0,y:24,scale:.98,duration:.7,delay:.25,ease:'power2.out',clearProps:'all'});
  // Blocchi che compaiono allo scroll
  ['.steps li','.gcard','.about','details','.term','main > section > .card'].forEach(function(sel){
    q(sel).forEach(function(el,i){
      gsap.from(el,{opacity:0,y:22,duration:.55,ease:'power2.out',clearProps:'all',
        scrollTrigger:{trigger:el,start:'top 90%',once:true}});
    });
  });
  // Risultato dei calcolatori: piccolo "pop" quando cambia
  var out=document.getElementById('out');
  if(out){var t;new MutationObserver(function(){clearTimeout(t);t=setTimeout(function(){gsap.fromTo(out,{scale:.98},{scale:1,duration:.25,ease:'power1.out',clearProps:'transform'});},0);}).observe(out,{childList:true,characterData:true,subtree:true});}
})();
