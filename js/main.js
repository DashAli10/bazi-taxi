/* راه‌اندازی، ورودی‌ها و حلقه بازی */
(function () {
  'use strict';

  const keys = {};
  const input = { throttle: 0, steer: 0, handbrake: false };

  function isTouch() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }

  function pressAction(k) {
    const g = Game;
    const p = g.player;
    switch (k) {
      case 'h':
        if (p.honkTimer <= 0) { p.honkTimer = 0.7; Sound.honk(); }
        break;
      case 'm':
        p.music = !p.music;
        if (p.music) { Sound.music(); UI.toast('ضبط روشن شد 🎵', 'good'); }
        else UI.toast('ضبط خاموش شد', '');
        break;
      case 'c':
        p.ac = !p.ac;
        UI.toast(p.ac ? 'کولر روشن شد ❄️ (مصرف بنزین بیشتر می‌شود)' : 'کولر خاموش شد', p.ac ? 'good' : '');
        break;
      case 'e':
        if (g.canEnterShop && !g.paused) { g.paused = true; UI.openShop(); }
        break;
      case 'escape':
        g.togglePause();
        break;
    }
  }

  function keyToAction(code, key) {
    const k = (key || '').toLowerCase();
    if (code === 'KeyH' || k === 'h') return 'h';
    if (code === 'KeyM' || k === 'm') return 'm';
    if (code === 'KeyC' || k === 'c') return 'c';
    if (code === 'KeyE' || k === 'e') return 'e';
    if (code === 'Escape' || k === 'escape') return 'escape';
    return null;
  }

  function setupInput() {
    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      keys[k] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
      const act = keyToAction(e.code, e.key);
      if (act && !e.repeat) pressAction(act);
      Sound.resume();
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

    // دکمه‌های لمسی
    document.querySelectorAll('#touch .tbtn').forEach(btn => {
      const k = btn.dataset.k.toLowerCase();
      const down = e => {
        e.preventDefault();
        btn.classList.add('active');
        Sound.resume();
        if (['h', 'm', 'c'].indexOf(k) >= 0) pressAction(k);
        else keys[k] = true;
      };
      const up = e => {
        e.preventDefault();
        btn.classList.remove('active');
        keys[k] = false;
      };
      btn.addEventListener('touchstart', down, { passive: false });
      btn.addEventListener('touchend', up, { passive: false });
      btn.addEventListener('touchcancel', up, { passive: false });
      btn.addEventListener('mousedown', down);
      btn.addEventListener('mouseup', up);
      btn.addEventListener('mouseleave', up);
    });

    document.addEventListener('click', () => Sound.resume(), { once: true });
  }

  function readInput() {
    const up = keys['arrowup'] || keys['w'];
    const down = keys['arrowdown'] || keys['s'];
    const left = keys['arrowleft'] || keys['a'];
    const right = keys['arrowright'] || keys['d'];
    input.throttle = up ? 1 : (down ? -1 : 0);
    // در راست‌چین بودن تغییری نمی‌کند: چپ یعنی چرخش به چپ
    input.steer = (right ? 1 : 0) - (left ? 1 : 0);
    input.handbrake = !!keys[' '];
    return input;
  }

  let last = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    const now = ts / 1000;
    let dt = last ? now - last : 0.016;
    last = now;
    dt = Math.min(dt, 0.05);

    const inp = Game.started && !Game.paused ? readInput() : { throttle: 0, steer: 0, handbrake: false };
    Game.update(dt, inp);
    if (Game.started) {
      Render.follow(Game.player, Game.paused ? 0.0001 : dt);
      Render.draw(Game);
      UI.update(Game, dt);
    }
  }

  function boot() {
    Game.init();
    Render.init(document.getElementById('game'), document.getElementById('minimap'));
    UI.init(Game);
    setupInput();

    if (isTouch()) document.body.classList.add('touch');
    UI.refreshContinue();

    // نمای پس‌زمینه منو (ظهر، تا شهر روشن دیده شود)
    Game.minutes = 12 * 60;
    Render.cam.x = City.VROADS[2];
    Render.cam.y = City.HROADS[3];
    Render.cam.zoom = Render.baseZoom();
    Game.player.x = City.VROADS[2];
    Game.player.y = City.HROADS[3];
    Render.draw(Game);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && Game.started && !Game.paused) Game.togglePause();
    });

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => { });
      });
    }

    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
