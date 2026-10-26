(function(){
  'use strict';
  function init(){
    var header=document.getElementById('sless-site-header');
    if(!header)return;
    var burger=header.querySelector('[data-sm-burger]');
    var toggles=header.querySelectorAll('[data-sm-sub-toggle]');
    function setSub(btn,open){
      var sub=document.getElementById(btn.getAttribute('aria-controls'));
      btn.setAttribute('aria-expanded',open?'true':'false');
      if(sub){if(open)sub.removeAttribute('hidden');else sub.setAttribute('hidden','');}
    }
    function closeSubs(except){toggles.forEach(function(b){if(b!==except)setSub(b,false);});}
    function setMenu(open){
      if(!burger)return;
      burger.setAttribute('aria-expanded',open?'true':'false');
      header.classList.toggle('sm-open',open);
      if(!open)closeSubs();
    }
    toggles.forEach(function(btn){
      btn.addEventListener('click',function(e){
        e.stopPropagation();
        var open=btn.getAttribute('aria-expanded')!=='true';
        closeSubs(btn);setSub(btn,open);
        if(open){var first=document.getElementById(btn.getAttribute('aria-controls'));first=first&&first.querySelector('a');if(first&&e.detail===0)first.focus();}
      });
    });
    if(burger)burger.addEventListener('click',function(){setMenu(burger.getAttribute('aria-expanded')!=='true');});
    document.addEventListener('keydown',function(e){
      if(e.key!=='Escape')return;
      var openSub=header.querySelector('[data-sm-sub-toggle][aria-expanded="true"]');
      if(openSub){setSub(openSub,false);openSub.focus();return;}
      if(burger&&burger.getAttribute('aria-expanded')==='true'){setMenu(false);burger.focus();}
    });
    document.addEventListener('click',function(e){if(!header.contains(e.target)){closeSubs();setMenu(false);}});
    header.addEventListener('focusout',function(e){
      var dd=e.target.closest('[data-sm-dropdown]');
      if(dd&&e.relatedTarget&&!dd.contains(e.relatedTarget))closeSubs();
    });
    var mq=window.matchMedia('(min-width:961px)');
    var onMq=function(){if(mq.matches)setMenu(false);};
    if(mq.addEventListener)mq.addEventListener('change',onMq);else if(mq.addListener)mq.addListener(onMq);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
