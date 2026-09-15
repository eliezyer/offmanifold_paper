const revealEls = document.querySelectorAll(".reveal");
const nav = document.querySelector("[data-nav]");
const progress = document.querySelector(".progress span");
const hero = document.querySelector(".hero");
const ambientCanvas = document.querySelector("[data-ambient-canvas]");
const manifoldCanvas = document.querySelector("[data-manifold-canvas]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const ON = [209, 58, 183];
const OFF = [35, 174, 231];
const SPIKE_LOCATIONS = [
  [0.18, 0.42, 0.88],
  [0.31, 0.28, 1.08],
  [0.43, 0.67, 1.22],
  [0.56, 0.34, 0.82],
  [0.69, 0.58, 1.34],
  [0.8, 0.39, 1.02],
];
let scrollProgress = 0;
let animationFrame = null;
const pointerState = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  strength: 0,
  targetStrength: 0,
};
const spikeStates = SPIKE_LOCATIONS.map((_, index) => ({
  activity: index === 2 ? 0.72 : 0,
  target: 0,
  nextEvent: 700 + index * 520 + Math.random() * 900,
}));

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (start, end, amount) => start + (end - start) * amount;
const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const mixColor = (start, end, amount) => start.map((channel, index) => Math.round(lerp(channel, end[index], amount)));
const rgba = (color, alpha) => `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
const randomBetween = (min, max) => min + Math.random() * (max - min);

const updateSpikeEvents = (time) => {
  if (reducedMotion.matches) return;

  spikeStates.forEach((state) => {
    const response = state.target > state.activity ? 0.035 : 0.018;
    state.activity = lerp(state.activity, state.target, response);

    if (time < state.nextEvent) return;

    if (state.target > 0) {
      state.target = 0;
      state.nextEvent = time + randomBetween(1800, 5200);
      return;
    }

    const activeCount = spikeStates.filter((candidate) => candidate.target > 0 || candidate.activity > 0.22).length;
    if (activeCount < 2) {
      state.target = randomBetween(0.72, 1);
      state.nextEvent = time + randomBetween(1800, 3200);
    } else {
      state.nextEvent = time + randomBetween(700, 1500);
    }
  });
};

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
  );

  revealEls.forEach((el) => revealObserver.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("is-visible"));
}

const fitCanvas = (canvas) => {
  if (!canvas) return null;

  const rect = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * pixelRatio));
  const height = Math.max(1, Math.round(rect.height * pixelRatio));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return { context, width: rect.width, height: rect.height };
};

const makeBlobPath = (context, points) => {
  const firstMidpoint = {
    x: (points[0].x + points[points.length - 1].x) / 2,
    y: (points[0].y + points[points.length - 1].y) / 2,
  };

  context.beginPath();
  context.moveTo(firstMidpoint.x, firstMidpoint.y);
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    context.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
  });
  context.closePath();
};

const drawAmbient = (time) => {
  const fitted = fitCanvas(ambientCanvas);
  if (!fitted) return;

  const { context, width, height } = fitted;
  const seconds = time * 0.001;
  const colorShift = smoothstep(0.08, 0.92, scrollProgress);
  const color = mixColor(ON, OFF, colorShift);
  const centerX = width * (lerp(0.28, 0.72, scrollProgress) + Math.sin(seconds * 0.075) * 0.035);
  const centerY = height * (0.48 + Math.cos(seconds * 0.061) * 0.055);
  const radiusX = Math.max(width * 0.43, height * 0.47);
  const radiusY = Math.max(height * 0.37, width * 0.25);
  const pointCount = 18;
  const points = [];

  context.clearRect(0, 0, width, height);

  for (let index = 0; index < pointCount; index += 1) {
    const angle = (index / pointCount) * Math.PI * 2;
    const drift = 1 + Math.sin(angle * 3 + seconds * 0.09) * 0.055 + Math.cos(angle * 5 - seconds * 0.045) * 0.03;
    points.push({
      x: centerX + Math.cos(angle) * radiusX * drift,
      y: centerY + Math.sin(angle) * radiusY * drift,
    });
  }

  context.save();
  makeBlobPath(context, points);
  const glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(radiusX, radiusY));
  glow.addColorStop(0, rgba(color, 0.09));
  glow.addColorStop(0.48, rgba(color, 0.045));
  glow.addColorStop(1, rgba(color, 0));
  context.fillStyle = glow;
  context.fill();
  context.clip();

  context.lineWidth = 0.7;
  context.strokeStyle = rgba(color, 0.075);
  for (let index = -5; index <= 5; index += 1) {
    const yBase = centerY + index * (radiusY / 5.5);
    context.beginPath();
    for (let segment = 0; segment <= 24; segment += 1) {
      const amount = segment / 24;
      const x = centerX - radiusX + amount * radiusX * 2;
      const y = yBase + Math.sin(amount * Math.PI * 2 + seconds * 0.08 + index) * 18;
      if (segment === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }

  context.strokeStyle = rgba(color, 0.052);
  for (let index = -4; index <= 4; index += 1) {
    const xBase = centerX + index * (radiusX / 4.5);
    context.beginPath();
    for (let segment = 0; segment <= 20; segment += 1) {
      const amount = segment / 20;
      const y = centerY - radiusY + amount * radiusY * 2;
      const x = xBase + Math.cos(amount * Math.PI * 2 - seconds * 0.07 + index) * 15;
      if (segment === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
  context.restore();

  makeBlobPath(context, points);
  context.lineWidth = 1;
  context.strokeStyle = rgba(color, 0.12);
  context.stroke();
};

const rotatePoint = (point, rotationX, rotationY, rotationZ) => {
  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);
  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);
  const cosZ = Math.cos(rotationZ);
  const sinZ = Math.sin(rotationZ);

  const y1 = point.y * cosX - point.z * sinX;
  const z1 = point.y * sinX + point.z * cosX;
  const x2 = point.x * cosY + z1 * sinY;
  const z2 = -point.x * sinY + z1 * cosY;

  return {
    x: x2 * cosZ - y1 * sinZ,
    y: x2 * sinZ + y1 * cosZ,
    z: z2,
  };
};

const drawManifold = (time) => {
  const fitted = fitCanvas(manifoldCanvas);
  if (!fitted) return;

  const { context, width, height } = fitted;
  const seconds = time * 0.001;
  const columns = width < 480 ? 18 : 24;
  const rows = width < 480 ? 12 : 16;
  const scale = Math.min(width * 0.42, height * 0.36);
  const points = [];
  const triangles = [];

  context.clearRect(0, 0, width, height);

  for (let row = 0; row < rows; row += 1) {
    const v = lerp(-1, 1, row / (rows - 1));
    const pointRow = [];

    for (let column = 0; column < columns; column += 1) {
      const u = lerp(-1, 1, column / (columns - 1));
      const edge = u * u + Math.pow(v * 1.08, 2);
      const isVisible = edge < 1.08 + Math.sin(u * 4 + seconds * 0.16) * 0.025;
      const hoverDistance = Math.pow(u - pointerState.x * 0.85, 2) + Math.pow(v - pointerState.y * 0.72, 2);
      const hoverLift = Math.exp(-hoverDistance * 4.2) * 0.14 * pointerState.strength;
      const surface = {
        x: u * 1.32,
        y: v * 0.82 + Math.sin(u * 2.3 + seconds * 0.22) * 0.055,
        z:
          Math.sin(u * 2.6 + seconds * 0.28) * Math.cos(v * 2.2 - seconds * 0.12) * 0.22 +
          Math.sin((u + v) * 3.5 - seconds * 0.18) * 0.055 +
          hoverLift,
      };
      const rotated = rotatePoint(
        surface,
        0.91 - pointerState.y * 0.08,
        -0.18 + Math.sin(seconds * 0.08) * 0.045 + pointerState.x * 0.13,
        -0.13 + pointerState.x * 0.025
      );
      const perspective = 1 / (1.12 - rotated.z * 0.12);

      pointRow.push({
        x: width * 0.5 + rotated.x * scale * perspective,
        y: height * 0.51 + rotated.y * scale * perspective,
        z: rotated.z,
        visible: isVisible,
        row,
        column,
      });
    }
    points.push(pointRow);
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = points[row][column];
      const b = points[row][column + 1];
      const c = points[row + 1][column];
      const d = points[row + 1][column + 1];

      if (a.visible && b.visible && c.visible) triangles.push([a, b, c]);
      if (b.visible && c.visible && d.visible) triangles.push([b, d, c]);
    }
  }

  triangles.sort((left, right) => {
    const leftDepth = left.reduce((sum, point) => sum + point.z, 0);
    const rightDepth = right.reduce((sum, point) => sum + point.z, 0);
    return leftDepth - rightDepth;
  });

  triangles.forEach((triangle) => {
    const depth = clamp((triangle[0].z + triangle[1].z + triangle[2].z) / 1.4 + 0.5, 0, 1);
    context.beginPath();
    context.moveTo(triangle[0].x, triangle[0].y);
    context.lineTo(triangle[1].x, triangle[1].y);
    context.lineTo(triangle[2].x, triangle[2].y);
    context.closePath();
    context.fillStyle = rgba(ON, lerp(0.018, 0.07, depth));
    context.strokeStyle = rgba(ON, lerp(0.11, 0.32, depth));
    context.lineWidth = lerp(0.45, 0.9, depth);
    context.fill();
    context.stroke();
  });

  const pulseRow = Math.round(rows * 0.53);
  context.beginPath();
  let pulseStarted = false;
  points[pulseRow].forEach((point, index) => {
    if (!point.visible) return;
    const offset = Math.sin(index * 0.62 - seconds * 0.9) * 5;
    if (!pulseStarted) {
      context.moveTo(point.x, point.y + offset);
      pulseStarted = true;
    } else {
      context.lineTo(point.x, point.y + offset);
    }
  });
  context.strokeStyle = rgba(ON, 0.62);
  context.lineWidth = 1.5;
  context.shadowColor = rgba(ON, 0.35);
  context.shadowBlur = 9;
  context.stroke();
  context.shadowBlur = 0;

  SPIKE_LOCATIONS.forEach(([columnAmount, rowAmount, strength], index) => {
    const activity = clamp(spikeStates[index].activity, 0, 1);
    const column = clamp(Math.round(columnAmount * (columns - 1)), 1, columns - 2);
    const row = clamp(Math.round(rowAmount * (rows - 1)), 1, rows - 2);
    const base = points[row][column];
    if (!base.visible) return;

    const direction = -Math.PI / 2 + (columnAmount - 0.5) * 0.78;
    const length = scale * 0.3 * strength * (0.66 + activity * 0.34);
    const tip = {
      x: base.x + Math.cos(direction) * length,
      y: base.y + Math.sin(direction) * length,
    };
    const side = points[row][clamp(column + (index % 2 ? 1 : -1), 0, columns - 1)];

    context.beginPath();
    context.arc(base.x, base.y, 1.5 + activity * 5, 0, Math.PI * 2);
    context.strokeStyle = rgba(OFF, 0.08 + activity * 0.4);
    context.lineWidth = 0.8;
    context.stroke();

    if (activity > 0.015) {
      context.beginPath();
      context.moveTo(base.x, base.y);
      context.lineTo(tip.x, tip.y);
      context.lineTo(side.x, side.y);
      context.closePath();
      const shard = context.createLinearGradient(base.x, base.y, tip.x, tip.y);
      shard.addColorStop(0, rgba(OFF, 0.01 * activity));
      shard.addColorStop(1, rgba(OFF, 0.23 * activity));
      context.fillStyle = shard;
      context.fill();

      const spike = context.createLinearGradient(base.x, base.y, tip.x, tip.y);
      spike.addColorStop(0, rgba(OFF, 0.08 * activity));
      spike.addColorStop(0.7, rgba(OFF, 0.62 * activity));
      spike.addColorStop(1, rgba(OFF, 0.82 * activity));
      context.beginPath();
      context.moveTo(base.x, base.y);
      context.lineTo(tip.x, tip.y);
      context.strokeStyle = spike;
      context.lineWidth = (width < 480 ? 1 : 1.2) + activity * 0.65;
      context.shadowColor = rgba(OFF, 0.38 * activity);
      context.shadowBlur = 6 * activity;
      context.stroke();
      context.shadowBlur = 0;

      context.beginPath();
      context.arc(tip.x, tip.y, (width < 480 ? 0.9 : 1.1) + activity * 0.55, 0, Math.PI * 2);
      context.fillStyle = rgba(OFF, 0.22 + activity * 0.5);
      context.fill();
    }
  });

  points.flat().forEach((point, index) => {
    if (!point.visible || index % 9 !== 0) return;
    context.beginPath();
    context.arc(point.x, point.y, 1.2, 0, Math.PI * 2);
    context.fillStyle = rgba(ON, 0.58);
    context.fill();
  });
};

const render = (time = 0) => {
  pointerState.x = lerp(pointerState.x, pointerState.targetX, 0.075);
  pointerState.y = lerp(pointerState.y, pointerState.targetY, 0.075);
  pointerState.strength = lerp(pointerState.strength, pointerState.targetStrength, 0.065);
  updateSpikeEvents(time);
  drawAmbient(time);
  drawManifold(time);

  if (!reducedMotion.matches) {
    animationFrame = window.requestAnimationFrame(render);
  }
};

const restartAnimation = () => {
  if (animationFrame) window.cancelAnimationFrame(animationFrame);
  animationFrame = null;
  render(performance.now());
};

const updateChrome = () => {
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  const doc = document.documentElement;
  const scrollable = doc.scrollHeight - window.innerHeight;
  scrollProgress = scrollable > 0 ? clamp(scrollY / scrollable, 0, 1) : 0;

  if (progress) {
    progress.style.width = `${scrollProgress * 100}%`;
    const endTransition = smoothstep(0.9, 0.985, scrollProgress);
    const progressColor = mixColor(ON, OFF, endTransition);
    progress.style.setProperty("--progress-color", `rgb(${progressColor.join(", ")})`);
  }

  if (nav && hero) {
    nav.classList.toggle("is-visible", scrollY > hero.offsetHeight * 0.72);
  }

  if (reducedMotion.matches) drawAmbient(0);
};

updateChrome();
restartAnimation();
window.addEventListener("scroll", updateChrome, { passive: true });
window.addEventListener("resize", restartAnimation);
reducedMotion.addEventListener("change", restartAnimation);

if (manifoldCanvas) {
  manifoldCanvas.addEventListener("pointerenter", () => {
    if (!reducedMotion.matches) pointerState.targetStrength = 1;
  });

  manifoldCanvas.addEventListener("pointermove", (event) => {
    if (reducedMotion.matches) return;
    const rect = manifoldCanvas.getBoundingClientRect();
    pointerState.targetX = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    pointerState.targetY = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
  });

  manifoldCanvas.addEventListener("pointerleave", () => {
    pointerState.targetX = 0;
    pointerState.targetY = 0;
    pointerState.targetStrength = 0;
  });
}
