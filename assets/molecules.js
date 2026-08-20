/**
 * Ambient water-molecule background engine.
 * Shared by index.html / archive.html / post.html.
 *
 * Fixes applied vs. the old inline version:
 *  - No more "stuck hexagon" on mobile: the ligand marker + hydrophobic
 *    repulsion only ever run on real mouse pointers (hover-capable,
 *    fine pointer). Touch devices never get a marker frozen on screen
 *    after a tap, because touch never drives it in the first place.
 *  - Lower, screen-aware molecule density so phones stay smooth; a
 *    hard cap keeps ultra-wide monitors sane too.
 *  - Animation pauses when the tab is hidden and respects
 *    prefers-reduced-motion.
 *  - Canvas renders at devicePixelRatio (capped at 2) for a crisp
 *    line on retina/mobile screens without over-spending on 3x+ panels.
 */
(function () {
  const canvas = document.getElementById('cadd-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let width = 0, height = 0, dpr = 1;
  let molecules = [];
  let mouse = { x: -1000, y: -1000 };
  let moleculesActive = true;
  let rafId = null;

  function densityFor(w, h) {
    let divisor = 15000;
    if (w < 480) divisor = 26000;
    else if (w < 768) divisor = 20000;
    const count = Math.floor((w * h) / divisor);
    return Math.min(count, 85);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initMolecules();
  }

  class WaterMolecule {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.6;
      this.vy = (Math.random() - 0.5) * 0.6;
      this.radius = 3.2;
      this.angle = Math.random() * Math.PI * 2;
    }
    update() {
      if (isFinePointer) {
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hydrophobicZone = 90;
        if (dist < hydrophobicZone) {
          const force = (hydrophobicZone - dist) / hydrophobicZone;
          const angle = Math.atan2(dy, dx);
          this.x += Math.cos(angle) * force * 4;
          this.y += Math.sin(angle) * force * 4;
        }
      }
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0) this.x = width;
      if (this.x > width) this.x = 0;
      if (this.y < 0) this.y = height;
      if (this.y > height) this.y = 0;
    }
    draw(isDark) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? 'rgba(239, 68, 68, 0.30)' : 'rgba(220, 38, 38, 0.45)';
      ctx.fill();

      const h1x = this.x + Math.cos(this.angle) * 6;
      const h1y = this.y + Math.sin(this.angle) * 6;
      const h2x = this.x + Math.cos(this.angle + 1.8) * 6;
      const h2y = this.y + Math.sin(this.angle + 1.8) * 6;
      ctx.beginPath();
      ctx.arc(h1x, h1y, 1.6, 0, Math.PI * 2);
      ctx.arc(h2x, h2y, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? 'rgba(248, 250, 252, 0.42)' : 'rgba(51, 65, 85, 0.55)';
      ctx.fill();
    }
  }

  function initMolecules() {
    molecules = [];
    const count = densityFor(width, height);
    for (let i = 0; i < count; i++) molecules.push(new WaterMolecule());
  }

  function drawMicroLigand(x, y, isDark) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = isDark ? 'rgba(16, 185, 129, 0.85)' : 'rgba(5, 150, 105, 0.85)';
    ctx.fillStyle = isDark ? 'rgba(16, 185, 129, 0.9)' : 'rgba(5, 150, 105, 0.9)';
    ctx.lineWidth = 1.6;
    const r = 8;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const px = r * Math.cos(a);
      const py = r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function frame() {
    ctx.clearRect(0, 0, width, height);
    const isDark = document.documentElement.classList.contains('dark');

    if (moleculesActive) {
      for (let i = 0; i < molecules.length; i++) {
        molecules[i].update();
        molecules[i].draw(isDark);
        for (let j = i + 1; j < molecules.length; j++) {
          const dx = molecules[i].x - molecules[j].x;
          const dy = molecules[i].y - molecules[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 58) {
            const distToMouse = isFinePointer
              ? Math.hypot(molecules[i].x - mouse.x, molecules[i].y - mouse.y)
              : Infinity;
            const alpha = (1 - dist / 58) * (distToMouse < 110 ? 0.65 : (isDark ? 0.16 : 0.32));
            ctx.beginPath();
            ctx.moveTo(molecules[i].x, molecules[i].y);
            ctx.lineTo(molecules[j].x, molecules[j].y);
            ctx.strokeStyle = isDark ? `rgba(16, 185, 129, ${alpha})` : `rgba(13, 148, 136, ${alpha})`;
            ctx.setLineDash([2, 3]);
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }
      if (isFinePointer && mouse.x > 0 && mouse.y > 0) {
        drawMicroLigand(mouse.x, mouse.y, isDark);
      }
    }
    if (!prefersReducedMotion) rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (rafId) cancelAnimationFrame(rafId);
    if (prefersReducedMotion) {
      frame();
      return;
    }
    rafId = requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);

  if (isFinePointer) {
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }, { passive: true });
    window.addEventListener('mouseleave', () => { mouse.x = -1000; mouse.y = -1000; });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else {
      start();
    }
  });

  window.toggleMolecules = function toggleMolecules() {
    moleculesActive = !moleculesActive;
    const btn = document.getElementById('mol-toggle-btn');
    const textEl = document.getElementById('mol-toggle-text');
    const isPersian = typeof window.isPersian === 'boolean' ? window.isPersian : (localStorage.getItem('lang') === 'fa');
    if (!btn || !textEl) return;
    if (moleculesActive) {
      textEl.innerText = isPersian ? 'مولکول‌ها روشن' : 'Molecules On';
      btn.classList.remove('mol-off');
    } else {
      ctx.clearRect(0, 0, width, height);
      textEl.innerText = isPersian ? 'مولکول‌ها خاموش' : 'Molecules Off';
      btn.classList.add('mol-off');
    }
  };

  resize();
  start();
})();
