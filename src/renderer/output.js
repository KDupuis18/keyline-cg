/* Output window for one channel.
   ?ch=1|2  channel · ?bg=transparent (NDI fill+alpha) | black (monitor) · ?mode=key renders the alpha as a white-on-black key signal */
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  const ch = +(q.get('ch') || 1);
  const key = q.get('mode') === 'key';
  if (q.get('bg') === 'black' || key) document.body.classList.add('black');
  if (key) document.body.classList.add('key');
  const tag = document.getElementById('tag');
  tag.textContent = q.get('label') || '';
  setTimeout(() => { tag.style.display = 'none'; }, 4000);
  const wrap = document.getElementById('wrap'), stage = document.getElementById('stage');
  const program = new KL.Program(document.getElementById('layers'));
  const fit = () => KL.fitStage(wrap, stage);
  addEventListener('resize', fit); fit();
  if (window.kl) {
    window.kl.onOutput(m => { if (m.ch == null || +m.ch === ch) program.handle(m); });
    window.kl.outputReady(ch);
  }
  if (document.fonts) document.fonts.ready.then(() => program.remeasure());
  window.__program = program;
  window.__ch = ch;
})();
