/* ماشین بازیکن، ترافیک شهری و ماشین پلیس */
(function (global) {
  'use strict';

  const SPEED_TO_KMH = 0.5;

  class PlayerCar {
    constructor(spec) {
      this.setSpec(spec);
      this.x = City.VROADS[2];
      this.y = City.HROADS[3];
      this.angle = 0;
      this.speed = 0;
      this.fuel = this.tank;
      this.health = 100;
      this.offroadTimer = 0;
      this.skid = 0;
      this.honkTimer = 0;
      this.ac = false;
      this.music = false;
      this.crashCooldown = 0;
    }

    setSpec(spec, upgrades) {
      const up = upgrades || {};
      this.spec = spec;
      this.name = spec.name;
      this.color = spec.color;
      this.w = spec.w; this.h = spec.h;
      this.maxSpeed = spec.maxSpeed * (up.engine ? 1.08 : 1);
      this.accelRate = spec.accel * (up.engine ? 1.2 : 1);
      this.brakeRate = spec.brake * (up.tires ? 1.15 : 1);
      this.grip = Math.min(0.99, spec.grip * (up.tires ? 1.08 : 1));
      this.tank = spec.tank;
      this.consume = spec.consume * (up.engine ? 1.1 : 1);
      this.fragility = spec.fragility * (up.tires ? 0.92 : 1);
      this.comfort = spec.comfort;
      if (this.fuel === undefined) this.fuel = this.tank;
      this.fuel = Math.min(this.fuel, this.tank);
    }

    get kmh() { return Math.abs(this.speed) * SPEED_TO_KMH; }

    update(dt, input, game) {
      const outOfFuel = this.fuel <= 0;
      const broken = this.health <= 0;
      let throttle = input.throttle;
      if (outOfFuel || broken) throttle = 0;

      const onRoad = City.isRoad(this.x, this.y);
      const jam = City.jamAt(this.x, this.y);

      // شتاب و ترمز
      if (throttle > 0) {
        const cap = this.maxSpeed * (onRoad ? 1 : 0.32) * (1 - jam * 0.12);
        this.speed += this.accelRate * throttle * dt;
        if (this.speed > cap) this.speed = U.approach(this.speed, cap, this.brakeRate * dt);
      } else if (throttle < 0) {
        if (this.speed > 4) this.speed -= this.brakeRate * dt;
        else this.speed -= this.accelRate * 0.55 * dt;
        const revCap = -this.maxSpeed * 0.32;
        if (this.speed < revCap) this.speed = revCap;
      } else {
        this.speed = U.approach(this.speed, 0, 90 * dt);
      }

      if (input.handbrake) {
        this.speed = U.approach(this.speed, 0, this.brakeRate * 1.3 * dt);
        if (Math.abs(this.speed) > 60) this.skid = 1;
      }

      // اصطکاک و پیاده‌رو
      const drag = onRoad ? 26 : 340;
      this.speed = U.approach(this.speed, 0, drag * dt);

      // فرمان
      const spd = Math.abs(this.speed);
      const steerPower = 2.35 * U.clamp(spd / 110, 0, 1) * (0.65 + this.grip * 0.4);
      if (spd > 2) {
        this.angle += input.steer * steerPower * dt * (this.speed < 0 ? -1 : 1);
      }

      // حرکت
      const nx = this.x + Math.cos(this.angle) * this.speed * dt;
      const ny = this.y + Math.sin(this.angle) * this.speed * dt;
      this.x = U.clamp(nx, 24, City.W - 24);
      this.y = U.clamp(ny, 24, City.H - 24);

      // خروج از خیابان: خسارت و توجه پلیس
      if (!onRoad && spd > 30) {
        this.offroadTimer += dt;
        this.health -= dt * 1.6 * this.fragility;
        if (this.offroadTimer > 1.2) {
          this.offroadTimer = 0;
          game.addWanted(6);
          game.toast('روی پیاده‌رو نرو! خسارت خوردی 😬', 'warn');
        }
      } else {
        this.offroadTimer = Math.max(0, this.offroadTimer - dt);
      }

      // مصرف سوخت
      if (Math.abs(throttle) > 0.05 || spd > 5) {
        this.fuel -= (this.consume / 1000) * spd * dt * (1 + jam * 0.3) * (this.ac ? 1.12 : 1);
        if (this.fuel < 0) this.fuel = 0;
      }

      this.health = U.clamp(this.health, 0, 100);
      this.skid = Math.max(0, this.skid - dt * 2);
      this.honkTimer = Math.max(0, this.honkTimer - dt);
      this.crashCooldown = Math.max(0, this.crashCooldown - dt);
    }

    hitBy(otherSpeed) {
      const impact = Math.max(8, Math.abs(this.speed) * 0.6 + Math.abs(otherSpeed) * 0.35);
      const dmg = (impact / 22) * this.fragility;
      this.health = U.clamp(this.health - dmg, 0, 100);
      this.speed *= -0.22;
      return dmg;
    }
  }

  /* ماشین‌های ترافیک: بین تقاطع‌ها حرکت می‌کنند */
  class TrafficCar {
    constructor(i, j, di, dj) {
      this.i = i; this.j = j;
      this.setTarget(di, dj);
      const p = City.nodePos(i, j);
      this.x = p.x; this.y = p.y;
      this.color = U.choice(['#dfe3e8', '#9aa3ad', '#26303a', '#c9d6e2', '#7f8c99',
        '#e0c36a', '#b04a3f', '#3f6fb0', '#e8e2d6', '#4f5b66']);
      this.w = U.rndInt(42, 56); this.h = U.rndInt(22, 27);
      this.baseSpeed = U.rnd(95, 165);
      this.speed = this.baseSpeed;
      this.angle = Math.atan2(this.ty - this.y, this.tx - this.x);
      this.honk = 0;
      this.isBus = Math.random() < 0.1;
      if (this.isBus) { this.w = 92; this.h = 32; this.color = '#e3752b'; this.baseSpeed = U.rnd(70, 110); }
    }

    setTarget(di, dj) {
      this.di = di; this.dj = dj;
      const ni = U.clamp(this.i + di, 0, City.VROADS.length - 1);
      const nj = U.clamp(this.j + dj, 0, City.HROADS.length - 1);
      this.ni = ni; this.nj = nj;
      const p = City.nodePos(ni, nj);
      // خط راست (رانندگی سمت راست)
      const off = 24;
      this.tx = p.x + (dj !== 0 ? -dj * off : 0);
      this.ty = p.y + (di !== 0 ? di * off : 0);
      this.lane = { ox: (dj !== 0 ? -dj * off : 0), oy: (di !== 0 ? di * off : 0) };
      this.jam = City.jamOf(this.i, this.j, ni, nj);
    }

    pickNextDir() {
      const opts = [];
      if (this.ni + 1 < City.VROADS.length) opts.push([1, 0]);
      if (this.ni - 1 >= 0) opts.push([-1, 0]);
      if (this.nj + 1 < City.HROADS.length) opts.push([0, 1]);
      if (this.nj - 1 >= 0) opts.push([0, -1]);
      const forward = opts.filter(o => o[0] === this.di && o[1] === this.dj);
      const notBack = opts.filter(o => !(o[0] === -this.di && o[1] === -this.dj));
      let pick;
      if (forward.length && Math.random() < 0.62) pick = forward[0];
      else pick = U.choice(notBack.length ? notBack : opts);
      this.i = this.ni; this.j = this.nj;
      this.setTarget(pick[0], pick[1]);
    }

    update(dt, all, player) {
      const targetX = this.tx, targetY = this.ty;
      const d = U.dist(this.x, this.y, targetX, targetY);
      if (d < 26) { this.pickNextDir(); return; }

      const dirX = (targetX - this.x) / d, dirY = (targetY - this.y) / d;
      this.angle = Math.atan2(dirY, dirX);

      // سرعت هدف با توجه به ترافیک
      let want = this.baseSpeed * (1 - this.jam * 0.72);

      // فاصله از ماشین جلویی
      for (let k = 0; k < all.length; k++) {
        const o = all[k];
        if (o === this) continue;
        const dx = o.x - this.x, dy = o.y - this.y;
        const ahead = dx * dirX + dy * dirY;
        if (ahead > 0 && ahead < 78) {
          const side = Math.abs(dx * -dirY + dy * dirX);
          if (side < 26) { want = Math.min(want, Math.max(0, (ahead - 46) * 3)); }
        }
      }
      // بازیکن جلوی من است؟
      if (player) {
        const dx = player.x - this.x, dy = player.y - this.y;
        const ahead = dx * dirX + dy * dirY;
        const side = Math.abs(dx * -dirY + dy * dirX);
        if (ahead > 0 && ahead < 82 && side < 28) {
          want = Math.min(want, Math.max(0, (ahead - 50) * 3));
          if (want < 20 && this.honk <= 0 && Math.random() < 0.02) this.honk = 1.2;
        }
      }

      this.speed = U.approach(this.speed, want, (want > this.speed ? 90 : 320) * dt);
      this.x += dirX * this.speed * dt;
      this.y += dirY * this.speed * dt;
      this.honk = Math.max(0, this.honk - dt);
    }
  }

  /* پلیس: گشت می‌زند و اگر خلافت زیاد شود دنبالت می‌کند */
  class PoliceCar extends TrafficCar {
    constructor(i, j, di, dj) {
      super(i, j, di, dj);
      this.color = '#1f4fa8';
      this.w = 50; this.h = 26; this.isBus = false;
      this.baseSpeed = 190;
      this.chasing = false;
      this.siren = 0;
      this.catchTimer = 0;
      this.police = true;
    }

    update(dt, all, player, game) {
      this.siren += dt * 6;
      const dToPlayer = U.dist(this.x, this.y, player.x, player.y);

      if (game.wanted > 45 && dToPlayer < 620) this.chasing = true;
      if (game.wanted < 8 || dToPlayer > 1500) this.chasing = false;

      if (this.chasing) {
        const ang = Math.atan2(player.y - this.y, player.x - this.x);
        this.angle = U.wrapAngle(this.angle + U.wrapAngle(ang - this.angle) * Math.min(1, dt * 4));
        this.speed = U.approach(this.speed, 265, 200 * dt);
        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;
        this.x = U.clamp(this.x, 20, City.W - 20);
        this.y = U.clamp(this.y, 20, City.H - 20);
        if (dToPlayer < 88) {
          this.catchTimer += dt;
          if (this.catchTimer > 1.4) { this.catchTimer = 0; game.issueFine(this); }
        } else this.catchTimer = Math.max(0, this.catchTimer - dt);
      } else {
        super.update(dt, all, player);
      }
    }
  }

  global.PlayerCar = PlayerCar;
  global.TrafficCar = TrafficCar;
  global.PoliceCar = PoliceCar;
  global.SPEED_TO_KMH = SPEED_TO_KMH;
})(window);
