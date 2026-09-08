/* لایه رابط کاربری: HUD، دیالوگ‌ها، فروشگاه و پنل‌ها */
(function (global) {
  'use strict';

  const $ = id => document.getElementById(id);

  const UI = {
    game: null,
    dlgTimer: 0,

    init(game) {
      this.game = game;
      this.el = {
        hud: $('hud'), money: $('money'), day: $('day'), clock: $('clock'),
        fuelBar: $('fuelBar'), healthBar: $('healthBar'), speedVal: $('speedVal'),
        wantedChip: $('wantedChip'), carChip: $('carChip'),
        farecard: $('farecard'), fcEmoji: $('fcEmoji'), fcName: $('fcName'),
        fcState: $('fcState'), fcTo: $('fcTo'), fcPrice: $('fcPrice'), fcSat: $('fcSat'),
        eventbar: $('eventbar'), evTitle: $('evTitle'), evProgress: $('evProgress'),
        dialogue: $('dialogue'), dlgAvatar: $('dlgAvatar'), dlgName: $('dlgName'), dlgText: $('dlgText'),
        prompt: $('prompt'), toasts: $('toasts'),
        shopList: $('shopList'), shopMoney: $('shopMoney'),
        sumStats: $('sumStats'), sumTitle: $('sumTitle'), sumQuote: $('sumQuote'),
        pauseStats: $('pauseStats'), menuTip: $('menuTip')
      };
      this.shopTab = 'cars';
      this.bind();
      this.el.menuTip.textContent = '💡 ' + U.choice(DATA.TIPS);
    },

    bind() {
      const g = this.game;
      $('btnNew').onclick = () => { g.newGame(); this.hidePanels(); };
      $('btnContinue').onclick = () => { g.loadGame(); this.hidePanels(); };
      $('btnHelp2').onclick = () => this.showPanel('help');
      $('btnHelp').onclick = () => { g.paused = true; this.showPanel('help'); };
      $('btnHelpClose').onclick = () => {
        if (g.started) { this.hidePanels(); g.paused = false; }
        else this.showPanel('menu');
      };
      $('btnPause').onclick = () => g.togglePause();
      $('btnResume').onclick = () => g.togglePause();
      $('btnSave').onclick = () => { g.saveGame(); this.toast('بازی ذخیره شد 💾', 'good'); };
      $('btnQuit').onclick = () => { g.saveGame(); g.started = false; g.paused = true; this.el.hud.classList.add('hidden'); this.showPanel('menu'); };
      $('btnShopClose').onclick = () => { this.hidePanels(); g.paused = false; };
      $('btnNextDay').onclick = () => { this.hidePanels(); g.startDay(); };
      $('btnSound').onclick = (e) => {
        Sound.setEnabled(!Sound.enabled);
        e.currentTarget.textContent = Sound.enabled ? '🔊' : '🔇';
      };
      document.querySelectorAll('.tab').forEach(t => {
        t.onclick = () => {
          document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
          t.classList.add('active');
          this.shopTab = t.dataset.tab;
          this.renderShop();
        };
      });
    },

    showPanel(id) {
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('show'));
      const p = $(id);
      if (p) p.classList.add('show');
      this.openPanel = id;
      if (id === 'menu') {
        this.refreshContinue();
        this.el.menuTip.textContent = '💡 ' + U.choice(DATA.TIPS);
      }
    },

    /* دکمه «ادامه بازی» فقط وقتی ذخیره‌ای هست فعال باشد */
    refreshContinue() {
      const btn = $('btnContinue');
      const has = this.game.hasSave();
      btn.disabled = !has;
      btn.textContent = has ? '💾 ادامه بازی ذخیره‌شده' : '💾 بازی ذخیره‌شده‌ای نیست';
    },

    hidePanels() {
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('show'));
      this.openPanel = null;
      this.el.hud.classList.remove('hidden');
      // HUD تازه نمایان شده؛ اندازه نقشه کوچک باید دوباره محاسبه شود
      Render.resize();
    },

    /* ---------- HUD ---------- */
    update(g, dt) {
      const p = g.player;
      this.el.money.textContent = g.money < 0 ? U.money(-g.money) + ' بدهی' : U.money(g.money);
      this.el.day.textContent = U.fa(g.day);
      this.el.clock.textContent = U.clock(g.minutes);
      this.el.fuelBar.style.width = (p.fuel / p.tank * 100) + '%';
      this.el.healthBar.style.width = p.health + '%';
      this.el.speedVal.textContent = U.fa(Math.round(p.kmh));
      this.el.carChip.textContent = '🚕 ' + p.name;

      if (g.wanted > 20) {
        this.el.wantedChip.classList.remove('hidden');
        this.el.wantedChip.querySelector('#wantedTxt').textContent =
          g.wanted > 60 ? 'پلیس دنبالته!' : 'مراقب باش';
      } else this.el.wantedChip.classList.add('hidden');

      // کارت سفر
      const f = g.fare;
      if (f) {
        this.el.farecard.classList.remove('hidden');
        this.el.fcEmoji.textContent = f.passenger.emoji;
        this.el.fcName.textContent = f.passenger.name;
        this.el.fcState.textContent = f.state === 'toPickup' ? 'در راه سوار کردن' : 'مسافر سوار است';
        this.el.fcTo.textContent = f.state === 'toPickup' ? f.from.name : f.to.name;
        this.el.fcPrice.textContent = U.money(f.price) + ' ت';
        this.el.fcSat.style.width = U.clamp(f.satisfaction, 0, 100) + '%';
      } else this.el.farecard.classList.add('hidden');

      // نوار رویداد
      if (f && f.event && f.event.active) {
        this.el.eventbar.classList.remove('hidden');
        this.el.evTitle.textContent = f.event.def.title;
        this.el.evProgress.style.width = (f.event.timer / f.event.def.duration * 100) + '%';
      } else this.el.eventbar.classList.add('hidden');

      // دیالوگ
      if (this.dlgTimer > 0) {
        this.dlgTimer -= dt;
        if (this.dlgTimer <= 0) this.el.dialogue.classList.add('hidden');
      }
    },

    dialogue(passenger, text, dur) {
      this.el.dialogue.classList.remove('hidden');
      this.el.dlgAvatar.textContent = passenger.emoji;
      this.el.dlgName.textContent = passenger.name;
      this.el.dlgText.textContent = text;
      this.dlgTimer = dur || 4.5;
      // انیمیشن مجدد
      this.el.dialogue.style.animation = 'none';
      void this.el.dialogue.offsetWidth;
      this.el.dialogue.style.animation = '';
    },

    prompt(text) {
      if (!text) { this.el.prompt.classList.add('hidden'); return; }
      this.el.prompt.classList.remove('hidden');
      this.el.prompt.innerHTML = text;
    },

    toast(text, kind) {
      const d = document.createElement('div');
      d.className = 'toast ' + (kind || '');
      d.textContent = text;
      this.el.toasts.appendChild(d);
      setTimeout(() => {
        d.style.transition = 'opacity .4s,transform .4s';
        d.style.opacity = '0'; d.style.transform = 'translateY(-8px)';
        setTimeout(() => d.remove(), 420);
      }, 2600);
      while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    },

    /* ---------- فروشگاه ---------- */
    openShop() {
      this.renderShop();
      this.showPanel('shop');
    },

    renderShop() {
      const g = this.game;
      const list = this.el.shopList;
      this.el.shopMoney.textContent = 'موجودی شما: ' + U.moneyFull(g.money);
      list.innerHTML = '';

      if (this.shopTab === 'cars') {
        DATA.CARS.forEach((car, idx) => {
          const owned = idx <= g.carIndex;
          const isCurrent = idx === g.carIndex;
          const locked = idx > g.carIndex + 1;
          const canBuy = !owned && !locked && g.money >= car.price;
          const row = document.createElement('div');
          row.className = 'item' + (isCurrent ? ' owned' : '');
          row.innerHTML =
            '<div class="thumb" style="background:' + car.color + '33;border:1px solid ' + car.color + '66">🚗</div>' +
            '<div class="info"><b>' + car.name + (isCurrent ? ' — ماشین فعلی' : '') + '</b>' +
            '<small>' + car.tag + ' — ' + car.note + '</small>' +
            '<div class="specs">' +
            '<span>سرعت ' + U.fa(Math.round(car.maxSpeed * 0.5)) + '</span>' +
            '<span>شتاب ' + U.fa(Math.round(car.accel / 10)) + '</span>' +
            '<span>باک ' + U.fa(car.tank) + ' لیتر</span>' +
            '<span>راحتی ' + U.fa(Math.round(car.comfort * 100)) + '٪</span>' +
            '</div></div>';
          const btn = document.createElement('button');
          btn.className = 'buy' + (canBuy ? ' can' : '');
          if (isCurrent) { btn.textContent = '✔ سوارشی'; btn.disabled = true; }
          else if (owned) { btn.textContent = 'فروخته شد'; btn.disabled = true; }
          else if (locked) { btn.textContent = '🔒 قفل'; btn.disabled = true; }
          else {
            btn.textContent = U.money(car.price) + ' تومان';
            btn.disabled = !canBuy;
            btn.onclick = () => { g.buyCar(idx); this.renderShop(); };
          }
          row.appendChild(btn);
          list.appendChild(row);
        });
      } else {
        DATA.UPGRADES.forEach(up => {
          const owned = !!g.upgrades[up.id];
          const canBuy = !owned && g.money >= up.price;
          const row = document.createElement('div');
          row.className = 'item' + (owned ? ' owned' : '');
          row.innerHTML =
            '<div class="thumb" style="background:rgba(255,255,255,.06)">' + up.icon + '</div>' +
            '<div class="info"><b>' + up.name + '</b><small>' + up.desc + '</small></div>';
          const btn = document.createElement('button');
          btn.className = 'buy' + (canBuy ? ' can' : '');
          if (owned) { btn.textContent = '✔ داری'; btn.disabled = true; }
          else {
            btn.textContent = U.money(up.price) + ' تومان';
            btn.disabled = !canBuy;
            btn.onclick = () => { g.buyUpgrade(up.id); this.renderShop(); };
          }
          row.appendChild(btn);
          list.appendChild(row);
        });
      }
    },

    /* ---------- خلاصه روز ---------- */
    stat(label, value, cls) {
      return '<div class="stat"><small>' + label + '</small><b class="' + (cls || '') + '">' + value + '</b></div>';
    },

    showSummary(g, s) {
      this.el.sumTitle.textContent = '🌙 پایان روز ' + U.fa(s.dayNumber || g.day);
      const net = s.income - s.expenses;
      this.el.sumStats.innerHTML =
        this.stat('تعداد سفر', U.fa(s.trips)) +
        this.stat('درآمد', U.money(s.income) + ' ت', 'pos') +
        this.stat('هزینه‌ها', U.money(s.expenses) + ' ت', 'neg') +
        this.stat(net >= 0 ? 'سود خالص' : 'ضرر امروز', U.money(Math.abs(net)) + ' ت', net >= 0 ? 'pos' : 'neg') +
        this.stat('جریمه پلیس', U.fa(s.fines) + ' بار') +
        this.stat('رضایت مسافران', U.fa(Math.round(s.avgSat)) + '٪');
      let q;
      if (s.trips === 0) q = 'امروز اصلاً مسافر سوار نکردی. فردا زودتر بزن بیرون.';
      else if (net > 400000) q = 'روز پرباری بود؛ همسایه‌ها فکر می‌کنن ارث بهت رسیده.';
      else if (net > 0) q = 'خرج خونه در اومد و یه چیزی هم موند. بد نبود.';
      else q = 'امروز خرجت از دخلت بیشتر شد. فردا جبران می‌کنیم.';
      this.el.sumQuote.textContent = '«' + q + '»';
      this.showPanel('summary');
    },

    showPauseStats(g) {
      this.el.pauseStats.innerHTML =
        this.stat('موجودی', U.money(g.money) + ' ت') +
        this.stat('ماشین', g.player.name) +
        this.stat('کل سفرها', U.fa(g.stats.totalTrips)) +
        this.stat('کل درآمد', U.money(g.stats.totalIncome) + ' ت') +
        this.stat('تصادف‌ها', U.fa(g.stats.crashes)) +
        this.stat('جریمه‌ها', U.fa(g.stats.fines));
    }
  };

  global.UI = UI;
})(window);
