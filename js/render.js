/* موتور نمایش: شهر، ماشین‌ها، نشانگرها و نقشه کوچک */
(function (global) {
  'use strict';

  const Render = {
    init(canvas, mini) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.mini = mini;
      this.mctx = mini.getContext('2d');
      this.cam = { x: 0, y: 0, zoom: 1 };
      this.resize();
      window.addEventListener('resize', () => this.resize());
    },

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = this.canvas.clientWidth || window.innerWidth;
      const h = this.canvas.clientHeight || window.innerHeight;
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      this.dpr = dpr;
      this.vw = w; this.vh = h;
      this.mini.width = this.mini.clientWidth * dpr;
      this.mini.height = this.mini.clientHeight * dpr;
    },

    follow(car, dt) {
      const lead = 0.35;
      const tx = car.x + Math.cos(car.angle) * car.speed * lead;
      const ty = car.y + Math.sin(car.angle) * car.speed * lead;
      const k = Math.min(1, dt * 4.5);
      this.cam.x = U.lerp(this.cam.x, tx, k);
      this.cam.y = U.lerp(this.cam.y, ty, k);
      const targetZoom = U.clamp(1.05 - Math.abs(car.speed) / 1500, 0.78, 1.05) * this.baseZoom();
      this.cam.zoom = U.lerp(this.cam.zoom || targetZoom, targetZoom, Math.min(1, dt * 2.5));
    },

    baseZoom() {
      return U.clamp(Math.min(this.vw, this.vh) / 720, 0.62, 1.15);
    },

    worldToScreen(x, y) {
      return {
        x: (x - this.cam.x) * this.cam.zoom + this.vw / 2,
        y: (y - this.cam.y) * this.cam.zoom + this.vh / 2
      };
    },

    draw(game) {
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.vw, this.vh);

      const night = game.nightFactor();
      ctx.fillStyle = night > 0.5 ? '#0d1117' : '#1b2027';
      ctx.fillRect(0, 0, this.vw, this.vh);

      ctx.save();
      ctx.translate(this.vw / 2, this.vh / 2);
      ctx.scale(this.cam.zoom, this.cam.zoom);
      ctx.translate(-this.cam.x, -this.cam.y);

      const m = 220 / this.cam.zoom;
      const view = {
        x: this.cam.x - this.vw / 2 / this.cam.zoom - m,
        y: this.cam.y - this.vh / 2 / this.cam.zoom - m,
        w: this.vw / this.cam.zoom + m * 2,
        h: this.vh / this.cam.zoom + m * 2
      };

      this.drawGround(ctx, view, night);
      this.drawRoads(ctx, view, night);
      this.drawPOIs(ctx, view);
      this.drawBuildings(ctx, view, night);
      this.drawLandmarks(ctx, view, night);
      if (game.upgrades.gps && game.routePath) this.drawRoute(ctx, game.routePath);
      this.drawMarkers(ctx, game);
      this.drawTraffic(ctx, view, game);
      this.drawPlayer(ctx, game);
      this.drawEffects(ctx, game);

      ctx.restore();

      this.drawOverlay(ctx, game, night);
      this.drawOffscreenArrow(ctx, game);
      ctx.restore();

      this.drawMini(game);
    },

    drawGround(ctx, view, night) {
      ctx.fillStyle = night > 0.5 ? '#12171d' : '#232a32';
      ctx.fillRect(view.x, view.y, view.w, view.h);
    },

    drawRoads(ctx, view, night) {
      const rw = City.ROAD_W;
      const road = night > 0.5 ? '#2a2f36' : '#3a4048';
      ctx.fillStyle = road;
      City.VROADS.forEach(x => {
        if (x + rw < view.x || x - rw > view.x + view.w) return;
        ctx.fillRect(x - rw / 2, 0, rw, City.H);
      });
      City.HROADS.forEach(y => {
        if (y + rw < view.y || y - rw > view.y + view.h) return;
        ctx.fillRect(0, y - rw / 2, City.W, rw);
      });

      // میدان‌ها
      City.squares.forEach(sq => {
        if (sq.x + sq.r < view.x || sq.x - sq.r > view.x + view.w) return;
        if (sq.y + sq.r < view.y || sq.y - sq.r > view.y + view.h) return;
        ctx.fillStyle = road;
        ctx.beginPath(); ctx.arc(sq.x, sq.y, sq.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = night > 0.5 ? '#1c3a24' : '#2e5a37';
        ctx.beginPath(); ctx.arc(sq.x, sq.y, sq.r * 0.42, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.14)';
        ctx.beginPath(); ctx.arc(sq.x, sq.y, sq.r * 0.2, 0, Math.PI * 2); ctx.fill();
      });

      // خط‌کشی وسط
      ctx.strokeStyle = 'rgba(240,220,120,.55)';
      ctx.lineWidth = 3;
      ctx.setLineDash([26, 22]);
      City.VROADS.forEach(x => {
        if (x < view.x - 40 || x > view.x + view.w + 40) return;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, City.H); ctx.stroke();
      });
      City.HROADS.forEach(y => {
        if (y < view.y - 40 || y > view.y + view.h + 40) return;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(City.W, y); ctx.stroke();
      });
      ctx.setLineDash([]);

      // حاشیه پیاده‌رو
      ctx.strokeStyle = 'rgba(255,255,255,.10)';
      ctx.lineWidth = 4;
      City.VROADS.forEach(x => {
        if (x < view.x - 60 || x > view.x + view.w + 60) return;
        ctx.beginPath(); ctx.moveTo(x - rw / 2, 0); ctx.lineTo(x - rw / 2, City.H);
        ctx.moveTo(x + rw / 2, 0); ctx.lineTo(x + rw / 2, City.H); ctx.stroke();
      });
      City.HROADS.forEach(y => {
        if (y < view.y - 60 || y > view.y + view.h + 60) return;
        ctx.beginPath(); ctx.moveTo(0, y - rw / 2); ctx.lineTo(City.W, y - rw / 2);
        ctx.moveTo(0, y + rw / 2); ctx.lineTo(City.W, y + rw / 2); ctx.stroke();
      });
    },

    drawBuildings(ctx, view, night) {
      const list = City.buildings;
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (b.x > view.x + view.w || b.x + b.w < view.x || b.y > view.y + view.h || b.y + b.h < view.y) continue;
        if (b.park) {
          ctx.fillStyle = night > 0.5 ? '#1b3421' : '#2f5734';
          U.roundRect(ctx, b.x, b.y, b.w, b.h, 10); ctx.fill();
          ctx.fillStyle = night > 0.5 ? '#245029' : '#3d7043';
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.arc(b.x + b.w * (0.25 + k * 0.25), b.y + b.h * 0.5, Math.min(b.w, b.h) * 0.16, 0, Math.PI * 2);
            ctx.fill();
          }
          continue;
        }
        const base = night > 0.5 ? 0.13 : 0.26;
        const g = Math.floor((base + b.tone * 0.18) * 255);
        ctx.fillStyle = 'rgb(' + Math.floor(g * 0.98) + ',' + Math.floor(g * 0.97) + ',' + Math.floor(g * 1.02) + ')';
        U.roundRect(ctx, b.x, b.y, b.w, b.h, 4); ctx.fill();
        // سایه‌ی ارتفاع
        ctx.fillStyle = 'rgba(0,0,0,.22)';
        ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6);
        // پنجره‌ها
        if (this.cam.zoom > 0.7) {
          ctx.fillStyle = night > 0.4 ? 'rgba(255,214,120,' + (0.25 + night * 0.5) + ')' : 'rgba(180,205,230,.28)';
          const cols = Math.max(1, Math.floor(b.w / 16));
          const rows = Math.max(1, Math.floor(b.h / 18));
          for (let cx = 0; cx < cols; cx++) {
            for (let cy = 0; cy < rows; cy++) {
              if (((cx * 7 + cy * 13 + Math.floor(b.x)) % 5) === 0) continue;
              ctx.fillRect(b.x + 6 + cx * 16, b.y + 6 + cy * 18, 7, 8);
            }
          }
        }
      }
    },

    drawLandmarks(ctx, view, night) {
      City.landmarks.forEach(l => {
        const b = l.block;
        if (b.x > view.x + view.w || b.x + b.w < view.x || b.y > view.y + view.h || b.y + b.h < view.y) return;
        ctx.save();
        switch (l.type) {
          case 'park':
            ctx.fillStyle = night > 0.5 ? '#1d3a24' : '#31603a';
            U.roundRect(ctx, b.x, b.y, b.w, b.h, 18); ctx.fill();
            ctx.fillStyle = night > 0.5 ? '#27512f' : '#417a49';
            for (let k = 0; k < 14; k++) {
              const px = b.x + ((k * 137) % (b.w - 60)) + 30;
              const py = b.y + ((k * 89) % (b.h - 60)) + 30;
              ctx.beginPath(); ctx.arc(px, py, 22, 0, Math.PI * 2); ctx.fill();
            }
            break;
          case 'hill':
            ctx.fillStyle = night > 0.5 ? '#26313a' : '#3c4a55';
            U.roundRect(ctx, b.x, b.y, b.w, b.h, 24); ctx.fill();
            ctx.fillStyle = night > 0.5 ? '#31404b' : '#4d5f6c';
            ctx.beginPath();
            ctx.moveTo(b.x + b.w * 0.15, b.y + b.h * 0.85);
            ctx.lineTo(b.x + b.w * 0.5, b.y + b.h * 0.2);
            ctx.lineTo(b.x + b.w * 0.85, b.y + b.h * 0.85);
            ctx.closePath(); ctx.fill();
            break;
          case 'stadium':
            ctx.fillStyle = '#2b6b3b';
            ctx.beginPath();
            ctx.ellipse(l.x, l.y, b.w * 0.42, b.h * 0.38, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.ellipse(l.x, l.y, b.w * 0.3, b.h * 0.26, 0, 0, Math.PI * 2); ctx.stroke();
            break;
          case 'airport':
            ctx.fillStyle = '#3a4048';
            U.roundRect(ctx, b.x, b.y, b.w, b.h, 8); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 4; ctx.setLineDash([30, 24]);
            ctx.beginPath(); ctx.moveTo(b.x + 30, l.y); ctx.lineTo(b.x + b.w - 30, l.y); ctx.stroke();
            ctx.setLineDash([]);
            break;
          case 'bazaar':
            ctx.fillStyle = night > 0.5 ? '#3a2c1c' : '#6b4f2a';
            U.roundRect(ctx, b.x, b.y, b.w, b.h, 10); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.10)';
            for (let k = 0; k * 44 < b.w - 20; k++) ctx.fillRect(b.x + 10 + k * 44, b.y + 10, 26, b.h - 20);
            break;
          case 'hospital':
            ctx.fillStyle = '#e8eef4';
            U.roundRect(ctx, b.x, b.y, b.w, b.h, 10); ctx.fill();
            ctx.fillStyle = '#d63c3c';
            ctx.fillRect(l.x - 12, l.y - 40, 24, 80);
            ctx.fillRect(l.x - 40, l.y - 12, 80, 24);
            break;
          case 'campus':
            ctx.fillStyle = night > 0.5 ? '#2a3340' : '#48566b';
            U.roundRect(ctx, b.x, b.y, b.w, b.h, 10); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.35)';
            for (let k = 0; k < 6; k++) ctx.fillRect(b.x + 24 + k * 34, b.y + b.h * 0.35, 14, b.h * 0.4);
            break;
          case 'towers':
            ctx.fillStyle = night > 0.5 ? '#222b36' : '#3c4757';
            U.roundRect(ctx, b.x, b.y, b.w, b.h, 8); ctx.fill();
            ctx.fillStyle = night > 0.4 ? 'rgba(255,214,120,.55)' : 'rgba(190,215,240,.4)';
            for (let k = 0; k < 4; k++) ctx.fillRect(b.x + 30 + k * 60, b.y + 30, 34, b.h - 60);
            break;
          case 'bridge':
            ctx.fillStyle = night > 0.5 ? '#2b3a34' : '#43604f';
            U.roundRect(ctx, b.x, b.y, b.w, b.h, 14); ctx.fill();
            ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(b.x + 20, b.y + b.h - 30);
            ctx.quadraticCurveTo(l.x, b.y + 20, b.x + b.w - 20, b.y + b.h - 30);
            ctx.stroke();
            break;
          case 'tower':
            ctx.fillStyle = night > 0.5 ? '#232a33' : '#3a4553';
            U.roundRect(ctx, b.x, b.y, b.w, b.h, 12); ctx.fill();
            ctx.fillStyle = '#c9ccd2';
            ctx.fillRect(l.x - 12, l.y - b.h * 0.34, 24, b.h * 0.62);
            ctx.beginPath(); ctx.arc(l.x, l.y - b.h * 0.3, 42, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = night > 0.4 ? '#ffd76a' : '#8fa2b8';
            ctx.beginPath(); ctx.arc(l.x, l.y - b.h * 0.3, 26, 0, Math.PI * 2); ctx.fill();
            break;
        }
        if (this.cam.zoom > 0.6) {
          ctx.fillStyle = 'rgba(255,255,255,.82)';
          ctx.font = '600 22px Vazirmatn, Tahoma, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(l.name, l.x, b.y + b.h - 14);
        }
        ctx.restore();
      });
    },

    drawPOIs(ctx, view) {
      const icons = { fuel: '⛽', repair: '🔧', garage: '🚘' };
      const colors = { fuel: '#2f9e6e', repair: '#d68a3c', garage: '#4c8bf5' };
      City.pois.forEach(p => {
        if (p.x > view.x + view.w || p.x + p.w < view.x || p.y > view.y + view.h || p.y + p.h < view.y) return;
        ctx.fillStyle = 'rgba(255,255,255,.06)';
        U.roundRect(ctx, p.x, p.y, p.w, p.h, 12); ctx.fill();
        ctx.strokeStyle = colors[p.type]; ctx.lineWidth = 4;
        ctx.setLineDash([14, 10]);
        U.roundRect(ctx, p.x + 4, p.y + 4, p.w - 8, p.h - 8, 10); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '42px serif'; ctx.textAlign = 'center';
        ctx.fillText(icons[p.type], p.cx, p.cy + 8);
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.font = '600 16px Vazirmatn, Tahoma, sans-serif';
        ctx.fillText(p.name, p.cx, p.y + p.h - 10);
      });
    },

    drawRoute(ctx, path) {
      if (!path || path.length < 2) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(96,180,255,.45)';
      ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(150,215,255,.85)';
      ctx.lineWidth = 4;
      ctx.setLineDash([18, 16]);
      ctx.lineDashOffset = -(performance.now() / 40) % 34;
      ctx.stroke();
      ctx.restore();
    },

    marker(ctx, x, y, color, emoji, label, t) {
      const pulse = 1 + Math.sin(t * 4) * 0.12;
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, 46 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y - 44, 22, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 12, y - 30); ctx.lineTo(x + 12, y - 30); ctx.lineTo(x, y - 6); ctx.closePath(); ctx.fill();
      ctx.font = '24px serif'; ctx.textAlign = 'center';
      ctx.fillText(emoji, x, y - 36);
      if (label) {
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.font = '600 17px Vazirmatn, Tahoma, sans-serif';
        const w = ctx.measureText(label).width + 18;
        U.roundRect(ctx, x - w / 2, y + 6, w, 26, 8); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x, y + 25);
      }
      ctx.restore();
    },

    drawMarkers(ctx, game) {
      const t = performance.now() / 1000;
      const f = game.fare;
      if (!f) return;
      if (f.state === 'toPickup') this.marker(ctx, f.from.x, f.from.y, '#f5c542', f.passenger.emoji, f.from.name, t);
      else if (f.state === 'riding' || f.state === 'stopReq') this.marker(ctx, f.to.x, f.to.y, '#4cc76a', '🏁', f.to.name, t);
    },

    drawCarBody(ctx, c, opts) {
      const o = opts || {};
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      const w = c.w, h = c.h;
      // سایه
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      U.roundRect(ctx, -w / 2 + 3, -h / 2 + 4, w, h, 7); ctx.fill();
      // بدنه
      ctx.fillStyle = c.color;
      U.roundRect(ctx, -w / 2, -h / 2, w, h, 7); ctx.fill();
      // شیشه‌ها
      ctx.fillStyle = 'rgba(20,30,40,.72)';
      U.roundRect(ctx, -w * 0.06, -h / 2 + 3, w * 0.3, h - 6, 4); ctx.fill();
      ctx.fillStyle = 'rgba(20,30,40,.45)';
      U.roundRect(ctx, -w * 0.34, -h / 2 + 4, w * 0.22, h - 8, 3); ctx.fill();
      // چراغ جلو
      ctx.fillStyle = o.lights ? '#fff6cf' : 'rgba(255,246,207,.6)';
      ctx.fillRect(w / 2 - 4, -h / 2 + 3, 4, 5);
      ctx.fillRect(w / 2 - 4, h / 2 - 8, 4, 5);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(-w / 2, -h / 2 + 3, 3, 5);
      ctx.fillRect(-w / 2, h / 2 - 8, 3, 5);
      if (o.taxi) {
        // نوار زرد تاکسی روی بدنه + شطرنجی
        ctx.fillStyle = '#f5c542';
        ctx.fillRect(-w / 2, -h / 2, w, 4);
        ctx.fillRect(-w / 2, h / 2 - 4, w, 4);
        ctx.fillStyle = 'rgba(0,0,0,.75)';
        for (let k = 0; k < w; k += 10) {
          ctx.fillRect(-w / 2 + k, -h / 2, 5, 4);
          ctx.fillRect(-w / 2 + k + 5, h / 2 - 4, 5, 4);
        }
        // چراغ سقفی
        ctx.fillStyle = o.lights ? '#fff0b0' : '#f5c542';
        U.roundRect(ctx, -8, -6, 17, 12, 3); ctx.fill();
        ctx.fillStyle = '#20180a';
        ctx.font = '700 8px Vazirmatn, Tahoma, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TAXI', 0.5, 3);
      }
      if (o.police) {
        const on = Math.floor(c.siren) % 2 === 0;
        ctx.fillStyle = on ? '#ff3b3b' : '#3b6bff';
        U.roundRect(ctx, -8, -h / 2 - 4, 16, 7, 3); ctx.fill();
      }
      ctx.restore();

      if (o.lights) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(c.x, c.y); ctx.rotate(c.angle);
        const g = ctx.createRadialGradient(w / 2, 0, 5, w / 2, 0, 210);
        g.addColorStop(0, 'rgba(255,240,190,.28)');
        g.addColorStop(1, 'rgba(255,240,190,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(w / 2, 0);
        ctx.arc(w / 2, 0, 210, -0.42, 0.42);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    },

    drawTraffic(ctx, view, game) {
      const night = game.nightFactor();
      game.traffic.forEach(c => {
        if (c.x < view.x || c.x > view.x + view.w || c.y < view.y || c.y > view.y + view.h) return;
        this.drawCarBody(ctx, c, { lights: night > 0.45, police: !!c.police });
        if (c.honk > 0) {
          ctx.fillStyle = 'rgba(255,255,255,.85)';
          ctx.font = '20px Vazirmatn, Tahoma, sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('بوووق!', c.x, c.y - 26);
        }
      });
    },

    drawPlayer(ctx, game) {
      const p = game.player;
      const night = game.nightFactor();
      // هاله‌ی کوچک زیر ماشین تا بین ترافیک گم نشود
      ctx.save();
      ctx.globalAlpha = 0.22;
      const gl = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 52);
      gl.addColorStop(0, '#f5c542');
      gl.addColorStop(1, 'rgba(245,197,66,0)');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(p.x, p.y, 52, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (p.skid > 0.1) {
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2); ctx.fill();
      }
      this.drawCarBody(ctx, p, { lights: night > 0.45 || p.health < 40, taxi: true });
      if (p.honkTimer > 0) {
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.font = '22px Vazirmatn, Tahoma, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('بوووق!', p.x, p.y - 34);
      }
      if (p.music) {
        ctx.fillStyle = 'rgba(160,220,255,.9)';
        ctx.font = '20px serif'; ctx.textAlign = 'center';
        const t = performance.now() / 300;
        ctx.fillText('🎵', p.x + Math.sin(t) * 14, p.y - 40 - (t % 3) * 6);
      }
      if (game.fare && (game.fare.state === 'riding' || game.fare.state === 'stopReq')) {
        ctx.font = '18px serif'; ctx.textAlign = 'center';
        ctx.fillText(game.fare.passenger.emoji, p.x - Math.cos(p.angle) * 10, p.y - Math.sin(p.angle) * 10 + 4);
      }
    },

    drawEffects(ctx, game) {
      game.effects.forEach(e => {
        ctx.save();
        ctx.globalAlpha = U.clamp(e.life / e.max, 0, 1);
        if (e.type === 'text') {
          ctx.fillStyle = e.color || '#fff';
          ctx.font = '700 ' + (e.size || 22) + 'px Vazirmatn, Tahoma, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(e.text, e.x, e.y - (1 - e.life / e.max) * 50);
        } else if (e.type === 'burst') {
          ctx.strokeStyle = e.color || '#fff';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(e.x, e.y, (1 - e.life / e.max) * 60 + 10, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      });
    },

    drawOverlay(ctx, game, night) {
      if (night > 0.02) {
        ctx.fillStyle = 'rgba(6,10,20,' + (night * 0.55) + ')';
        ctx.fillRect(0, 0, this.vw, this.vh);
      }
      if (game.smog > 0.02) {
        ctx.fillStyle = 'rgba(190,175,140,' + (game.smog * 0.22) + ')';
        ctx.fillRect(0, 0, this.vw, this.vh);
      }
      if (game.player.health < 30) {
        const a = (1 - game.player.health / 30) * 0.25;
        ctx.fillStyle = 'rgba(180,30,30,' + a * (0.6 + 0.4 * Math.sin(performance.now() / 260)) + ')';
        ctx.fillRect(0, 0, this.vw, this.vh);
      }
    },

    /* پیکان راهنما وقتی مقصد خارج از صفحه است */
    drawOffscreenArrow(ctx, game) {
      const f = game.fare;
      if (!f) return;
      const target = f.state === 'toPickup' ? f.from : f.to;
      const s = this.worldToScreen(target.x, target.y);
      const pad = 70;
      if (s.x > pad && s.x < this.vw - pad && s.y > pad && s.y < this.vh - pad) return;
      const cx = this.vw / 2, cy = this.vh / 2;
      const ang = Math.atan2(s.y - cy, s.x - cx);
      const rx = Math.min(this.vw / 2 - pad, this.vh / 2 - pad);
      const px = cx + Math.cos(ang) * rx, py = cy + Math.sin(ang) * rx;
      ctx.save();
      ctx.translate(px, py); ctx.rotate(ang);
      ctx.fillStyle = f.state === 'toPickup' ? '#f5c542' : '#4cc76a';
      ctx.beginPath();
      ctx.moveTo(22, 0); ctx.lineTo(-14, -14); ctx.lineTo(-6, 0); ctx.lineTo(-14, 14);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      const d = U.dist(game.player.x, game.player.y, target.x, target.y);
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      const label = U.fa(Math.round(d / 12)) + ' متر';
      ctx.font = '600 15px Vazirmatn, Tahoma, sans-serif';
      const w = ctx.measureText(label).width + 16;
      U.roundRect(ctx, px - w / 2, py + 22, w, 24, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.fillText(label, px, py + 39);
    },

    /* نقشه کوچک */
    drawMini(game) {
      const ctx = this.mctx;
      if (!this.mini.width || !this.mini.height) {
        if (this.mini.clientWidth) this.resize();
        if (!this.mini.width) return;
      }
      const w = this.mini.width, h = this.mini.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const sx = w / City.W, sy = h / City.H;
      ctx.fillStyle = '#141a21'; ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#39404a';
      ctx.lineWidth = Math.max(2, 6 * sx);
      City.VROADS.forEach(x => { ctx.beginPath(); ctx.moveTo(x * sx, 0); ctx.lineTo(x * sx, h); ctx.stroke(); });
      City.HROADS.forEach(y => { ctx.beginPath(); ctx.moveTo(0, y * sy); ctx.lineTo(w, y * sy); ctx.stroke(); });

      // ترافیک روی نقشه
      ctx.lineWidth = Math.max(2, 6 * sx);
      Object.keys(City.jams).forEach(k => {
        const parts = k.split('-').map(Number);
        const a = { i: Math.floor(parts[0] / 100), j: parts[0] % 100 };
        const b = { i: Math.floor(parts[1] / 100), j: parts[1] % 100 };
        const pa = City.nodePos(a.i, a.j), pb = City.nodePos(b.i, b.j);
        const v = City.jams[k];
        ctx.strokeStyle = v > 0.75 ? '#c0392b' : '#d68a3c';
        ctx.beginPath(); ctx.moveTo(pa.x * sx, pa.y * sy); ctx.lineTo(pb.x * sx, pb.y * sy); ctx.stroke();
      });

      // مسیر پیشنهادی
      if (game.upgrades.gps && game.routePath && game.routePath.length > 1) {
        ctx.strokeStyle = '#5ab0ff'; ctx.lineWidth = Math.max(2, 4 * sx);
        ctx.beginPath();
        ctx.moveTo(game.routePath[0].x * sx, game.routePath[0].y * sy);
        for (let i = 1; i < game.routePath.length; i++) ctx.lineTo(game.routePath[i].x * sx, game.routePath[i].y * sy);
        ctx.stroke();
      }

      // نقاط مهم
      City.pois.forEach(p => {
        ctx.fillStyle = p.type === 'fuel' ? '#2f9e6e' : (p.type === 'repair' ? '#d68a3c' : '#4c8bf5');
        ctx.fillRect(p.cx * sx - 3, p.cy * sy - 3, 6, 6);
      });

      const f = game.fare;
      if (f) {
        const t = f.state === 'toPickup' ? f.from : f.to;
        ctx.fillStyle = f.state === 'toPickup' ? '#f5c542' : '#4cc76a';
        ctx.beginPath(); ctx.arc(t.x * sx, t.y * sy, Math.max(4, 5 * sx), 0, Math.PI * 2); ctx.fill();
      }

      game.traffic.forEach(c => {
        if (!c.police) return;
        ctx.fillStyle = '#5aa2ff';
        ctx.fillRect(c.x * sx - 2, c.y * sy - 2, 4, 4);
      });

      const p = game.player;
      ctx.save();
      ctx.translate(p.x * sx, p.y * sy);
      ctx.rotate(p.angle);
      ctx.fillStyle = '#f5c542';
      ctx.beginPath();
      ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  };

  global.Render = Render;
})(window);
