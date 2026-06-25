(function () {
  const BLOCK = 10;
  // Exponential decay factor per frame (~60 fps → ~1.5 s to fade out)
  const DECAY = 0.98;

  // Radius in blocks (1 = 3×3, 2 = 5×5, 3 = 7×7, …)
  const KERNEL_RADIUS = 25;

  // Build a Gaussian kernel of size (2*r+1)² normalised so the centre = 1.0
  const KERNEL = (function buildKernel(r) {
    const sigma = r / 2;
    const k = [];
    for (let dr = -r; dr <= r; dr++) {
      const row = [];
      for (let dc = -r; dc <= r; dc++) {
        row.push(Math.exp(-(dc * dc + dr * dr) / (2 * sigma * sigma)));
      }
      k.push(row);
    }
    return k;
  })(KERNEL_RADIUS);

  /* ── Canvas setup ───────────────────────────────────────────── */
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    zIndex: '-1',
    pointerEvents: 'none',
    display: 'block',
  });
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');

  let cols = 0;
  let rows = 0;
  let gridSnapshot = null; // pre-rendered static grid

  // Active blocks: Map<"col,row", intensity 0–1>
  const active = new Map();

  /* ── Pre-render the static black grid ──────────────────────── */
  function buildGrid() {
    cols = Math.ceil(canvas.width  / BLOCK);
    rows = Math.ceil(canvas.height / BLOCK);

    const off = document.createElement('canvas');
    off.width  = canvas.width;
    off.height = canvas.height;
    const octx = off.getContext('2d');

    octx.fillStyle = '#000';
    octx.fillRect(0, 0, off.width, off.height);

    // Subtle grid lines so blocks are barely visible at rest
    octx.strokeStyle = 'rgba(30,30,30,1)';
    octx.lineWidth = 0.5;
    for (let c = 0; c <= cols; c++) {
      octx.beginPath();
      octx.moveTo(c * BLOCK, 0);
      octx.lineTo(c * BLOCK, off.height);
      octx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      octx.beginPath();
      octx.moveTo(0, r * BLOCK);
      octx.lineTo(off.width, r * BLOCK);
      octx.stroke();
    }

    gridSnapshot = off;
  }

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    buildGrid();
    active.clear();
  }

  window.addEventListener('resize', resize);
  resize();

  /* ── Mouse interaction ──────────────────────────────────────── */
  document.addEventListener('mousemove', (e) => {
    const col = Math.floor(e.clientX / BLOCK);
    const row = Math.floor(e.clientY / BLOCK);

    for (let dr = -KERNEL_RADIUS; dr <= KERNEL_RADIUS; dr++) {
      for (let dc = -KERNEL_RADIUS; dc <= KERNEL_RADIUS; dc++) {
        const c = col + dc;
        const r = row + dr;
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue;

        const weight = KERNEL[dr + KERNEL_RADIUS][dc + KERNEL_RADIUS];
        const key    = c + ',' + r;
        // Only raise intensity, never lower it (decay handles lowering)
        if ((active.get(key) ?? 0) < weight) active.set(key, weight);
      }
    }
  });

  /* ── Render loop ────────────────────────────────────────────── */
  function draw() {
    // Blit the pre-rendered grid (black + subtle lines)
    ctx.drawImage(gridSnapshot, 0, 0);

    // Paint each active block and apply uranium-style exponential decay
    for (const [key, intensity] of active) {
      const comma = key.indexOf(',');
      const c = +key.slice(0, comma);
      const r = +key.slice(comma + 1);

      // Green channel scales linearly with intensity; add faint blue tint for
      // a more "radioactive" feel
      const g = Math.round(intensity * 110);
      const b = Math.round(intensity * 20);
      ctx.fillStyle = `rgb(0,${g},${b})`;
      // Leave 1 px on each side so grid lines stay visible through lit blocks
      ctx.fillRect(c * BLOCK + 1, r * BLOCK + 1, BLOCK - 1, BLOCK - 1);

      const next = intensity * DECAY;
      if (next < 0.004) {
        active.delete(key);
      } else {
        active.set(key, next);
      }
    }

    requestAnimationFrame(draw);
  }

  draw();
})();
