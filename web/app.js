const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const imagesDirInput = document.getElementById("imagesDir");
const labelsDirInput = document.getElementById("labelsDir");
const imagesDirList = document.getElementById("imagesDirList");
const labelsDirList = document.getElementById("labelsDirList");
const openModalBtn = document.getElementById("openModalBtn");
const confirmLoadBtn = document.getElementById("confirmLoadBtn");
const loadModal = document.getElementById("loadModal");
const osdEl = document.getElementById("osd");
const MAX_RECENTS = 10;
const MAX_UNDO = 50;

const KPT_COUNT = 17;
const KEYPOINT_NAMES = [
  "nose",
  "left eye",
  "right eye",
  "left ear",
  "right ear",
  "left shoulder",
  "right shoulder",
  "left elbow",
  "right elbow",
  "left wrist",
  "right wrist",
  "left hip",
  "right hip",
  "left knee",
  "right knee",
  "left ankle",
  "right ankle"
];
const SKELETON = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16]
];

const COLOR_SCHEMES = [
  {
    name: "Default",
    classColors: ["#e4572e", "#1d6fa3", "#57a639"],
    visColors: {
      0: "rgba(29, 28, 26, 0.25)",
      1: "#f4b73b",
      2: "#1d6fa3"
    },
    skeleton: {
      active: "rgba(29, 111, 163, 0.7)",
      inactive: "rgba(29, 111, 163, 0.45)"
    }
  },
  {
    name: "High Contrast",
    classColors: ["#f94144", "#f9c74f", "#43aa8b", "#577590"],
    visColors: {
      0: "rgba(20, 20, 20, 0.18)",
      1: "#f9844a",
      2: "#90be6d"
    },
    skeleton: {
      active: "rgba(249, 132, 74, 0.85)",
      inactive: "rgba(249, 132, 74, 0.55)"
    }
  },
  {
    name: "Bright",
    classColors: ["#00a7e1", "#f15bb5", "#00bbf9", "#fee440"],
    visColors: {
      0: "rgba(10, 10, 10, 0.2)",
      1: "#fee440",
      2: "#f15bb5"
    },
    skeleton: {
      active: "rgba(0, 167, 225, 0.8)",
      inactive: "rgba(0, 167, 225, 0.5)"
    }
  },
  {
    name: "All White",
    classColors: ["#ffffff"],
    visColors: {
      0: "rgba(255, 255, 255, 0.25)",
      1: "#ffffff",
      2: "#ffffff"
    },
    skeleton: {
      active: "rgba(255, 255, 255, 0.85)",
      inactive: "rgba(255, 255, 255, 0.55)"
    }
  },
  {
    name: "All Black",
    classColors: ["#111111"],
    visColors: {
      0: "rgba(0, 0, 0, 0.2)",
      1: "#111111",
      2: "#111111"
    },
    skeleton: {
      active: "rgba(0, 0, 0, 0.85)",
      inactive: "rgba(0, 0, 0, 0.55)"
    }
  },
  {
    name: "All Yellow",
    classColors: ["#ffd000"],
    visColors: {
      0: "rgba(255, 208, 0, 0.25)",
      1: "#ffd000",
      2: "#ffd000"
    },
    skeleton: {
      active: "rgba(255, 208, 0, 0.85)",
      inactive: "rgba(255, 208, 0, 0.55)"
    }
  }
];
const MIN_BBOX_PIXELS = 4;

const state = {
  imagesDir: "",
  labelsDir: "",
  images: [],
  index: 0,
  imageName: "",
  imageBitmap: null,
  imageWidth: 0,
  imageHeight: 0,
  annotations: [],
  baseAnnotations: [],
  selection: {
    objectIndex: -1,
    keypointIndex: -1,
    corner: null
  },
  lastClassId: 0,
  colorSchemeIndex: 0,
  lastMouse: {
    screenX: null,
    screenY: null
  },
  hover: {
    objectIndex: -1,
    keypointIndex: -1,
    screenX: 0,
    screenY: 0
  },
  view: {
    scale: 1,
    offsetX: 0,
    offsetY: 0
  },
  canvasSize: {
    width: 1,
    height: 1,
    dpr: 1
  },
  dragging: {
    mode: null,
    startX: 0,
    startY: 0,
    startWorldX: 0,
    startWorldY: 0,
    currentWorldX: 0,
    currentWorldY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    startCenter: null,
    startCorners: null,
    snapshotTaken: false
  },
  spaceDown: false,
  dirty: false,
  modifiedSinceLoad: false,
  undoStack: [],
  osdCache: "",
  statusText: "Idle"
};

const storageKey = {
  imagesDir: "goannotate.imagesDir",
  labelsDir: "goannotate.labelsDir",
  imagesRecent: "goannotate.imagesRecent",
  labelsRecent: "goannotate.labelsRecent"
};

function init() {
  imagesDirInput.value = localStorage.getItem(storageKey.imagesDir) || "";
  labelsDirInput.value = localStorage.getItem(storageKey.labelsDir) || "";
  refreshRecents();

  openModalBtn.addEventListener("click", () => {
    openModal();
  });

  confirmLoadBtn.addEventListener("click", () => {
    openProject();
  });

  imagesDirInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      openProject();
    }
  });

  labelsDirInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      openProject();
    }
  });

  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mouseleave", () => clearHover());
  window.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  loadModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target && target.dataset && target.dataset.close) {
      closeModal();
    }
  });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", () => {
    resizeCanvas();
  });

  resizeCanvas();
  openModal();
  requestAnimationFrame(render);
}

function openModal() {
  refreshRecents();
  loadModal.classList.remove("hidden");
  loadModal.setAttribute("aria-hidden", "false");
  imagesDirInput.focus();
}

function closeModal() {
  loadModal.classList.add("hidden");
  loadModal.setAttribute("aria-hidden", "true");
}

function refreshRecents() {
  updateDatalist(imagesDirList, getRecentList(storageKey.imagesRecent));
  updateDatalist(labelsDirList, getRecentList(storageKey.labelsRecent));
}

function getRecentList(key) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((item) => String(item)).filter((item) => item.trim());
  } catch (error) {
    return [];
  }
}

function setRecentList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function addRecentItem(key, value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return getRecentList(key);
  }
  const current = getRecentList(key).filter((item) => item !== trimmed);
  current.unshift(trimmed);
  if (current.length > MAX_RECENTS) {
    current.length = MAX_RECENTS;
  }
  setRecentList(key, current);
  return current;
}

function updateDatalist(listEl, values) {
  if (!listEl) {
    return;
  }
  listEl.innerHTML = "";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    listEl.appendChild(option);
  });
}

async function openProject() {
  const imagesDir = imagesDirInput.value.trim();
  const labelsDir = labelsDirInput.value.trim();
  if (!imagesDir || !labelsDir) {
    setStatus("Provide both image and label directories.");
    return;
  }
  if (state.dirty) {
    await saveLabels();
    if (state.dirty) {
      return;
    }
  }
  closeModal();

  state.imagesDir = imagesDir;
  state.labelsDir = labelsDir;
  localStorage.setItem(storageKey.imagesDir, imagesDir);
  localStorage.setItem(storageKey.labelsDir, labelsDir);
  updateDatalist(imagesDirList, addRecentItem(storageKey.imagesRecent, imagesDir));
  updateDatalist(labelsDirList, addRecentItem(storageKey.labelsRecent, labelsDir));

  setStatus("Loading image list...");
  try {
    const listUrl = `/api/list?imagesDir=${encodeURIComponent(imagesDir)}&labelsDir=${encodeURIComponent(labelsDir)}`;
    const response = await fetch(listUrl);
    if (!response.ok) {
      throw new Error("Unable to list images");
    }
    const data = await response.json();
    state.images = data.images || [];
    if (state.images.length === 0) {
      setStatus("No images found in the directory.");
      state.imageBitmap = null;
      state.imageName = "";
      state.annotations = [];
      state.baseAnnotations = [];
      state.undoStack = [];
      state.dirty = false;
      state.modifiedSinceLoad = false;
      return;
    }
    state.index = 0;
    await loadImage(state.index);
  } catch (error) {
    setStatus(`Error: ${error.message}`);
  }
}

async function loadImage(index) {
  if (index < 0 || index >= state.images.length) {
    return;
  }
  const entry = state.images[index];
  state.index = index;
  state.imageName = entry.name;
  state.selection = { objectIndex: -1, keypointIndex: -1, corner: null };
  state.hover = { objectIndex: -1, keypointIndex: -1, screenX: 0, screenY: 0 };
  state.annotations = [];
  state.baseAnnotations = [];
  state.dirty = false;
  state.modifiedSinceLoad = false;
  state.undoStack = [];

  setStatus(`Loading ${entry.name}...`);

  try {
    const imageUrl = `/api/image?imagesDir=${encodeURIComponent(state.imagesDir)}&file=${encodeURIComponent(entry.name)}`;
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error("Unable to load image");
    }
    const blob = await imageResponse.blob();
    state.imageBitmap = await createImageBitmap(blob);
    state.imageWidth = state.imageBitmap.width;
    state.imageHeight = state.imageBitmap.height;

    const labelName = `${stripExt(entry.name)}.txt`;
    const labelUrl = `/api/labels?labelsDir=${encodeURIComponent(state.labelsDir)}&file=${encodeURIComponent(labelName)}`;
    const labelResponse = await fetch(labelUrl);
    let labelText = "";
    if (labelResponse.ok) {
      labelText = await labelResponse.text();
    }
    state.annotations = parseLabels(labelText);
    state.baseAnnotations = cloneAnnotations(state.annotations);
    fitImage();
    setStatus(`${entry.name} (${state.index + 1}/${state.images.length})`);
  } catch (error) {
    setStatus(`Error: ${error.message}`);
  }
}

function parseLabels(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const annotations = [];
  for (const line of lines) {
    const parts = line.split(/\s+/).map(Number);
    if (parts.length < 5 || Number.isNaN(parts[0])) {
      continue;
    }
    const classId = Math.max(0, Math.round(parts[0]));
    const bbox = {
      cx: clamp(parts[1] || 0, 0, 1),
      cy: clamp(parts[2] || 0, 0, 1),
      w: clamp(parts[3] || 0, 0, 1),
      h: clamp(parts[4] || 0, 0, 1)
    };
    const keypoints = [];
    let hasPose = false;
    if (parts.length >= 5 + 3) {
      hasPose = true;
    }
    for (let i = 0; i < KPT_COUNT; i += 1) {
      const base = 5 + i * 3;
      const x = clamp(parts[base] || 0, 0, 1);
      const y = clamp(parts[base + 1] || 0, 0, 1);
      const v = clampVisibility(parts[base + 2]);
      keypoints.push({ x, y, v });
    }
    annotations.push({ classId, bbox, keypoints, hasPose });
  }
  return annotations;
}

function createEmptyKeypoints() {
  const points = [];
  for (let i = 0; i < KPT_COUNT; i += 1) {
    points.push({ x: 0, y: 0, v: 0 });
  }
  return points;
}

function serializeLabels() {
  return state.annotations.map((ann) => {
    const items = [
      ann.classId,
      formatNum(ann.bbox.cx),
      formatNum(ann.bbox.cy),
      formatNum(ann.bbox.w),
      formatNum(ann.bbox.h)
    ];
    if (ann.hasPose) {
      for (const kp of ann.keypoints) {
        items.push(formatNum(kp.x), formatNum(kp.y), clampVisibility(kp.v));
      }
    }
    return items.join(" ");
  }).join("\n");
}

function formatNum(value) {
  return Number(value).toFixed(6);
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clampVisibility(value) {
  const num = Number.isFinite(value) ? Math.round(value) : 0;
  if (num <= 0) return 0;
  if (num === 1) return 1;
  return 2;
}

function stripExt(name) {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? name : name.slice(0, idx);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  state.canvasSize = { width: rect.width, height: rect.height, dpr };
  if (state.imageBitmap) {
    fitImage();
  }
}

function fitImage() {
  const margin = 0;
  const availW = Math.max(1, state.canvasSize.width - margin * 2);
  const availH = Math.max(1, state.canvasSize.height - margin * 2);
  const scaleX = availW / state.imageWidth;
  const scaleY = availH / state.imageHeight;
  state.view.scale = Math.min(scaleX, scaleY, 6);
  state.view.offsetX = (state.canvasSize.width - state.imageWidth * state.view.scale) / 2;
  state.view.offsetY = (state.canvasSize.height - state.imageHeight * state.view.scale) / 2;
}

function render() {
  const { dpr } = state.canvasSize;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state.imageBitmap) {
    const viewScale = state.view.scale;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, dpr * state.view.offsetX, dpr * state.view.offsetY);
    ctx.drawImage(state.imageBitmap, 0, 0);

    const visible = getVisibleIndices();
    for (const idx of visible) {
      const annotation = state.annotations[idx];
      if (!annotation) {
        continue;
      }
      drawAnnotation(annotation, idx === state.selection.objectIndex);
    }
    if (state.dragging.mode === "newBBox") {
      drawNewBBox();
    }
    drawObjectLabels(visible);
    drawHoverLabel();
  }

  updateOsd();
  requestAnimationFrame(render);
}

function drawAnnotation(annotation, isActive) {
  drawBBox(annotation, isActive);
  if (annotation.hasPose) {
    drawSkeleton(annotation, isActive);
    drawKeypoints(annotation, isActive);
  }
}

function drawBBox(annotation, isActive) {
  const scheme = getColorScheme();
  const color = scheme.classColors[annotation.classId % scheme.classColors.length] || "#e4572e";
  const { x, y, w, h } = bboxToPixels(annotation.bbox);
  ctx.strokeStyle = color;
  ctx.lineWidth = toWorldSize(isActive ? 2 : 1);
  ctx.strokeRect(x, y, w, h);

  if (isActive) {
    ctx.fillStyle = "rgba(29, 28, 26, 0.08)";
    ctx.fillRect(x, y, w, h);
    drawCorners(x, y, w, h);
  }
}

function drawCorners(x, y, w, h) {
  const size = toWorldSize(8);
  const corners = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h]
  ];
  ctx.fillStyle = "#1d1c1a";
  for (const [cx, cy] of corners) {
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
  }
}

function drawNewBBox() {
  const { startWorldX, startWorldY, currentWorldX, currentWorldY } = state.dragging;
  if (!Number.isFinite(startWorldX) || !Number.isFinite(startWorldY)) {
    return;
  }
  const endX = Number.isFinite(currentWorldX) ? currentWorldX : startWorldX;
  const endY = Number.isFinite(currentWorldY) ? currentWorldY : startWorldY;
  const x = Math.min(startWorldX, endX);
  const y = Math.min(startWorldY, endY);
  const w = Math.abs(endX - startWorldX);
  const h = Math.abs(endY - startWorldY);
  if (w < 1 || h < 1) {
    return;
  }
  const classId = Number.isFinite(state.lastClassId) ? state.lastClassId : 0;
  const color = CLASS_COLORS[classId % CLASS_COLORS.length] || "#e4572e";
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = toWorldSize(2);
  ctx.setLineDash([toWorldSize(6), toWorldSize(4)]);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawSkeleton(annotation, isActive) {
  const scheme = getColorScheme();
  ctx.strokeStyle = isActive ? scheme.skeleton.active : scheme.skeleton.inactive;
  ctx.lineWidth = toWorldSize(isActive ? 2 : 1);
  for (const [a, b] of SKELETON) {
    const kpA = annotation.keypoints[a];
    const kpB = annotation.keypoints[b];
    if (!kpA || !kpB || kpA.v === 0 || kpB.v === 0) {
      continue;
    }
    const p1 = keypointToPixels(kpA);
    const p2 = keypointToPixels(kpB);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
}

function drawKeypoints(annotation, isActive) {
  const baseRadius = 4;
  const scheme = getColorScheme();
  for (let i = 0; i < annotation.keypoints.length; i += 1) {
    const kp = annotation.keypoints[i];
    if (kp.v === 0) {
      continue;
    }
    const pos = keypointToPixels(kp);
    const isSelected = isActive && state.selection.keypointIndex === i;
    const radius = toWorldSize(isSelected ? 6 : baseRadius);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    const visColor = scheme.visColors[kp.v] || scheme.visColors[2];
    ctx.strokeStyle = visColor;
    ctx.lineWidth = toWorldSize(isSelected ? 2 : 1.5);
    ctx.stroke();
    if (isSelected) {
      ctx.strokeStyle = "#1d1c1a";
      ctx.lineWidth = toWorldSize(2.5);
      ctx.stroke();
    }
  }
}

function drawObjectLabels(indices) {
  const { dpr } = state.canvasSize;
  const scheme = getColorScheme();
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = "18px 'Space Grotesk', 'Trebuchet MS', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (const idx of indices) {
    const annotation = state.annotations[idx];
    if (!annotation) {
      continue;
    }
    const { x, y } = bboxToPixels(annotation.bbox);
    const screenPos = worldToScreen(x, y);
    const color = scheme.classColors[annotation.classId % scheme.classColors.length] || "#e4572e";
    ctx.fillStyle = color;
    ctx.fillText(`${annotation.classId}:${idx + 1}`, screenPos.x + 4, screenPos.y + 4);
  }
  ctx.restore();
}

function drawHoverLabel() {
  const { objectIndex, keypointIndex } = state.hover;
  if (objectIndex < 0 || keypointIndex < 0) {
    return;
  }
  const annotation = state.annotations[objectIndex];
  const kp = annotation ? annotation.keypoints[keypointIndex] : null;
  const visibility = kp ? clampVisibility(kp.v) : 0;
  const name = KEYPOINT_NAMES[keypointIndex] || `kp ${keypointIndex + 1}`;
  const label = `${name}:${visibility}`;
  const { dpr, width, height } = state.canvasSize;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = "12px 'Space Grotesk', 'Trebuchet MS', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const paddingX = 6;
  const paddingY = 3;
  const textWidth = ctx.measureText(label).width;
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = 18;
  let boxX = state.hover.screenX + 12;
  let boxY = state.hover.screenY - boxHeight - 8;
  if (boxX + boxWidth > width - 4) {
    boxX = state.hover.screenX - boxWidth - 12;
  }
  if (boxX < 4) {
    boxX = 4;
  }
  if (boxY < 4) {
    boxY = state.hover.screenY + 12;
  }
  if (boxY + boxHeight > height - 4) {
    boxY = Math.max(4, height - boxHeight - 4);
  }
  ctx.fillStyle = "rgba(29, 28, 26, 0.9)";
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  ctx.fillStyle = "#fef6e8";
  ctx.fillText(label, boxX + paddingX, boxY + paddingY);
  ctx.restore();
}

function updateOsd() {
  if (!osdEl) {
    return;
  }
  const fileLine = state.imageName ? `File: ${state.imageName}` : "File: -";
  const countLine = state.images.length
    ? `Index: ${state.index + 1}/${state.images.length}`
    : "Index: 0/0";
  const resLine = state.imageWidth && state.imageHeight
    ? `Resolution: ${state.imageWidth}x${state.imageHeight}`
    : "Resolution: -";
  const zoomLine = `Zoom: ${Math.round(state.view.scale * 100)}%`;
  const statusLine = `Status: ${state.statusText}`;
  const modLine = `Modified: ${state.modifiedSinceLoad ? "Yes" : "No"}`;
  const objectsLines = buildObjectLines();
  const selectedLines = buildSelectedLines();
  const lines = [fileLine, countLine, resLine, zoomLine, statusLine, modLine, ...objectsLines, ...selectedLines];
  const text = lines.join("\n");
  if (text !== state.osdCache) {
    osdEl.textContent = text;
    state.osdCache = text;
  }
}

function buildObjectLines() {
  const lines = [];
  const total = state.annotations.length;
  if (total === 0) {
    lines.push("Objects: 0");
    return lines;
  }
  const counts = new Map();
  for (const ann of state.annotations) {
    const key = Number.isFinite(ann.classId) ? ann.classId : 0;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  lines.push(`Objects: ${total}`);
  const ids = Array.from(counts.keys()).sort((a, b) => a - b);
  for (const id of ids) {
    lines.push(`  ${id}:${counts.get(id)}`);
  }
  return lines;
}

function buildSelectedLines() {
  const lines = [];
  const obj = state.annotations[state.selection.objectIndex];
  if (!obj) {
    return lines;
  }
  if (obj.hasPose) {
    const total = obj.keypoints.length;
    let visible = 0;
    for (const kp of obj.keypoints) {
      if (kp.v > 0) {
        visible += 1;
      }
    }
    lines.push(`Keypoints: ${visible}/${total}`);
  }
  const { w, h } = bboxToPixels(obj.bbox);
  lines.push(`Size: ${Math.round(w)}x${Math.round(h)}px`);
  return lines;
}

function bboxToPixels(bbox) {
  const x = (bbox.cx - bbox.w / 2) * state.imageWidth;
  const y = (bbox.cy - bbox.h / 2) * state.imageHeight;
  return {
    x,
    y,
    w: bbox.w * state.imageWidth,
    h: bbox.h * state.imageHeight
  };
}

function keypointToPixels(kp) {
  return {
    x: kp.x * state.imageWidth,
    y: kp.y * state.imageHeight
  };
}

function toWorldSize(sizePx) {
  const scale = Math.max(state.view.scale, 0.0001);
  return sizePx / scale;
}

function screenToWorld(screenX, screenY) {
  const { scale, offsetX, offsetY } = state.view;
  return {
    x: (screenX - offsetX) / scale,
    y: (screenY - offsetY) / scale
  };
}

function worldToScreen(worldX, worldY) {
  const { scale, offsetX, offsetY } = state.view;
  return {
    x: worldX * scale + offsetX,
    y: worldY * scale + offsetY
  };
}

function onMouseDown(event) {
  if (!state.imageBitmap) {
    return;
  }
  state.dragging.snapshotTaken = false;
  clearHover();
  const { screenX, screenY, worldX, worldY } = getMousePos(event);
  state.lastMouse.screenX = screenX;
  state.lastMouse.screenY = screenY;

  if (event.button === 2 || event.button === 1 || state.spaceDown) {
    state.dragging.mode = "pan";
    state.dragging.startX = screenX;
    state.dragging.startY = screenY;
    state.dragging.startOffsetX = state.view.offsetX;
    state.dragging.startOffsetY = state.view.offsetY;
    return;
  }

  if (event.button !== 0) {
    return;
  }

  if (event.ctrlKey) {
    if (state.selection.objectIndex < 0) {
      state.dragging.mode = "newBBox";
      state.dragging.startWorldX = worldX;
      state.dragging.startWorldY = worldY;
      state.dragging.currentWorldX = worldX;
      state.dragging.currentWorldY = worldY;
      return;
    }
    const addedIndex = addKeypointAt(state.selection.objectIndex, worldX, worldY);
    if (addedIndex >= 0) {
      state.dragging.mode = "keypoint";
      state.dragging.startWorldX = worldX;
      state.dragging.startWorldY = worldY;
      state.dragging.snapshotTaken = true;
    }
    return;
  }

  const keyPick = pickKeypoint(screenX, screenY);
  if (keyPick) {
    setSelection(keyPick.objectIndex, keyPick.keypointIndex, null);
    state.dragging.mode = "keypoint";
    state.dragging.startWorldX = worldX;
    state.dragging.startWorldY = worldY;
    return;
  }

  const cornerPick = pickCorner(screenX, screenY);
  if (cornerPick) {
    setSelection(cornerPick.objectIndex, -1, cornerPick.corner);
    state.dragging.mode = "bboxCorner";
    state.dragging.startCorners = cornerPick.corners;
    return;
  }

  const bboxPick = pickBBox(screenX, screenY);
  if (bboxPick) {
    setSelection(bboxPick.objectIndex, -1, null);
    state.dragging.mode = "bboxMove";
    const bbox = state.annotations[bboxPick.objectIndex].bbox;
    state.dragging.startCenter = { cx: bbox.cx, cy: bbox.cy };
    state.dragging.startWorldX = worldX;
    state.dragging.startWorldY = worldY;
    return;
  }

  clearSelection();
}

function onMouseMove(event) {
  if (!state.imageBitmap) {
    return;
  }
  const { screenX, screenY, worldX, worldY } = getMousePos(event);
  state.lastMouse.screenX = screenX;
  state.lastMouse.screenY = screenY;

  if (!state.dragging.mode) {
    updateHover(screenX, screenY);
    return;
  }

  clearHover();

  if (state.dragging.mode === "pan") {
    const dx = screenX - state.dragging.startX;
    const dy = screenY - state.dragging.startY;
    state.view.offsetX = state.dragging.startOffsetX + dx;
    state.view.offsetY = state.dragging.startOffsetY + dy;
    return;
  }

  if (state.dragging.mode === "newBBox") {
    state.dragging.currentWorldX = worldX;
    state.dragging.currentWorldY = worldY;
    return;
  }

  const annotation = state.annotations[state.selection.objectIndex];
  if (!annotation) {
    return;
  }

  if (state.dragging.mode === "keypoint") {
    const kp = annotation.keypoints[state.selection.keypointIndex];
    if (!kp) {
      return;
    }
    ensureUndoSnapshot();
    const nx = clamp(worldX / state.imageWidth, 0, 1);
    const ny = clamp(worldY / state.imageHeight, 0, 1);
    kp.x = nx;
    kp.y = ny;
    if (kp.v === 0) {
      kp.v = 2;
      annotation.hasPose = true;
    }
    markDirty();
  }

  if (state.dragging.mode === "bboxMove") {
    ensureUndoSnapshot();
    const dx = (worldX - state.dragging.startWorldX) / state.imageWidth;
    const dy = (worldY - state.dragging.startWorldY) / state.imageHeight;
    const bbox = annotation.bbox;
    bbox.cx = clamp(state.dragging.startCenter.cx + dx, bbox.w / 2, 1 - bbox.w / 2);
    bbox.cy = clamp(state.dragging.startCenter.cy + dy, bbox.h / 2, 1 - bbox.h / 2);
    markDirty();
  }

  if (state.dragging.mode === "bboxCorner") {
    ensureUndoSnapshot();
    const bbox = annotation.bbox;
    const corners = state.dragging.startCorners;
    const nx = clamp(worldX / state.imageWidth, 0, 1);
    const ny = clamp(worldY / state.imageHeight, 0, 1);
    const updated = updateCorners(corners, state.selection.corner, nx, ny);
    const minX = clamp(Math.min(updated.x1, updated.x2), 0, 1);
    const maxX = clamp(Math.max(updated.x1, updated.x2), 0, 1);
    const minY = clamp(Math.min(updated.y1, updated.y2), 0, 1);
    const maxY = clamp(Math.max(updated.y1, updated.y2), 0, 1);
    bbox.cx = (minX + maxX) / 2;
    bbox.cy = (minY + maxY) / 2;
    bbox.w = Math.max(0.0001, maxX - minX);
    bbox.h = Math.max(0.0001, maxY - minY);
    markDirty();
  }
}

function onMouseUp(event) {
  if (state.dragging.mode === "newBBox") {
    finishNewBBox(event);
    state.dragging.mode = null;
    return;
  }
  state.dragging.mode = null;
}

function onWheel(event) {
  if (!state.imageBitmap) {
    return;
  }
  event.preventDefault();
  const delta = Math.sign(event.deltaY);
  const zoomFactor = delta > 0 ? 0.9 : 1.1;
  const { screenX, screenY } = getMousePos(event);
  const worldBefore = screenToWorld(screenX, screenY);
  const nextScale = clamp(state.view.scale * zoomFactor, 0.1, 18);
  state.view.scale = nextScale;
  state.view.offsetX = screenX - worldBefore.x * nextScale;
  state.view.offsetY = screenY - worldBefore.y * nextScale;
}

function onKeyDown(event) {
  if (event.code === "Escape" && !loadModal.classList.contains("hidden")) {
    closeModal();
    return;
  }
  if (event.target && (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")) {
    return;
  }

  if (event.code === "Escape") {
    event.preventDefault();
    undo();
    return;
  }

  if (event.code === "KeyZ" && event.ctrlKey) {
    event.preventDefault();
    undo();
    return;
  }

  if (event.code === "Space") {
    state.spaceDown = true;
    event.preventDefault();
  }

  if (event.code === "KeyA") {
    event.preventDefault();
    changeImage(state.index - 1);
  }

  if (event.code === "KeyD") {
    event.preventDefault();
    changeImage(state.index + 1);
  }

  if (event.code === "KeyV") {
    cycleVisibility();
  }

  if (event.code === "KeyB") {
    event.preventDefault();
    cycleColorScheme();
  }

  if (event.code === "KeyC") {
    event.preventDefault();
    selectNextObject();
  }

  if (event.code === "KeyZ") {
    event.preventDefault();
    selectPrevObject();
  }

  if (event.code === "KeyX") {
    event.preventDefault();
    clearSelection();
  }

  if (event.code === "Delete") {
    deleteSelection();
  }

  if (isPlusKey(event)) {
    event.preventDefault();
    handlePlusMinus(1);
  }

  if (isMinusKey(event)) {
    event.preventDefault();
    handlePlusMinus(-1);
  }
}

function onKeyUp(event) {
  if (event.code === "Space") {
    state.spaceDown = false;
  }
}

function isPlusKey(event) {
  return event.key === "+" || event.code === "NumpadAdd";
}

function isMinusKey(event) {
  return event.key === "-" || event.code === "NumpadSubtract";
}

function handlePlusMinus(delta) {
  if (state.selection.objectIndex < 0) {
    return;
  }
  if (state.selection.keypointIndex >= 0) {
    changeSelectedKeypointName(delta);
    return;
  }
  changeSelectedClassId(delta);
}

function changeSelectedClassId(delta) {
  const annotation = state.annotations[state.selection.objectIndex];
  if (!annotation) {
    return;
  }
  const currentId = Number.isFinite(annotation.classId) ? Math.round(annotation.classId) : 0;
  const nextId = Math.max(0, currentId + delta);
  if (nextId === annotation.classId) {
    return;
  }
  pushUndo();
  annotation.classId = nextId;
  state.lastClassId = nextId;
  markDirty();
}

function changeSelectedKeypointName(delta) {
  const annotation = state.annotations[state.selection.objectIndex];
  if (!annotation) {
    return;
  }
  const currentIndex = state.selection.keypointIndex;
  if (currentIndex < 0) {
    return;
  }
  ensureKeypoints(annotation);
  const current = annotation.keypoints[currentIndex];
  if (!current || current.v === 0) {
    return;
  }
  const nextIndex = findNextAvailableKeypointIndex(annotation, currentIndex, delta);
  if (nextIndex < 0) {
    return;
  }
  pushUndo();
  annotation.keypoints[nextIndex] = { x: current.x, y: current.y, v: current.v };
  annotation.keypoints[currentIndex] = { x: 0, y: 0, v: 0 };
  annotation.hasPose = true;
  state.selection.keypointIndex = nextIndex;
  showKeypointHover(state.selection.objectIndex, nextIndex);
  markDirty();
}

function ensureKeypoints(annotation) {
  if (!annotation.keypoints) {
    annotation.keypoints = [];
  }
  for (let i = annotation.keypoints.length; i < KPT_COUNT; i += 1) {
    annotation.keypoints.push({ x: 0, y: 0, v: 0 });
  }
  if (annotation.keypoints.length > KPT_COUNT) {
    annotation.keypoints.length = KPT_COUNT;
  }
}

function findFirstAvailableKeypointIndex(annotation) {
  ensureKeypoints(annotation);
  for (let i = 0; i < KPT_COUNT; i += 1) {
    const kp = annotation.keypoints[i];
    if (kp && kp.v === 0) {
      return i;
    }
  }
  return -1;
}

function findNextAvailableKeypointIndex(annotation, currentIndex, step) {
  ensureKeypoints(annotation);
  for (let offset = 1; offset <= KPT_COUNT; offset += 1) {
    const idx = (currentIndex + step * offset + KPT_COUNT) % KPT_COUNT;
    const kp = annotation.keypoints[idx];
    if (kp && kp.v === 0) {
      return idx;
    }
  }
  return -1;
}

function addKeypointAt(objectIndex, worldX, worldY) {
  const annotation = state.annotations[objectIndex];
  if (!annotation) {
    return -1;
  }
  const nextIndex = findFirstAvailableKeypointIndex(annotation);
  if (nextIndex < 0) {
    return -1;
  }
  pushUndo();
  const kp = annotation.keypoints[nextIndex];
  kp.x = clamp(worldX / state.imageWidth, 0, 1);
  kp.y = clamp(worldY / state.imageHeight, 0, 1);
  kp.v = 2;
  annotation.hasPose = true;
  setSelection(objectIndex, nextIndex, null);
  showKeypointHover(objectIndex, nextIndex);
  markDirty();
  return nextIndex;
}

function showKeypointHover(objectIndex, keypointIndex) {
  const annotation = state.annotations[objectIndex];
  const kp = annotation ? annotation.keypoints[keypointIndex] : null;
  if (!kp) {
    return;
  }
  let screenX = state.lastMouse.screenX;
  let screenY = state.lastMouse.screenY;
  if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
    const pos = worldToScreen(kp.x * state.imageWidth, kp.y * state.imageHeight);
    screenX = pos.x;
    screenY = pos.y;
  }
  state.hover.objectIndex = objectIndex;
  state.hover.keypointIndex = keypointIndex;
  state.hover.screenX = screenX;
  state.hover.screenY = screenY;
}

function finishNewBBox(event) {
  const startX = state.dragging.startWorldX;
  const startY = state.dragging.startWorldY;
  let endX = state.dragging.currentWorldX;
  let endY = state.dragging.currentWorldY;
  if (event) {
    const pos = getMousePos(event);
    endX = pos.worldX;
    endY = pos.worldY;
  }
  if (!Number.isFinite(startX) || !Number.isFinite(startY)) {
    return;
  }
  if (!Number.isFinite(endX) || !Number.isFinite(endY)) {
    return;
  }
  const widthPx = Math.abs(endX - startX);
  const heightPx = Math.abs(endY - startY);
  if (widthPx < MIN_BBOX_PIXELS || heightPx < MIN_BBOX_PIXELS) {
    return;
  }
  const minX = clamp(Math.min(startX, endX) / state.imageWidth, 0, 1);
  const maxX = clamp(Math.max(startX, endX) / state.imageWidth, 0, 1);
  const minY = clamp(Math.min(startY, endY) / state.imageHeight, 0, 1);
  const maxY = clamp(Math.max(startY, endY) / state.imageHeight, 0, 1);
  const baseId = Number.isFinite(state.lastClassId) ? Math.round(state.lastClassId) : 0;
  const classId = Math.max(0, baseId);
  const bbox = {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    w: Math.max(0.0001, maxX - minX),
    h: Math.max(0.0001, maxY - minY)
  };
  const annotation = {
    classId,
    bbox,
    keypoints: createEmptyKeypoints(),
    hasPose: false
  };
  pushUndo();
  state.annotations.push(annotation);
  setSelection(state.annotations.length - 1, -1, null);
  state.lastClassId = classId;
  markDirty();
}

function cycleVisibility() {
  const obj = state.annotations[state.selection.objectIndex];
  if (!obj) {
    return;
  }
  const kp = obj.keypoints[state.selection.keypointIndex];
  if (!kp) {
    return;
  }
  pushUndo();
  kp.v = (kp.v + 1) % 3;
  obj.hasPose = true;
  markDirty();
}

function deleteSelection() {
  if (state.selection.objectIndex < 0) {
    return;
  }
  const annotation = state.annotations[state.selection.objectIndex];
  if (!annotation) {
    return;
  }
  const kpIndex = state.selection.keypointIndex;
  const kp = kpIndex >= 0 ? annotation.keypoints[kpIndex] : null;
  if (kp) {
    pushUndo();
    kp.v = 0;
    annotation.hasPose = true;
    state.selection.keypointIndex = -1;
    markDirty();
    return;
  }
  pushUndo();
  state.annotations.splice(state.selection.objectIndex, 1);
  clearSelection();
  markDirty();
}

function cloneAnnotations(annotations) {
  return annotations.map((ann) => ({
    classId: ann.classId,
    bbox: {
      cx: ann.bbox.cx,
      cy: ann.bbox.cy,
      w: ann.bbox.w,
      h: ann.bbox.h
    },
    keypoints: ann.keypoints.map((kp) => ({
      x: kp.x,
      y: kp.y,
      v: kp.v
    })),
    hasPose: ann.hasPose
  }));
}

function pushUndo() {
  state.undoStack.push(cloneAnnotations(state.annotations));
  if (state.undoStack.length > MAX_UNDO) {
    state.undoStack.shift();
  }
}

function ensureUndoSnapshot() {
  if (state.dragging.snapshotTaken) {
    return;
  }
  pushUndo();
  state.dragging.snapshotTaken = true;
}

function undo() {
  if (state.undoStack.length === 0) {
    return;
  }
  const snapshot = state.undoStack.pop();
  state.annotations = snapshot;
  clearSelection();
  if (annotationsEqual(state.annotations, state.baseAnnotations)) {
    state.dirty = false;
    state.modifiedSinceLoad = false;
    setStatus(`${state.imageName} (${state.index + 1}/${state.images.length})`);
    return;
  }
  markDirty();
}

function annotationsEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i += 1) {
    const a = left[i];
    const b = right[i];
    if (!a || !b) {
      return false;
    }
    if (a.classId !== b.classId || a.hasPose !== b.hasPose) {
      return false;
    }
    if (!bboxEqual(a.bbox, b.bbox)) {
      return false;
    }
    if (a.keypoints.length !== b.keypoints.length) {
      return false;
    }
    for (let k = 0; k < a.keypoints.length; k += 1) {
      const ka = a.keypoints[k];
      const kb = b.keypoints[k];
      if (!ka || !kb) {
        return false;
      }
      if (ka.x !== kb.x || ka.y !== kb.y || ka.v !== kb.v) {
        return false;
      }
    }
  }
  return true;
}

function bboxEqual(a, b) {
  return a.cx === b.cx && a.cy === b.cy && a.w === b.w && a.h === b.h;
}

async function changeImage(nextIndex) {
  if (nextIndex < 0 || nextIndex >= state.images.length) {
    return;
  }
  if (state.dirty) {
    await saveLabels();
    if (state.dirty) {
      return;
    }
  }
  await loadImage(nextIndex);
}

function markDirty() {
  state.dirty = true;
  state.modifiedSinceLoad = true;
  setStatus("Unsaved changes...");
}

async function saveLabels() {
  if (!state.imagesDir || !state.labelsDir || !state.imageName) {
    return;
  }
  const labelName = `${stripExt(state.imageName)}.txt`;
  const payload = {
    labelsDir: state.labelsDir,
    file: labelName,
    content: serializeLabels()
  };

  try {
    const response = await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error("Save failed");
    }
    state.dirty = false;
    setStatus(`Saved ${labelName}`);
  } catch (error) {
    setStatus(`Save error: ${error.message}`);
  }
}

function pickKeypoint(screenX, screenY) {
  const radius = 8;
  const order = buildPickOrder();
  for (const idx of order) {
    const ann = state.annotations[idx];
    if (!ann || !ann.hasPose) {
      continue;
    }
    for (let k = 0; k < ann.keypoints.length; k += 1) {
      const kp = ann.keypoints[k];
      if (kp.v === 0) {
        continue;
      }
      const pos = worldToScreen(kp.x * state.imageWidth, kp.y * state.imageHeight);
      const dist = Math.hypot(screenX - pos.x, screenY - pos.y);
      if (dist <= radius) {
        return { objectIndex: idx, keypointIndex: k };
      }
    }
  }
  return null;
}

function pickCorner(screenX, screenY) {
  const radius = 10;
  const order = buildPickOrder();
  for (const idx of order) {
    const ann = state.annotations[idx];
    if (!ann) {
      continue;
    }
    const corners = bboxCorners(ann.bbox);
    for (const corner of ["tl", "tr", "bl", "br"]) {
      const cornerPos = corners[corner];
      const screenPos = worldToScreen(cornerPos.x, cornerPos.y);
      const dist = Math.hypot(screenX - screenPos.x, screenY - screenPos.y);
      if (dist <= radius) {
        return { objectIndex: idx, corner, corners };
      }
    }
  }
  return null;
}

function pickBBox(screenX, screenY) {
  const order = buildPickOrder();
  for (const idx of order) {
    const ann = state.annotations[idx];
    if (!ann) {
      continue;
    }
    const { x, y, w, h } = bboxToPixels(ann.bbox);
    const screenPos = worldToScreen(x, y);
    const screenSize = worldToScreen(x + w, y + h);
    if (screenX >= screenPos.x && screenX <= screenSize.x && screenY >= screenPos.y && screenY <= screenSize.y) {
      return { objectIndex: idx };
    }
  }
  return null;
}

function bboxCorners(bbox) {
  const x1 = (bbox.cx - bbox.w / 2) * state.imageWidth;
  const y1 = (bbox.cy - bbox.h / 2) * state.imageHeight;
  const x2 = (bbox.cx + bbox.w / 2) * state.imageWidth;
  const y2 = (bbox.cy + bbox.h / 2) * state.imageHeight;
  return {
    tl: { x: x1, y: y1 },
    tr: { x: x2, y: y1 },
    bl: { x: x1, y: y2 },
    br: { x: x2, y: y2 }
  };
}

function updateCorners(corners, activeCorner, nx, ny) {
  const current = {
    x1: corners.tl.x / state.imageWidth,
    y1: corners.tl.y / state.imageHeight,
    x2: corners.br.x / state.imageWidth,
    y2: corners.br.y / state.imageHeight
  };
  if (activeCorner === "tl") {
    current.x1 = nx;
    current.y1 = ny;
  }
  if (activeCorner === "tr") {
    current.x2 = nx;
    current.y1 = ny;
  }
  if (activeCorner === "bl") {
    current.x1 = nx;
    current.y2 = ny;
  }
  if (activeCorner === "br") {
    current.x2 = nx;
    current.y2 = ny;
  }
  return current;
}

function buildPickOrder() {
  const selected = state.selection.objectIndex;
  if (selected >= 0 && selected < state.annotations.length) {
    return [selected];
  }
  const order = [];
  for (let i = state.annotations.length - 1; i >= 0; i -= 1) {
    order.push(i);
  }
  return order;
}

function getVisibleIndices() {
  const selected = state.selection.objectIndex;
  if (selected >= 0 && selected < state.annotations.length) {
    return [selected];
  }
  const indices = [];
  for (let i = 0; i < state.annotations.length; i += 1) {
    indices.push(i);
  }
  return indices;
}

function setSelection(objectIndex, keypointIndex, corner) {
  state.selection.objectIndex = objectIndex;
  state.selection.keypointIndex = keypointIndex;
  state.selection.corner = corner;
  if (objectIndex >= 0) {
    const annotation = state.annotations[objectIndex];
    if (annotation && Number.isFinite(annotation.classId)) {
      state.lastClassId = Math.max(0, Math.round(annotation.classId));
    }
  }
  clearHover();
}

function clearSelection() {
  setSelection(-1, -1, null);
}

function selectNextObject() {
  const total = state.annotations.length;
  if (total === 0) {
    return;
  }
  const next = state.selection.objectIndex < 0
    ? 0
    : (state.selection.objectIndex + 1) % total;
  setSelection(next, -1, null);
}

function selectPrevObject() {
  const total = state.annotations.length;
  if (total === 0) {
    return;
  }
  const prev = state.selection.objectIndex < 0
    ? total - 1
    : (state.selection.objectIndex - 1 + total) % total;
  setSelection(prev, -1, null);
}

function updateHover(screenX, screenY) {
  const pick = pickKeypoint(screenX, screenY);
  if (pick) {
    state.hover.objectIndex = pick.objectIndex;
    state.hover.keypointIndex = pick.keypointIndex;
    state.hover.screenX = screenX;
    state.hover.screenY = screenY;
    return;
  }
  clearHover();
}

function clearHover() {
  state.hover.objectIndex = -1;
  state.hover.keypointIndex = -1;
}

function getMousePos(event) {
  const rect = canvas.getBoundingClientRect();
  const screenX = event.clientX - rect.left;
  const screenY = event.clientY - rect.top;
  const world = screenToWorld(screenX, screenY);
  return {
    screenX,
    screenY,
    worldX: world.x,
    worldY: world.y
  };
}

function setStatus(text) {
  state.statusText = text;
}

function getColorScheme() {
  return COLOR_SCHEMES[state.colorSchemeIndex] || COLOR_SCHEMES[0];
}

function cycleColorScheme() {
  if (COLOR_SCHEMES.length === 0) {
    return;
  }
  state.colorSchemeIndex = (state.colorSchemeIndex + 1) % COLOR_SCHEMES.length;
  const scheme = getColorScheme();
  setStatus(`Color scheme: ${scheme.name}`);
}

init();
