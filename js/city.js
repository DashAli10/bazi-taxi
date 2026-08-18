/* ساخت نقشه ساده‌ی تهران: خیابان‌ها، میدان‌ها، ساختمان‌ها و مکان‌ها */
(function (global) {
  'use strict';

  const VROADS = [220, 760, 1300, 1860, 2420, 2980, 3520];
  const HROADS = [200, 700, 1250, 1800, 2350, 2820];
  const ROAD_W = 96;
  const W = 3740, H = 3020;

  const City = {
    VROADS, HROADS, ROAD_W, W, H,
    blocks: [], buildings: [], squares: [], landmarks: [], pois: [], places: [],
    jams: {},          // کلید سگمنت -> شدت ترافیک ۰ تا ۱
    nodeCount: { i: VROADS.length, j: HROADS.length },

    build() {
      const rng = U.seeded(13571113);
      this.buildBlocks(rng);
      this.buildSquares();
      this.buildLandmarks();
      this.buildPOIs();
      this.buildPlaces();
      this.resetJams();
      return this;
    },

    /* ---------- بلوک‌ها و ساختمان‌ها ---------- */
    buildBlocks(rng) {
      const xs = [0].concat(VROADS, [W]);
      const ys = [0].concat(HROADS, [H]);
      const half = ROAD_W / 2;
      for (let i = 0; i < xs.length - 1; i++) {
        for (let j = 0; j < ys.length - 1; j++) {
          const x0 = (i === 0 ? 0 : xs[i] + half) + 8;
          const x1 = (i === xs.length - 2 ? W : xs[i + 1] - half) - 8;
          const y0 = (j === 0 ? 0 : ys[j] + half) + 8;
          const y1 = (j === ys.length - 2 ? H : ys[j + 1] - half) - 8;
          if (x1 - x0 < 60 || y1 - y0 < 60) continue;
          const block = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, gi: i - 1, gj: j - 1, landmark: null };
          this.blocks.push(block);
          this.fillBlock(block, rng);
        }
      }
    },

    fillBlock(block, rng) {
      const pad = 10;
      let y = block.y + pad;
      while (y < block.y + block.h - 40) {
        const rowH = 60 + rng() * 90;
        let x = block.x + pad;
        while (x < block.x + block.w - 40) {
          const bw = 55 + rng() * 110;
          const bh = Math.min(rowH, block.y + block.h - pad - y);
          if (x + bw > block.x + block.w - pad) break;
          const kind = rng();
          this.buildings.push({
            x: x, y: y, w: bw, h: bh,
            tone: 0.5 + rng() * 0.5,
            park: kind > 0.9,
            tall: kind < 0.16,
            block: block
          });
          x += bw + 6 + rng() * 10;
        }
        y += rowH + 8 + rng() * 10;
      }
    },

    /* ---------- میدان‌ها ---------- */
    buildSquares() {
      const list = [
        { i: 5, j: 0, name: 'میدان تجریش', r: 92 },
        { i: 3, j: 1, name: 'میدان ونک', r: 96 },
        { i: 0, j: 1, name: 'فلکه دوم صادقیه', r: 88 },
        { i: 3, j: 2, name: 'میدان ولیعصر', r: 90 },
        { i: 2, j: 3, name: 'میدان انقلاب', r: 100 },
        { i: 0, j: 3, name: 'میدان آزادی', r: 104 },
        { i: 5, j: 3, name: 'میدان امام حسین', r: 92 },
        { i: 4, j: 2, name: 'میدان هفت تیر', r: 88 },
        { i: 2, j: 5, name: 'میدان راه‌آهن', r: 90 },
        { i: 4, j: 4, name: 'میدان خراسان', r: 84 }
      ];
      this.squares = list.map(s => ({
        name: s.name, r: s.r, i: s.i, j: s.j,
        x: VROADS[s.i], y: HROADS[s.j]
      }));
    },

    /* ---------- نشانه‌های شهری ---------- */
    buildLandmarks() {
      const put = (gi, gj, name, type) => {
        const b = this.blocks.find(bb => bb.gi === gi && bb.gj === gj);
        if (!b) return;
        b.landmark = name;
        this.landmarks.push({ name, type, x: b.x + b.w / 2, y: b.y + b.h / 2, w: b.w, h: b.h, block: b });
        // ساختمان‌های داخل بلوک نشانه حذف می‌شوند
        this.buildings = this.buildings.filter(bu => bu.block !== b);
      };
      put(1, 2, 'برج میلاد', 'tower');
      put(-1, 3, 'ورزشگاه آزادی', 'stadium');
      put(2, 3, 'دانشگاه تهران', 'campus');
      put(3, 4, 'بازار بزرگ تهران', 'bazaar');
      put(1, 0, 'بام تهران', 'hill');
      put(4, 1, 'پارک طالقانی', 'park');
      put(0, 4, 'فرودگاه مهرآباد', 'airport');
      put(4, 0, 'پارک ملت', 'park');
      put(5, 2, 'پل طبیعت', 'bridge');
      put(2, 1, 'برج‌های ونک', 'towers');
      put(5, 4, 'بیمارستان امام', 'hospital');
    },

    /* ---------- پمپ بنزین، تعمیرگاه، نمایشگاه ---------- */
    buildPOIs() {
      const PW = 150, PH = 118, half = ROAD_W / 2;
      // dx: 'r' یعنی چسبیده به سمت راست خیابان عمودی، 'l' یعنی سمت چپ آن
      const mk = (type, name, i, j, side, dy) => {
        const x = VROADS[i] + (side === 'r' ? half : -(half + PW));
        const y = HROADS[j] + dy;
        this.pois.push({ type, name, x, y, w: PW, h: PH, cx: x + PW / 2, cy: y + PH / 2 });
      };
      mk('fuel', 'پمپ بنزین صادقیه', 0, 1, 'r', 70);
      mk('fuel', 'پمپ بنزین ونک', 3, 2, 'l', -200);
      mk('fuel', 'پمپ بنزین شوش', 4, 5, 'r', -200);
      mk('fuel', 'پمپ بنزین تجریش', 5, 0, 'l', 70);
      mk('repair', 'تعمیرگاه حاج رضا', 2, 2, 'r', 70);
      mk('repair', 'تعمیرگاه اتوسرویس نوین', 5, 4, 'l', 70);
      mk('garage', 'نمایشگاه اتومبیل پارس', 3, 3, 'r', 70);
      this.pois.forEach(p => { p.rect = { x: p.x, y: p.y, w: p.w, h: p.h }; });
      // ساختمان‌هایی که زیر این محوطه‌ها می‌افتند حذف می‌شوند
      this.buildings = this.buildings.filter(b =>
        !this.pois.some(p => U.rectsOverlap(p.rect, b)));
    },

    /* ---------- مقصدها و مبدأهای مسافر ---------- */
    buildPlaces() {
      const P = (name, i, j, dx, dy) => ({
        name, i, j, x: VROADS[i] + (dx || 0), y: HROADS[j] + (dy || 0)
      });
      this.places = [
        P('میدان تجریش', 5, 0, -140, 0),
        P('بام تهران', 1, 0, 0, 120),
        P('پارک ملت', 4, 0, 130, 0),
        P('میدان ونک', 3, 1, 0, 140),
        P('فلکه صادقیه', 0, 1, 140, 0),
        P('برج‌های ونک', 2, 1, 0, -130),
        P('برج میلاد', 1, 2, 150, 0),
        P('میدان ولیعصر', 3, 2, 0, -140),
        P('میدان هفت تیر', 4, 2, -150, 0),
        P('پل طبیعت', 5, 2, 0, 150),
        P('میدان انقلاب', 2, 3, 140, 0),
        P('دانشگاه تهران', 3, 3, -140, 0),
        P('میدان آزادی', 0, 3, 0, -150),
        P('میدان امام حسین', 5, 3, 0, 140),
        P('ورزشگاه آزادی', 0, 4, 0, -190),
        P('فرودگاه مهرآباد', 1, 4, -140, 0),
        P('بیمارستان امام', 5, 4, -140, 0),
        P('بازار بزرگ', 3, 4, 140, 0),
        P('میدان راه‌آهن', 2, 5, 130, 0),
        P('میدان خراسان', 4, 4, 0, 140),
        P('ترمینال جنوب', 4, 5, -140, 0),
        P('خیابان ولیعصر', 3, 2, 0, 300),
        P('بزرگراه چمران', 2, 2, 0, -260),
        P('خیابان انقلاب', 3, 3, 260, 0)
      ];
    },

    /* ---------- تشخیص خیابان ---------- */
    isRoad(x, y) {
      const half = ROAD_W / 2;
      for (let i = 0; i < VROADS.length; i++) if (Math.abs(x - VROADS[i]) <= half) return true;
      for (let j = 0; j < HROADS.length; j++) if (Math.abs(y - HROADS[j]) <= half) return true;
      for (let s = 0; s < this.squares.length; s++) {
        const sq = this.squares[s];
        if (U.dist2(x, y, sq.x, sq.y) < sq.r * sq.r) return true;
      }
      for (let p = 0; p < this.pois.length; p++) if (U.inRect(x, y, this.pois[p].rect)) return true;
      return false;
    },

    poiAt(x, y) {
      for (let p = 0; p < this.pois.length; p++) if (U.inRect(x, y, this.pois[p].rect)) return this.pois[p];
      return null;
    },

    /* ---------- گراف تقاطع‌ها ---------- */
    nodePos(i, j) { return { x: VROADS[i], y: HROADS[j] }; },

    nearestNode(x, y) {
      let bi = 0, bj = 0, bd = Infinity;
      for (let i = 0; i < VROADS.length; i++) {
        for (let j = 0; j < HROADS.length; j++) {
          const d = U.dist2(x, y, VROADS[i], HROADS[j]);
          if (d < bd) { bd = d; bi = i; bj = j; }
        }
      }
      return { i: bi, j: bj };
    },

    segKey(i1, j1, i2, j2) {
      const a = i1 * 100 + j1, b = i2 * 100 + j2;
      return a < b ? a + '-' + b : b + '-' + a;
    },

    jamOf(i1, j1, i2, j2) { return this.jams[this.segKey(i1, j1, i2, j2)] || 0; },

    resetJams() {
      this.jams = {};
      this.shuffleJams(0.22);
    },

    shuffleJams(density) {
      const keys = [];
      for (let i = 0; i < VROADS.length; i++) {
        for (let j = 0; j < HROADS.length; j++) {
          if (i + 1 < VROADS.length) keys.push([i, j, i + 1, j]);
          if (j + 1 < HROADS.length) keys.push([i, j, i, j + 1]);
        }
      }
      this.jams = {};
      keys.forEach(k => {
        if (Math.random() < density) this.jams[this.segKey(k[0], k[1], k[2], k[3])] = U.rnd(0.45, 1);
      });
    },

    /* شدت ترافیک در نقطه‌ای از شهر (برای کند کردن ترافیک و رنگ نقشه) */
    jamAt(x, y) {
      const half = ROAD_W / 2 + 10;
      // خیابان عمودی؟
      for (let i = 0; i < VROADS.length; i++) {
        if (Math.abs(x - VROADS[i]) <= half) {
          for (let j = 0; j + 1 < HROADS.length; j++) {
            if (y >= HROADS[j] && y <= HROADS[j + 1]) return this.jamOf(i, j, i, j + 1);
          }
        }
      }
      for (let j = 0; j < HROADS.length; j++) {
        if (Math.abs(y - HROADS[j]) <= half) {
          for (let i = 0; i + 1 < VROADS.length; i++) {
            if (x >= VROADS[i] && x <= VROADS[i + 1]) return this.jamOf(i, j, i + 1, j);
          }
        }
      }
      return 0;
    },

    /* مسیریابی دایکسترا روی تقاطع‌ها */
    route(from, to) {
      const ni = VROADS.length, nj = HROADS.length;
      const start = this.nearestNode(from.x, from.y);
      const goal = this.nearestNode(to.x, to.y);
      const idx = (i, j) => i * nj + j;
      const distArr = new Array(ni * nj).fill(Infinity);
      const prev = new Array(ni * nj).fill(-1);
      const done = new Array(ni * nj).fill(false);
      distArr[idx(start.i, start.j)] = 0;

      for (let iter = 0; iter < ni * nj; iter++) {
        let best = -1, bd = Infinity;
        for (let k = 0; k < ni * nj; k++) if (!done[k] && distArr[k] < bd) { bd = distArr[k]; best = k; }
        if (best < 0) break;
        done[best] = true;
        const ci = Math.floor(best / nj), cj = best % nj;
        if (ci === goal.i && cj === goal.j) break;
        const neigh = [[ci + 1, cj], [ci - 1, cj], [ci, cj + 1], [ci, cj - 1]];
        for (const n of neigh) {
          const [xi, xj] = n;
          if (xi < 0 || xj < 0 || xi >= ni || xj >= nj) continue;
          const a = this.nodePos(ci, cj), b = this.nodePos(xi, xj);
          const cost = U.dist(a.x, a.y, b.x, b.y) * (1 + this.jamOf(ci, cj, xi, xj) * 1.8);
          const k = idx(xi, xj);
          if (distArr[best] + cost < distArr[k]) { distArr[k] = distArr[best] + cost; prev[k] = best; }
        }
      }

      const path = [];
      let cur = idx(goal.i, goal.j);
      if (distArr[cur] === Infinity) return [{ x: to.x, y: to.y }];
      while (cur !== -1) {
        const ci = Math.floor(cur / nj), cj = cur % nj;
        path.unshift(this.nodePos(ci, cj));
        if (cur === idx(start.i, start.j)) break;
        cur = prev[cur];
      }
      path.push({ x: to.x, y: to.y });
      return path;
    },

    routeLength(path) {
      let d = 0;
      for (let i = 1; i < path.length; i++) d += U.dist(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y);
      return d;
    },

    /* دو مکان دور از هم برای یک سفر */
    pickTrip(nearX, nearY) {
      const sorted = this.places.slice().sort((a, b) =>
        U.dist2(a.x, a.y, nearX, nearY) - U.dist2(b.x, b.y, nearX, nearY));
      const pool = sorted.slice(0, 8);
      const from = U.choice(pool);
      let to = U.choice(this.places);
      let guard = 0;
      while ((to === from || U.dist(from.x, from.y, to.x, to.y) < 900) && guard++ < 40) {
        to = U.choice(this.places);
      }
      return { from, to };
    }
  };

  global.City = City;
})(window);
