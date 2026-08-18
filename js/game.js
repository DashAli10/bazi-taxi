/* هسته بازی: چرخه روز، مسافرها، پلیس، سوخت و اقتصاد */
(function (global) {
  'use strict';

  const SAVE_KEY = 'tehran-taxi-save-v1';
  const FUEL_PRICE = 3000;      // تومان به ازای هر لیتر
  const REPAIR_PRICE = 9000;    // تومان به ازای هر درصد سلامت
  const DAY_START = 7 * 60, DAY_END = 24 * 60;
  const MINUTES_PER_SEC = 2.5;

  const Game = {
    init() {
      City.build();
      this.upgrades = {};
      this.player = new PlayerCar(DATA.CARS[0]);
      this.traffic = [];
      this.effects = [];
      this.fare = null;
      this.routePath = null;
      this.started = false;
      this.paused = true;
      this.money = 350000;
      this.carIndex = 0;
      this.day = 1;
      this.minutes = DAY_START;
      this.wanted = 0;
      this.smog = 0;
      this.stats = { totalTrips: 0, totalIncome: 0, crashes: 0, fines: 0, bestDay: 0 };
      this.dayStats = { trips: 0, income: 0, expenses: 0, fines: 0, satSum: 0 };
      this.serviceMsg = null;
      this.fareCooldown = 2;
      this.radioTimer = 60;
      return this;
    },

    /* ---------- شروع و ذخیره ---------- */
    newGame() {
      this.upgrades = {};
      this.carIndex = 0;
      this.money = 350000;
      this.day = 1;
      this.stats = { totalTrips: 0, totalIncome: 0, crashes: 0, fines: 0, bestDay: 0 };
      this.player = new PlayerCar(DATA.CARS[0]);
      this.player.fuel = DATA.CARS[0].tank * 0.45;
      this.player.health = 82;
      this.startDay(true);
      this.started = true;
      this.paused = false;
      Sound.resume();
      this.toast('روز اول کاری! باک نصفه‌ست، حواست به بنزین باشه ⛽', 'warn');
    },

    startDay(first) {
      this.minutes = DAY_START;
      this.wanted = 0;
      this.fare = null;
      this.routePath = null;
      this.fareCooldown = 2.5;
      this.dayStats = { trips: 0, income: 0, expenses: 0, fines: 0, satSum: 0 };
      this.smog = Math.random() < 0.35 ? U.rnd(0.4, 1) : 0;
      City.shuffleJams(U.rnd(0.18, 0.34));
      this.traffic = [];
      this.spawnTraffic(true);
      this.paused = false;
      this.started = true;
      if (!first) {
        this.player.x = City.VROADS[2]; this.player.y = City.HROADS[3];
        this.player.speed = 0; this.player.angle = 0;
      }
      if (this.smog > 0.5) this.toast('هشدار وارونگی هوا: امروز هوای تهران سنگینه 😷', 'warn');
      UI.toast('روز ' + U.fa(this.day) + ' شروع شد. موفق باشی! 🚕', 'good');
    },

    endDay() {
      const rent = 180000 + this.day * 12000;
      const food = 60000;
      this.dayStats.expenses += rent + food;
      this.money -= (rent + food);
      const s = {
        dayNumber: this.day,
        trips: this.dayStats.trips,
        income: this.dayStats.income,
        expenses: this.dayStats.expenses,
        fines: this.dayStats.fines,
        avgSat: this.dayStats.trips ? this.dayStats.satSum / this.dayStats.trips : 0
      };
      this.stats.bestDay = Math.max(this.stats.bestDay, s.income - s.expenses);
      this.day++;
      this.paused = true;
      this.fare = null;
      this.saveGame();
      UI.showSummary(this, s);
    },

    saveGame() {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          money: this.money, carIndex: this.carIndex, upgrades: this.upgrades,
          day: this.day, stats: this.stats,
          fuel: this.player.fuel, health: this.player.health, minutes: this.minutes
        }));
      } catch (e) { /* حافظه در دسترس نیست */ }
    },

    hasSave() {
      try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
    },

    loadGame() {
      let d = null;
      try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { }
      if (!d) { this.newGame(); return; }
      this.money = d.money;
      this.carIndex = d.carIndex || 0;
      this.upgrades = d.upgrades || {};
      this.day = d.day || 1;
      this.stats = Object.assign({ totalTrips: 0, totalIncome: 0, crashes: 0, fines: 0, bestDay: 0 }, d.stats);
      this.player = new PlayerCar(DATA.CARS[this.carIndex]);
      this.player.setSpec(DATA.CARS[this.carIndex], this.upgrades);
      this.player.fuel = d.fuel !== undefined ? d.fuel : this.player.tank;
      this.player.health = d.health !== undefined ? d.health : 100;
      this.startDay(true);
      this.started = true;
      this.paused = false;
      Sound.resume();
      this.toast('بازی ذخیره‌شده بارگذاری شد. روز ' + U.fa(this.day), 'good');
    },

    togglePause() {
      if (!this.started) return;
      if (UI.openPanel === 'shop' || UI.openPanel === 'summary') return;
      this.paused = !this.paused;
      if (this.paused) { UI.showPauseStats(this); UI.showPanel('pause'); }
      else UI.hidePanels();
    },

    /* ---------- کمکی‌ها ---------- */
    toast(t, k) { UI.toast(t, k); },

    fx(type, x, y, text, color, size) {
      this.effects.push({ type, x, y, text, color, size, life: 1.4, max: 1.4 });
    },

    addWanted(v) {
      this.wanted = U.clamp(this.wanted + v, 0, 100);
    },

    nightFactor() {
      const h = this.minutes / 60;
      if (h < 8) return U.clamp((8 - h) / 2.2, 0, 0.45);   // سپیده‌دم
      if (h > 18) return U.clamp((h - 18) / 2.2, 0, 1);     // غروب تا شب
      return 0;
    },

    isRush() {
      const h = this.minutes / 60;
      return (h >= 7 && h <= 9.5) || (h >= 16.5 && h <= 19.5);
    },

    /* ---------- ترافیک ---------- */
    spawnTraffic(initial) {
      const want = 68;
      const p = this.player;
      let policeCount = this.traffic.filter(c => c.police).length;
      let guard = 0;
      while (this.traffic.length < want && guard++ < 200) {
        const i = U.rndInt(0, City.VROADS.length - 1);
        const j = U.rndInt(0, City.HROADS.length - 1);
        const pos = City.nodePos(i, j);
        const d = U.dist(pos.x, pos.y, p.x, p.y);
        if (!initial && (d < 620 || d > 1900)) continue;
        if (initial && (d > 2400 || d < 420)) continue;   // صبح روی سر بازیکن ماشین نریزد
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const dir = U.choice(dirs);
        if (i + dir[0] < 0 || i + dir[0] >= City.VROADS.length) continue;
        if (j + dir[1] < 0 || j + dir[1] >= City.HROADS.length) continue;
        if (policeCount < 3 && Math.random() < 0.09) {
          this.traffic.push(new PoliceCar(i, j, dir[0], dir[1]));
          policeCount++;
        } else {
          this.traffic.push(new TrafficCar(i, j, dir[0], dir[1]));
        }
      }
      // حذف ماشین‌های خیلی دور
      this.traffic = this.traffic.filter(c =>
        U.dist(c.x, c.y, p.x, p.y) < 2600 || (c.police && c.chasing));
    },

    updateTraffic(dt) {
      const p = this.player;
      for (let k = 0; k < this.traffic.length; k++) {
        const c = this.traffic[k];
        if (c.police) c.update(dt, this.traffic, p, this);
        else c.update(dt, this.traffic, p);
      }
      // برخورد با بازیکن
      if (p.crashCooldown <= 0) {
        for (let k = 0; k < this.traffic.length; k++) {
          const c = this.traffic[k];
          const r = (Math.max(c.w, c.h) + Math.max(p.w, p.h)) * 0.34;
          if (U.dist2(c.x, c.y, p.x, p.y) < r * r) {
            this.crash(c);
            break;
          }
        }
      }
      this.spawnTimer = (this.spawnTimer || 0) + dt;
      if (this.spawnTimer > 1.2) { this.spawnTimer = 0; this.spawnTraffic(false); }
    },

    crash(other) {
      const p = this.player;
      const dmg = p.hitBy(other.speed);
      p.crashCooldown = 1.1;
      this.stats.crashes++;
      Sound.crash();
      // هل دادن ماشین مقابل
      const ang = Math.atan2(other.y - p.y, other.x - p.x);
      other.x += Math.cos(ang) * 22;
      other.y += Math.sin(ang) * 22;
      other.speed *= 0.4;
      other.honk = 1.4;
      this.addWanted(other.police ? 30 : 13);
      this.fx('burst', p.x, p.y, null, '#e05252');
      this.fx('text', p.x, p.y - 30, 'تصادف! −' + U.fa(Math.round(dmg)) + '٪', '#ff8a8a', 22);
      if (this.fare && this.fare.state !== 'toPickup') {
        this.fare.satisfaction -= 16;
        UI.dialogue(this.fare.passenger, U.choice([
          'یا خدا! چیکار می‌کنی؟!',
          'داداش مواظب باش، جون داریم!',
          'وای... کاش پیاده می‌رفتم.'
        ]), 3.2);
      }
      const msgs = ['زدی به ماشین! خسارت خوردی 💥', 'مواظب باش، بیمه هم که نداریم!', 'راننده بغلی داره بد نگاه می‌کنه...'];
      this.toast(U.choice(msgs), 'bad');
    },

    issueFine(officer) {
      let amount = U.rndInt(250, 850) * 1000;
      if (this.upgrades.dashcam) amount = Math.round(amount * 0.6);
      this.money -= amount;
      this.dayStats.expenses += amount;
      this.dayStats.fines++;
      this.stats.fines++;
      this.wanted = 0;
      if (officer) officer.chasing = false;
      Sound.siren();
      this.player.speed *= 0.2;
      this.fx('text', this.player.x, this.player.y - 40, 'جریمه ' + U.money(amount), '#ff9a5a', 24);
      this.toast(U.choice([
        'مأمور: مدارک لطفاً... جریمه شدی ' + U.money(amount) + ' تومان 🚨',
        'مأمور: سرعت غیرمجاز، این هم قبض ' + U.money(amount) + ' تومان.',
        'مأمور: داداش اینجا که خیابون نیست! ' + U.money(amount) + ' تومان جریمه.'
      ]), 'bad');
      if (this.fare && this.fare.state !== 'toPickup') {
        this.fare.satisfaction -= 8;
        UI.dialogue(this.fare.passenger, U.choice([
          'ای بابا، حالا کی به جلسه می‌رسه...',
          'من که گفتم یواش برو.',
          'مأمور رو دیدی؟ من که دیدم!'
        ]), 3);
      }
    },

    /* ---------- مسافر و سفر ---------- */
    offerFare() {
      const trip = City.pickTrip(this.player.x, this.player.y);
      const passenger = U.choice(DATA.PASSENGERS);
      this.fare = {
        state: 'toPickup',
        from: trip.from, to: trip.to,
        passenger,
        price: 0,
        satisfaction: 100,
        event: null,
        eventQueue: [],
        rideTime: 0,
        expected: 0,
        lastSpeed: 0,
        payDone: false
      };
      this.updateRoute();
      Sound.pickup();
      this.toast('📞 مسافر جدید: ' + passenger.name + ' در ' + trip.from.name + ' منتظرته.', 'good');
    },

    updateRoute() {
      const f = this.fare;
      if (!f) { this.routePath = null; return; }
      const target = f.state === 'toPickup' ? f.from : f.to;
      this.routePath = City.route({ x: this.player.x, y: this.player.y }, target);
    },

    priceFor(from, to) {
      const path = City.route(from, to);
      const len = City.routeLength(path);
      let price = 22000 + len * 62;
      if (this.isRush()) price *= 1.2;
      if (this.nightFactor() > 0.5) price *= 1.3;
      price *= this.player.comfort;
      return { price: Math.round(price / 1000) * 1000, len };
    },

    pickUpPassenger() {
      const f = this.fare;
      const q = this.priceFor(f.from, f.to);
      f.price = q.price;
      f.expected = q.len / 190 + 30;
      f.state = 'riding';
      f.rideTime = 0;
      f.satisfaction = 100;
      f.eventQueue = this.buildEvents(q.len);
      this.updateRoute();
      Sound.pickup();
      UI.dialogue(f.passenger, U.choice(f.passenger.greet), 5);
      this.toast('مسافر سوار شد — مقصد: ' + f.to.name + ' · کرایه ' + U.money(f.price) + ' ت', 'good');
    },

    buildEvents(len) {
      const count = len > 2600 ? U.rndInt(2, 3) : U.rndInt(1, 2);
      const pool = [];
      DATA.EVENTS.forEach(e => { for (let i = 0; i < e.weight; i++) pool.push(e); });
      const chosen = [];
      const used = {};
      for (let i = 0; i < count; i++) {
        let e = U.choice(pool), guard = 0;
        while (used[e.id] && guard++ < 20) e = U.choice(pool);
        used[e.id] = true;
        chosen.push({ def: e, at: 5 + i * U.rnd(16, 26) + U.rnd(0, 8) });
      }
      return chosen;
    },

    startEvent(def) {
      const f = this.fare;
      f.event = { def, timer: def.duration, holdTimer: 0, aboveTimer: 0, active: true, done: false };
      UI.dialogue(f.passenger, U.choice(def.lines), 5);
      Sound.blip(660, 0.12, 'sine', 0.14);
    },

    updateEvent(dt) {
      const f = this.fare;
      const ev = f.event;
      if (!ev || !ev.active) return;
      const def = ev.def;
      const p = this.player;
      ev.timer -= dt;
      let success = false, fail = false;

      switch (def.id) {
        case 'stop':
          if (p.kmh < 6) ev.holdTimer += dt; else ev.holdTimer = Math.max(0, ev.holdTimer - dt * 0.6);
          if (ev.holdTimer >= def.hold) success = true;
          break;
        case 'slow':
          if (p.kmh > def.limit) ev.aboveTimer += dt;
          if (ev.aboveTimer > 2.5) fail = true;
          else if (ev.timer <= 0) success = true;
          break;
        case 'hurry':
          if (p.kmh > def.minSpeed) ev.aboveTimer += dt;
          if (ev.aboveTimer > def.duration * 0.45) success = true;
          break;
        case 'music':
          if (p.music) success = true;
          break;
        case 'ac':
          if (p.ac) success = true;
          break;
        case 'honk':
          if (p.honkTimer > 0) success = true;
          break;
      }
      if (!success && ev.timer <= 0) fail = true;

      if (success) {
        ev.active = false;
        const tip = Math.round(f.price * def.tip);
        f.tipBonus = (f.tipBonus || 0) + tip;
        f.satisfaction = U.clamp(f.satisfaction + 6, 0, 110);
        UI.dialogue(f.passenger, U.choice(def.okLines), 3.2);
        this.fx('text', p.x, p.y - 34, '+' + U.money(tip) + ' انعام', '#8ff0a4', 21);
        Sound.coin();
      } else if (fail) {
        ev.active = false;
        f.satisfaction -= def.penalty;
        let line = U.choice(def.failLines);
        if (def.needs && !this.upgrades[def.needs]) {
          line = def.needs === 'ac' ? 'کولر نداری؟ باشه، پنجره رو می‌دم پایین...' : 'ضبط نداری؟ عیب نداره، سکوت هم قشنگه.';
        }
        UI.dialogue(f.passenger, line, 3.2);
        Sound.fail();
      }
    },

    dropOff() {
      const f = this.fare;
      if (f.payDone) return;
      f.payDone = true;
      const sat = U.clamp(f.satisfaction, 0, 110);

      // انعام بر اساس رضایت و تیپ مسافر
      let tip = f.price * (sat / 100) * 0.22 * f.passenger.tip;
      if (this.upgrades.stereo) tip *= 1.05;
      if (this.upgrades.ac) tip *= 1.05;
      tip += (f.tipBonus || 0);
      tip = Math.max(0, Math.round(tip));

      let total = f.price + tip;
      let payNote = '';

      // جمله پرداخت
      const pay = U.choice(DATA.PAY_LINES);
      if (pay.needs && !this.upgrades[pay.needs]) {
        const loss = Math.round(total * pay.loss);
        total -= loss;
        payNote = pay.failText;
        UI.dialogue(f.passenger, pay.text + ' ' + pay.failText, 4.5);
      } else if (!pay.needs && Math.random() < 0.4) {
        const loss = Math.round(total * pay.loss);
        total -= loss;
        UI.dialogue(f.passenger, pay.text + ' ' + pay.failText, 4.5);
      } else {
        UI.dialogue(f.passenger, U.choice(sat > 65 ? f.passenger.happy : f.passenger.angry), 4.5);
      }

      this.money += total;
      this.dayStats.income += total;
      this.dayStats.trips++;
      this.dayStats.satSum += sat;
      this.stats.totalTrips++;
      this.stats.totalIncome += total;

      Sound.coin();
      this.fx('text', this.player.x, this.player.y - 40, '+' + U.money(total) + ' تومان', '#ffd76a', 26);
      this.toast('سفر تمام شد ✅ ' + U.moneyFull(total) + (tip > 0 ? ' (با ' + U.money(tip) + ' انعام)' : ''), 'good');

      this.fare = null;
      this.routePath = null;
      this.fareCooldown = U.rnd(3, 6);
      if (payNote) this.toast('مسافر: ' + payNote, 'warn');
    },

    updateFare(dt) {
      const p = this.player;
      if (!this.fare) {
        this.fareCooldown -= dt;
        if (this.fareCooldown <= 0 && this.minutes < DAY_END - 30) this.offerFare();
        return;
      }
      const f = this.fare;

      // به‌روزرسانی مسیر پیشنهادی
      this.routeTimer = (this.routeTimer || 0) + dt;
      if (this.routeTimer > 1.5) { this.routeTimer = 0; this.updateRoute(); }

      if (f.state === 'toPickup') {
        const d = U.dist(p.x, p.y, f.from.x, f.from.y);
        if (d < 90 && p.kmh < 12) this.pickUpPassenger();
        else if (d < 150) UI.prompt('برای سوار کردن مسافر <b>بایست</b> 🛑');
        return;
      }

      // در حال حمل مسافر
      f.rideTime += dt;

      // رضایت: ترمز شدید، سرعت زیاد، تأخیر
      const dv = Math.abs(p.speed - f.lastSpeed) / dt;
      if (dv > 260) f.satisfaction -= dt * 12;
      f.lastSpeed = p.speed;
      if (p.kmh > 105) f.satisfaction -= dt * 3.5;
      if (f.rideTime > f.expected) f.satisfaction -= dt * 2.2;
      if (!City.isRoad(p.x, p.y)) f.satisfaction -= dt * 6;
      f.satisfaction = U.clamp(f.satisfaction, 0, 110);

      // رویدادها
      if (f.event && f.event.active) this.updateEvent(dt);
      else if (f.eventQueue.length && f.rideTime > f.eventQueue[0].at) {
        const next = f.eventQueue.shift();
        this.startEvent(next.def);
      }

      // رسیدن به مقصد
      const d = U.dist(p.x, p.y, f.to.x, f.to.y);
      if (d < 95 && p.kmh < 12) this.dropOff();
      else if (d < 160) UI.prompt('برای پیاده کردن مسافر <b>بایست</b> 🏁');
    },

    /* ---------- خدمات شهری ---------- */
    updateServices(dt) {
      const p = this.player;
      const poi = City.poiAt(p.x, p.y);
      this.currentPOI = poi;
      if (!poi) return false;

      const stopped = p.kmh < 4;
      if (poi.type === 'fuel') {
        if (!stopped) { UI.prompt('⛽ ' + poi.name + ' — برای سوخت‌گیری <b>بایست</b>'); return true; }
        if (p.fuel >= p.tank - 0.05) { UI.prompt('⛽ باک پره، جاده در انتظارته!'); return true; }
        const liters = Math.min(9 * dt, p.tank - p.fuel);
        const cost = liters * FUEL_PRICE;
        if (this.money < cost) { UI.prompt('⛽ پول کافی نداری! باید کار کنی.'); return true; }
        p.fuel += liters;
        this.money -= cost;
        this.dayStats.expenses += cost;
        this.fuelSfx = (this.fuelSfx || 0) + dt;
        if (this.fuelSfx > 0.35) { this.fuelSfx = 0; Sound.fuelTick(); }
        UI.prompt('⛽ در حال بنزین زدن… ' + U.fa(Math.round(p.fuel)) + '/' + U.fa(p.tank) +
          ' لیتر · هر لیتر ' + U.fa(FUEL_PRICE) + ' تومان');
        return true;
      }

      if (poi.type === 'repair') {
        if (!stopped) { UI.prompt('🔧 ' + poi.name + ' — برای تعمیر <b>بایست</b>'); return true; }
        if (p.health >= 99.9) { UI.prompt('🔧 ماشین سالمه، حاج رضا می‌گه برو به سلامت.'); return true; }
        const amount = Math.min(14 * dt, 100 - p.health);
        const cost = amount * REPAIR_PRICE;
        if (this.money < cost) { UI.prompt('🔧 پول تعمیر نداری! حاج رضا نسیه نمی‌ده.'); return true; }
        p.health += amount;
        this.money -= cost;
        this.dayStats.expenses += cost;
        UI.prompt('🔧 در حال تعمیر… سلامت ' + U.fa(Math.round(p.health)) + '٪ · هر درصد ' +
          U.fa(REPAIR_PRICE) + ' تومان');
        return true;
      }

      if (poi.type === 'garage') {
        if (!stopped) { UI.prompt('🚘 ' + poi.name + ' — برای ورود <b>بایست</b>'); return true; }
        UI.prompt('🚘 کلید <b>E</b> را بزن تا وارد نمایشگاه شوی');
        this.canEnterShop = true;
        return true;
      }
      return false;
    },

    buyCar(idx) {
      const car = DATA.CARS[idx];
      if (idx > this.carIndex + 1 || idx <= this.carIndex) return;
      if (this.money < car.price) return;
      this.money -= car.price;
      this.carIndex = idx;
      const fuelRatio = this.player.fuel / this.player.tank;
      this.player.setSpec(car, this.upgrades);
      this.player.fuel = car.tank * Math.max(fuelRatio, 0.5);
      this.player.health = 100;
      this.player.color = car.color;
      Sound.coin();
      this.toast('مبارکه! حالا با ' + car.name + ' کار می‌کنی 🎉', 'good');
      this.saveGame();
      if (idx === DATA.CARS.length - 1) {
        this.toast('🏆 به آخر خط ارتقا رسیدی! تو دیگه استاد خیابون‌های تهرانی.', 'good');
      }
    },

    buyUpgrade(id) {
      const up = DATA.UPGRADES.find(u => u.id === id);
      if (!up || this.upgrades[id] || this.money < up.price) return;
      this.money -= up.price;
      this.upgrades[id] = true;
      this.player.setSpec(DATA.CARS[this.carIndex], this.upgrades);
      Sound.coin();
      this.toast(up.name + ' نصب شد ' + up.icon, 'good');
      this.saveGame();
    },

    /* ---------- حلقه اصلی ---------- */
    update(dt, input) {
      if (!this.started || this.paused) return;

      // زمان
      this.minutes += dt * MINUTES_PER_SEC;
      if (this.minutes >= DAY_END) { this.endDay(); return; }

      this.canEnterShop = false;
      UI.prompt(null);

      this.player.update(dt, input, this);
      this.updateTraffic(dt);
      this.updateFare(dt);
      this.updateServices(dt);

      // خلاف و پلیس
      if (this.player.kmh > 95) this.addWanted(dt * 9);
      else this.wanted = Math.max(0, this.wanted - dt * 3.2);

      // بنزین تمام شد
      if (this.player.fuel <= 0) {
        UI.prompt('⛽ بنزین تمام شد! کمک بگیر…');
        this.outOfFuelTimer = (this.outOfFuelTimer || 0) + dt;
        if (this.outOfFuelTimer > 4) {
          this.outOfFuelTimer = 0;
          const cost = 250000;
          this.money -= cost;
          this.dayStats.expenses += cost;
          this.player.fuel = 8;
          this.toast('یدک‌کش ' + U.money(cost) + ' تومان گرفت و ۸ لیتر بنزین ریخت 🚛', 'bad');
        }
      }

      // ماشین از کار افتاد
      if (this.player.health <= 0) {
        this.brokenTimer = (this.brokenTimer || 0) + dt;
        UI.prompt('💀 ماشین از کار افتاد! یدک‌کش در راه است…');
        if (this.brokenTimer > 4) {
          this.brokenTimer = 0;
          const cost = 400000;
          this.money -= cost;
          this.dayStats.expenses += cost;
          this.player.health = 25;
          const near = City.pois.find(p => p.type === 'repair');
          this.player.x = near.cx; this.player.y = near.cy;
          this.player.speed = 0;
          if (this.fare && this.fare.state !== 'toPickup') {
            this.toast('مسافر وسط راه پیاده شد و رفت 😞', 'bad');
            this.fare = null; this.fareCooldown = 5;
          }
          this.toast('یدک‌کش تا تعمیرگاه بردت. ' + U.money(cost) + ' تومان آب خورد.', 'bad');
        }
      }

      // رادیو
      this.radioTimer -= dt;
      if (this.radioTimer <= 0) {
        this.radioTimer = U.rnd(70, 130);
        this.toast('📻 ' + U.choice(DATA.RADIO), '');
      }

      // ترافیک شهر هر چند دقیقه عوض می‌شود
      this.jamTimer = (this.jamTimer || 0) + dt;
      if (this.jamTimer > 55) { this.jamTimer = 0; City.shuffleJams(U.rnd(0.15, 0.35)); }

      // جلوه‌ها
      for (let i = this.effects.length - 1; i >= 0; i--) {
        this.effects[i].life -= dt;
        if (this.effects[i].life <= 0) this.effects.splice(i, 1);
      }

      // صدای موتور
      Sound.engine(Math.abs(this.player.speed) / this.player.maxSpeed, input.throttle);

      this.autoSaveTimer = (this.autoSaveTimer || 0) + dt;
      if (this.autoSaveTimer > 25) { this.autoSaveTimer = 0; this.saveGame(); }
    }
  };

  global.Game = Game;
})(window);
