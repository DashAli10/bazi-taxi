/* ابزارهای عمومی بازی «راننده تاکسی تهران» */
(function (global) {
  'use strict';

  const U = {
    clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp(a, b, t) { return a + (b - a) * t; },
    rnd(a, b) { return a + Math.random() * (b - a); },
    rndInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
    chance(p) { return Math.random() < p; },
    choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); },
    dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },

    wrapAngle(a) {
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    },

    approach(cur, target, step) {
      if (cur < target) return Math.min(cur + step, target);
      return Math.max(cur - step, target);
    },

    /* مولد عدد شبه‌تصادفی با بذر ثابت تا شهر همیشه یک شکل ساخته شود */
    seeded(seed) {
      let s = seed >>> 0;
      return function () {
        s += 0x6D2B79F5;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },

    /* اعداد فارسی */
    fa(n, frac) {
      try { return Number(n).toLocaleString('fa-IR', { maximumFractionDigits: frac || 0 }); }
      catch (e) { return String(Math.round(n)); }
    },

    /* مبلغ به تومان، خلاصه‌شده برای اعداد بزرگ */
    money(n) {
      const v = Math.round(n);
      const a = Math.abs(v);
      const sign = v < 0 ? '‏-' : '';
      if (a >= 1000000) {
        const m = a / 1000000;
        return sign + U.fa(m, m >= 10 ? 0 : 1) + ' میلیون';
      }
      return sign + U.fa(a);
    },

    moneyFull(n) { return U.fa(Math.round(n)) + ' تومان'; },

    /* تبدیل رقم‌به‌رقم تا صفرهای ابتدایی حفظ شوند */
    faDigits(str) {
      return String(str).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
    },

    clock(minutes) {
      const h = Math.floor(minutes / 60) % 24;
      const m = Math.floor(minutes % 60);
      return U.faDigits(String(h).padStart(2, '0')) + ':' + U.faDigits(String(m).padStart(2, '0'));
    },

    rectsOverlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    },

    inRect(x, y, r) {
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    },

    roundRect(ctx, x, y, w, h, r) {
      const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    },

    shade(hex, amount) {
      const c = hex.replace('#', '');
      const num = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16);
      let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
      r = U.clamp(Math.round(r + amount * 255), 0, 255);
      g = U.clamp(Math.round(g + amount * 255), 0, 255);
      b = U.clamp(Math.round(b + amount * 255), 0, 255);
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
  };

  global.U = U;
})(window);
