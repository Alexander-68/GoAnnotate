const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const imagesDirInput = document.getElementById("imagesDir");
const labelsDirInput = document.getElementById("labelsDir");
const imagesDirList = document.getElementById("imagesDirList");
const labelsDirList = document.getElementById("labelsDirList");
const loadBtn = document.getElementById("loadBtn");
const confirmLoadBtn = document.getElementById("confirmLoadBtn");
const loadModal = document.getElementById("loadModal");
const statusEl = document.getElementById("status");
const MAX_RECENTS = 10;

const KPT_COUNT = 17;
const SKELETON = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16]
];

const CLASS_COLORS = ["#e4572e", "#1d6fa3", "#57a639"];
const VIS_COLORS = {
  0: "rgba(29, 28, 26, 0.25)",
  1: "#f4b73b",
  2: "#1d6fa3"
};

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
  selection: {
    objectIndex: -1,
    keypointIndex: -1,
    corner: null
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
    startOffsetX: 0,
    startOffsetY: 0,
    startCenter: null,
    startCorners: null
  },
  spaceDown: false,
  dirty: false,
  saveTimer: null
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

  loadBtn.addEventListener("click", () => {
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
  state.annotations = [];
  state.dirty = false;

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
  const margin = 24;
  const availW = Math.max(1, state.canvasSize.width - margin * 2);
  const availH = Math.max(1, state.canvasSize.height - margin * 2);
  const scaleX = availW / state.imageWidth;
  const scaleY = availH / state.imageHeight;
  state.view.scale = Math.min(scaleX, scaleY, 6);
  state.view.offsetX = (state.canvasSize.width - state.imageWidth * state.view.scale) / 2;
  state.view.offsetY = (state.canvasSize.height - state.imageHeight * state.view.scale) / 2;
}

function render() {
  const { width, height, dpr } = state.canvasSize;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state.imageBitmap) {
    const viewScale = state.view.scale;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, dpr * state.view.offsetX, dpr * state.view.offsetY);
    ctx.drawImage(state.imageBitmap, 0, 0);

    for (let i = 0; i < state.annotations.length; i += 1) {
      drawAnnotation(state.annotations[i], i === state.selection.objectIndex, i);
    }
  }

  drawHud(width, height, dpr);
  requestAnimationFrame(render);
}

function drawAnnotation(annotation, isActive, index) {
  drawBBox(annotation, isActive, index);
  if (annotation.hasPose) {
    drawSkeleton(annotation, isActive);
    drawKeypoints(annotation, isActive);
  }
}

function drawBBox(annotation, isActive, index) {
  const color = CLASS_COLORS[annotation.classId % CLASS_COLORS.length] || "#e4572e";
  const { x, y, w, h } = bboxToPixels(annotation.bbox);
  ctx.strokeStyle = color;
  ctx.lineWidth = isActive ? 2 : 1;
  ctx.strokeRect(x, y, w, h);

  if (isActive) {
    ctx.fillStyle = "rgba(29, 28, 26, 0.08)";
    ctx.fillRect(x, y, w, h);
    drawCorners(x, y, w, h);
  }

  ctx.font = "12px 'Space Grotesk', 'Trebuchet MS', sans-serif";
  ctx.fillStyle = color;
  ctx.fillText(`ID ${index + 1}`, x + 4, y - 6);
}

function drawCorners(x, y, w, h) {
  const size = 8;
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

function drawSkeleton(annotation, isActive) {
  ctx.strokeStyle = isActive ? "rgba(29, 111, 163, 0.7)" : "rgba(29, 111, 163, 0.45)";
  ctx.lineWidth = isActive ? 2 : 1;
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
  for (let i = 0; i < annotation.keypoints.length; i += 1) {
    const kp = annotation.keypoints[i];
    if (kp.v === 0 && !isActive) {
      continue;
    }
    const pos = keypointToPixels(kp);
    const isSelected = isActive && state.selection.keypointIndex === i;
    const radius = isSelected ? 6 : baseRadius;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = VIS_COLORS[kp.v] || VIS_COLORS[2];
    ctx.fill();
    if (kp.v === 0) {
      ctx.strokeStyle = "rgba(29, 28, 26, 0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (isSelected) {
      ctx.strokeStyle = "#1d1c1a";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

function drawHud(width, height, dpr) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "rgba(29, 28, 26, 0.7)";
  ctx.font = "12px 'Space Grotesk', 'Trebuchet MS', sans-serif";
  const text = state.imageName
    ? `${state.imageName} • ${state.imageWidth}x${state.imageHeight} • ${state.annotations.length} boxes`
    : "Load an image directory to begin.";
  ctx.fillText(text, 24, height - 18);
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
  const { screenX, screenY, worldX, worldY } = getMousePos(event);

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
  if (!state.imageBitmap || !state.dragging.mode) {
    return;
  }
  const { screenX, screenY, worldX, worldY } = getMousePos(event);

  if (state.dragging.mode === "pan") {
    const dx = screenX - state.dragging.startX;
    const dy = screenY - state.dragging.startY;
    state.view.offsetX = state.dragging.startOffsetX + dx;
    state.view.offsetY = state.dragging.startOffsetY + dy;
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
    const dx = (worldX - state.dragging.startWorldX) / state.imageWidth;
    const dy = (worldY - state.dragging.startWorldY) / state.imageHeight;
    const bbox = annotation.bbox;
    bbox.cx = clamp(state.dragging.startCenter.cx + dx, bbox.w / 2, 1 - bbox.w / 2);
    bbox.cy = clamp(state.dragging.startCenter.cy + dy, bbox.h / 2, 1 - bbox.h / 2);
    markDirty();
  }

  if (state.dragging.mode === "bboxCorner") {
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

function onMouseUp() {
  if (state.dragging.mode && state.dirty) {
    scheduleSave();
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

  if (event.code === "Space") {
    state.spaceDown = true;
    event.preventDefault();
  }

  if (event.code === "KeyA") {
    event.preventDefault();
    loadImage(state.index - 1);
  }

  if (event.code === "KeyD") {
    event.preventDefault();
    loadImage(state.index + 1);
  }

  if (event.code === "KeyV") {
    cycleVisibility();
  }

  if (event.code === "Delete") {
    deleteSelection();
  }
}

function onKeyUp(event) {
  if (event.code === "Space") {
    state.spaceDown = false;
  }
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
  kp.v = (kp.v + 1) % 3;
  obj.hasPose = true;
  markDirty();
  scheduleSave();
}

function deleteSelection() {
  if (state.selection.objectIndex < 0) {
    return;
  }
  state.annotations.splice(state.selection.objectIndex, 1);
  clearSelection();
  markDirty();
  scheduleSave();
}

function markDirty() {
  state.dirty = true;
  setStatus("Unsaved changes...");
}

function scheduleSave() {
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
  }
  state.saveTimer = setTimeout(() => {
    saveLabels();
  }, 300);
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
  const order = [];
  if (state.selection.objectIndex >= 0) {
    order.push(state.selection.objectIndex);
  }
  for (let i = state.annotations.length - 1; i >= 0; i -= 1) {
    if (i !== state.selection.objectIndex) {
      order.push(i);
    }
  }
  return order;
}

function setSelection(objectIndex, keypointIndex, corner) {
  state.selection.objectIndex = objectIndex;
  state.selection.keypointIndex = keypointIndex;
  state.selection.corner = corner;
}

function clearSelection() {
  state.selection.objectIndex = -1;
  state.selection.keypointIndex = -1;
  state.selection.corner = null;
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
  statusEl.textContent = text;
}

init();