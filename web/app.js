const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const imagesDirInput = document.getElementById("imagesDir");
const labelsDirInput = document.getElementById("labelsDir");
const imagesDirList = document.getElementById("imagesDirList");
const labelsDirList = document.getElementById("labelsDirList");
const openModalBtn = document.getElementById("openModalBtn");
const openHelpBtn = document.getElementById("openHelpBtn");
const confirmLoadBtn = document.getElementById("confirmLoadBtn");
const loadModal = document.getElementById("loadModal");
const helpModal = document.getElementById("helpModal");
const browseImagesBtn = document.getElementById("browseImagesBtn");
const browseLabelsBtn = document.getElementById("browseLabelsBtn");
const folderPicker = document.getElementById("folderPicker");
const pickerList = document.getElementById("pickerList");
const pickerCurrentPath = document.getElementById("pickerCurrentPath");
const pickerBackBtn = document.getElementById("pickerBackBtn");
const pickerTitle = document.getElementById("pickerTitle");
const pickerCancelBtn = document.getElementById("pickerCancelBtn");
const pickerSelectBtn = document.getElementById("pickerSelectBtn");
const osdEl = document.getElementById("osd");
const labelsSection = document.getElementById("labelsSection");
const magnifier = document.getElementById("magnifier");
const magnifierCanvas = document.getElementById("magnifierCanvas");
const magCtx = magnifierCanvas ? magnifierCanvas.getContext("2d") : null;
const magnifierMoveHandle = document.getElementById("magnifierMove");
const magnifierResizeHandle = document.getElementById("magnifierResize");
const magnifierMinimizeBtn = document.getElementById("magnifierMinimize");
const workspace = document.querySelector(".workspace");

let pickerActiveTarget = null;
let pickerCurrentPathVal = "";
let pickerSelectedPath = "";

const MAX_RECENTS = 10;
const MAX_UNDO = 50;

const KPT_COUNT = (typeof Labels !== "undefined" && Number.isFinite(Labels.KPT_COUNT))
  ? Labels.KPT_COUNT
  : 17;
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
const PAN_DRAG_THRESHOLD = 3;
const TOUCH_SWIPE_THRESHOLD = 80;
const TOUCH_SWIPE_MAX_TIME = 350;
const TOUCH_SWIPE_AXIS_RATIO = 1.3;
const DOUBLE_TAP_MAX_DELAY = 280;
const DOUBLE_TAP_MAX_DISTANCE = 30;
const MAGNIFIER_DEFAULT_WIDTH = 360;
const MAGNIFIER_DEFAULT_HEIGHT = 360;
const MAGNIFIER_MIN_WIDTH = 160;
const MAGNIFIER_MIN_HEIGHT = 160;
const MAGNIFIER_MINIMIZED_SIZE = 44;

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
    startCorners: null,
    snapshotTaken: false,
    pendingSelection: null
  },
  touch: {
    mode: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startTime: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    startScale: 1,
    startDist: 0,
    swipeEligible: false,
    pinchIsMagnifier: false,
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0
  },
  magnifier: {
    active: false,
    x: 0, // world x center
    y: 0, // world y center
    scale: 5,
    screenX: null,
    screenY: null,
    width: MAGNIFIER_DEFAULT_WIDTH,
    height: MAGNIFIER_DEFAULT_HEIGHT,
    minimized: false,
    restoreWidth: MAGNIFIER_DEFAULT_WIDTH,
    restoreHeight: MAGNIFIER_DEFAULT_HEIGHT,
    restoreX: null,
    restoreY: null,
    drag: {
      mode: null,
      pointerId: null,
      startX: 0,
      startY: 0,
      startLeft: 0,
      startTop: 0,
      startWidth: MAGNIFIER_DEFAULT_WIDTH,
      startHeight: MAGNIFIER_DEFAULT_HEIGHT,
      target: null
    }
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

  openHelpBtn.addEventListener("click", () => {
    openHelp();
  });

  helpModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target && target.dataset && target.dataset.close) {
      closeHelp();
    }
  });

  confirmLoadBtn.addEventListener("click", () => {
    openProject();
  });

  browseImagesBtn.addEventListener("click", () => {
    openPicker(imagesDirInput, "Select Images Directory");
  });

  browseLabelsBtn.addEventListener("click", () => {
    openPicker(labelsDirInput, "Select Labels Directory");
  });

  pickerBackBtn.addEventListener("click", () => {
    navigatePicker("..");
  });

  pickerCancelBtn.addEventListener("click", () => {
    closePicker();
  });

  pickerSelectBtn.addEventListener("click", () => {
    if (pickerActiveTarget) {
      const val = pickerSelectedPath || pickerCurrentPathVal;
      pickerActiveTarget.value = val;
      if (pickerActiveTarget === imagesDirInput) {
        checkLabelsVisibility();
        suggestLabels(val);
      }
    }
    closePicker();
  });

  imagesDirInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      openProject();
    }
  });

  imagesDirInput.addEventListener("input", () => {
    checkLabelsVisibility();
  });

  labelsDirInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      openProject();
    }
  });

  // Main Canvas Events
  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mouseleave", () => clearHover());
  canvas.addEventListener("dblclick", onDoubleClick);
  window.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  canvas.addEventListener("touchmove", onTouchMove, { passive: false });
  canvas.addEventListener("touchend", onTouchEnd, { passive: false });
  canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });

  // Magnifier Events
  if (magnifierCanvas) {
    magnifierCanvas.addEventListener("mousedown", onMouseDown);
    magnifierCanvas.addEventListener("mousemove", onMouseMove);
    magnifierCanvas.addEventListener("mouseleave", () => clearHover());
    magnifierCanvas.addEventListener("wheel", onWheel, { passive: false });
    magnifierCanvas.addEventListener("contextmenu", (event) => event.preventDefault());
    magnifierCanvas.addEventListener("touchstart", onTouchStart, { passive: false });
    magnifierCanvas.addEventListener("touchmove", onTouchMove, { passive: false });
    magnifierCanvas.addEventListener("touchend", onTouchEnd, { passive: false });
  }

  if (magnifierMoveHandle) {
    magnifierMoveHandle.addEventListener("pointerdown", (event) => beginMagnifierDrag(event, "move"));
  }
  if (magnifierResizeHandle) {
    magnifierResizeHandle.addEventListener("pointerdown", (event) => beginMagnifierDrag(event, "resize"));
  }
  if (magnifierMinimizeBtn) {
    magnifierMinimizeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setMagnifierMinimized(!state.magnifier.minimized);
    });
  }
  if (magnifier) {
    magnifier.addEventListener("click", (event) => {
      if (!state.magnifier.minimized) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setMagnifierMinimized(false);
    });
  }

  loadModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target && target.dataset && target.dataset.close) {
      closeModal();
    }
  });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("pointermove", onMagnifierDragMove);
  window.addEventListener("pointerup", endMagnifierDrag);
  window.addEventListener("pointercancel", endMagnifierDrag);
  window.addEventListener("resize", () => {
    resizeCanvas();
  });

  resizeCanvas();
  openModal();
  updateMagnifierMinimizeButton();
  requestAnimationFrame(render);
}

function openModal() {
  refreshRecents();
  loadModal.classList.remove("hidden");
  loadModal.setAttribute("aria-hidden", "false");
  checkLabelsVisibility();
  imagesDirInput.focus();
}

function checkLabelsVisibility() {
  if (imagesDirInput.value.trim() !== "") {
    labelsSection.classList.remove("hidden");
  } else {
    labelsSection.classList.add("hidden");
  }
}

function closeModal() {
  loadModal.classList.add("hidden");
  loadModal.setAttribute("aria-hidden", "true");
  closePicker();
}

function openHelp() {
  helpModal.classList.remove("hidden");
  helpModal.setAttribute("aria-hidden", "false");
}

function closeHelp() {
  helpModal.classList.add("hidden");
  helpModal.setAttribute("aria-hidden", "true");
}

async function openPicker(target, title) {
  pickerActiveTarget = target;
  if (pickerTitle) {
    pickerTitle.textContent = title || "Select Directory";
  }
  folderPicker.classList.remove("hidden");
  let startPath = target.value.trim();
  pickerSelectedPath = startPath;
  await navigatePicker(startPath);
}

function closePicker() {
  folderPicker.classList.add("hidden");
  pickerActiveTarget = null;
}

async function navigatePicker(targetPath) {
  try {
    let url = "/api/browse";
    if (targetPath === "..") {
      if (pickerCurrentPathVal) {
        url += `?path=${encodeURIComponent(pickerCurrentPathVal)}&parent=true`;
      }
    } else if (targetPath) {
      url += `?path=${encodeURIComponent(targetPath)}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      if (targetPath) {
        await navigatePicker("");
      }
      return;
    }
    const data = await response.json();

    if (targetPath === ".." && data.parent) {
      const parentResponse = await fetch(`/api/browse?path=${encodeURIComponent(data.parent)}`);
      if (parentResponse.ok) {
        const parentData = await parentResponse.json();
        updatePickerUI(parentData);
        return;
      }
    }

    updatePickerUI(data);
  } catch (err) {
    console.error("Browse error:", err);
  }
}

async function suggestLabels(imagesDir) {
  if (!imagesDir) return;
  try {
    const url = `/api/suggest_labels?imagesDir=${encodeURIComponent(imagesDir)}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.labelsDir) {
        labelsDirInput.value = data.labelsDir;
      }
    }
  } catch (e) {
    console.error("Suggest labels error:", e);
  }
}

function updatePickerUI(data) {
  pickerCurrentPathVal = data.current;
  pickerCurrentPath.textContent = data.current;
  pickerList.innerHTML = "";

  // Reset selection to current folder if we navigated away from explicit selection,
  // unless the explicit selection is the folder we are currently in.
  if (pickerSelectedPath && pickerSelectedPath !== data.current) {
     // Check if pickerSelectedPath is a direct child of data.current?
     // Actually, simpler logic: assume if we navigated, we reset specific file selection.
     // But if we just refreshed current view...
     // Let's just default to current path if the previous selection is not visible here.
     // Actually, let's keep it simple: If we are here, default selection is the current folder
     // unless the user clicks a child.
     pickerSelectedPath = data.current;
  }

  const updateSelectBtnText = () => {
    const isRoot = pickerSelectedPath === data.current;
    pickerSelectBtn.textContent = isRoot ? "Select Current" : "Select Selected";
  };
  updateSelectBtnText();

  data.dirs.forEach((dir) => {
    const item = document.createElement("div");
    item.className = "picker-item";
    
    // Build meta info
    const meta = document.createElement("span");
    meta.className = "picker-meta";
    const parts = [];
    if (dir.images > 0) parts.push(`${dir.images} img`);
    if (dir.labels > 0) parts.push(`${dir.labels} lbl`);
    if (parts.length > 0) {
      meta.textContent = parts.join(", ");
    }
    
    // Construct path for this item
    const separator = pickerCurrentPathVal.includes("\\") ? "\\" : "/";
    const fullPath = pickerCurrentPathVal.endsWith(separator)
      ? pickerCurrentPathVal + dir.name
      : pickerCurrentPathVal + separator + dir.name;

    item.textContent = dir.name;
    item.appendChild(meta);

    item.addEventListener("click", () => {
      if (dir.hasSubdirs) {
        navigatePicker(fullPath);
      } else {
        // Select this folder without entering
        pickerSelectedPath = fullPath;
        // Update UI highlights
        Array.from(pickerList.children).forEach(c => c.classList.remove("selected"));
        item.classList.add("selected");
        updateSelectBtnText();
      }
    });
    
    pickerList.appendChild(item);
  });

  pickerBackBtn.disabled = !data.parent || data.parent === data.current;
  pickerBackBtn.onclick = () => {
    if (data.parent) navigatePicker(data.parent);
  };
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
      state.imageWidth = 0;
      state.imageHeight = 0;
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

async function loadImage(index, options = {}) {
  if (index < 0 || index >= state.images.length) {
    return;
  }
  const preserveView = options && options.preserveView;
  const preserveMagnifier = options && options.preserveMagnifier;
  const viewState = options && options.viewState;
  const magnifierState = options && options.magnifierState;
  const entry = state.images[index];
  state.index = index;
  state.imageName = entry.name;
  state.selection = { objectIndex: -1, keypointIndex: -1, corner: null };
  state.hover = { objectIndex: -1, keypointIndex: -1, screenX: 0, screenY: 0 };
  state.imageBitmap = null;
  state.imageWidth = 0;
  state.imageHeight = 0;
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
    if (preserveView && viewState
      && Number.isFinite(viewState.scale)
      && Number.isFinite(viewState.offsetX)
      && Number.isFinite(viewState.offsetY)) {
      state.view.scale = viewState.scale;
      state.view.offsetX = viewState.offsetX;
      state.view.offsetY = viewState.offsetY;
    } else {
      fitImage();
    }
    if (preserveMagnifier && magnifierState) {
      state.magnifier.active = magnifierState.active;
      state.magnifier.x = magnifierState.x;
      state.magnifier.y = magnifierState.y;
      state.magnifier.scale = magnifierState.scale;
      state.magnifier.screenX = magnifierState.screenX;
      state.magnifier.screenY = magnifierState.screenY;
      state.magnifier.width = magnifierState.width;
      state.magnifier.height = magnifierState.height;
      state.magnifier.minimized = magnifierState.minimized;
      state.magnifier.restoreWidth = magnifierState.restoreWidth;
      state.magnifier.restoreHeight = magnifierState.restoreHeight;
      state.magnifier.restoreX = magnifierState.restoreX;
      state.magnifier.restoreY = magnifierState.restoreY;
      state.magnifier.drag.mode = null;
      state.magnifier.drag.pointerId = null;
      updateMagnifierMinimizeButton();
    }
    setStatus(`${entry.name} (${state.index + 1}/${state.images.length})`);
  } catch (error) {
    setStatus(`Error: ${error.message}`);
  }
}

function labelsModuleAvailable() {
  return typeof Labels !== "undefined"
    && Labels
    && typeof Labels.parseLabels === "function"
    && typeof Labels.serializeLabels === "function";
}

function ensureLabelsModule() {
  if (!labelsModuleAvailable()) {
    setStatus("Labels module missing. Refresh the page.");
    return false;
  }
  return true;
}

function parseLabels(text) {
  if (!ensureLabelsModule()) {
    return [];
  }
  return Labels.parseLabels(text);
}

function createEmptyKeypoints() {
  const points = [];
  for (let i = 0; i < KPT_COUNT; i += 1) {
    points.push({ x: 0, y: 0, v: 0 });
  }
  return points;
}

function serializeLabels() {
  if (!ensureLabelsModule()) {
    return null;
  }
  return Labels.serializeLabels(state.annotations);
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
      drawAnnotation(ctx, viewScale, annotation, idx === state.selection.objectIndex);
    }
    if (state.dragging.mode === "newBBox") {
      drawNewBBox(ctx, viewScale);
    }
    drawObjectLabels(visible);
    drawHoverLabel();

    updateMagnifier();
  }

  updateOsd();
  requestAnimationFrame(render);
}

function drawAnnotation(ctx, scale, annotation, isActive) {
  drawBBox(ctx, scale, annotation, isActive);
  if (annotation.hasPose) {
    drawSkeleton(ctx, scale, annotation, isActive);
    drawKeypoints(ctx, scale, annotation, isActive);
  }
}

function drawBBox(ctx, scale, annotation, isActive) {
  const color = getClassColor(annotation.classId);
  const { x, y, w, h } = bboxToPixels(annotation.bbox);
  ctx.strokeStyle = color;
  ctx.lineWidth = toWorldSize(isActive ? 2 : 1, scale);
  ctx.strokeRect(x, y, w, h);

  if (isActive) {
    ctx.fillStyle = "rgba(29, 28, 26, 0.08)";
    ctx.fillRect(x, y, w, h);
    drawCorners(ctx, scale, x, y, w, h);
  }
}

function drawCorners(ctx, scale, x, y, w, h) {
  const size = toWorldSize(8, scale);
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

function drawNewBBox(ctx, scale) {
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
  const classId = Number.isFinite(state.lastClassId)
    ? Math.round(state.lastClassId)
    : 0;
  const color = getClassColor(classId);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = toWorldSize(2, scale);
  ctx.setLineDash([toWorldSize(6, scale), toWorldSize(4, scale)]);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawSkeleton(ctx, scale, annotation, isActive) {
  const scheme = getColorScheme();
  ctx.strokeStyle = isActive ? scheme.skeleton.active : scheme.skeleton.inactive;
  ctx.lineWidth = toWorldSize(isActive ? 2 : 1, scale);
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

function drawKeypoints(ctx, scale, annotation, isActive) {
  const baseRadius = 4;
  const scheme = getColorScheme();
  for (let i = 0; i < annotation.keypoints.length; i += 1) {
    const kp = annotation.keypoints[i];
    if (kp.v === 0) {
      continue;
    }
    const pos = keypointToPixels(kp);
    const isSelected = isActive && state.selection.keypointIndex === i;
    const radius = toWorldSize(isSelected ? 6 : baseRadius, scale);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    const visColor = scheme.visColors[kp.v] || scheme.visColors[2];
    ctx.strokeStyle = visColor;
    ctx.lineWidth = toWorldSize(isSelected ? 2 : 1.5, scale);
    ctx.stroke();
    if (isSelected) {
      ctx.strokeStyle = "#1d1c1a";
      ctx.lineWidth = toWorldSize(2.5, scale);
      ctx.stroke();
    }
  }
}

function drawObjectLabels(indices) {
  const { dpr } = state.canvasSize;
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
    const color = getClassColor(annotation.classId);
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
  ctx.font = "15px 'Space Grotesk', 'Trebuchet MS', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const paddingX = 7.5;
  const paddingY = 3.75;
  const textWidth = ctx.measureText(label).width;
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = 22.5;
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
  
  let zoomLine = `Zoom: ${Math.round(state.view.scale * 100)}%`;
  if (state.magnifier.active) {
    zoomLine += ` (${Math.round(state.magnifier.scale * 100)}%)`;
  }

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

  const { w, h } = bboxToPixels(obj.bbox);
  lines.push(`${obj.classId}:${state.selection.objectIndex + 1} size ${Math.round(w)} x ${Math.round(h)}`);

  if (obj.hasPose) {
    const total = obj.keypoints.length;
    let visible = 0;
    for (const kp of obj.keypoints) {
      if (kp.v > 0) {
        visible += 1;
      }
    }
    lines.push(`Keypoints: ${visible}/${total}`);

    if (state.selection.keypointIndex >= 0) {
      const kp = obj.keypoints[state.selection.keypointIndex];
      const visibility = kp ? clampVisibility(kp.v) : 0;
      const name = KEYPOINT_NAMES[state.selection.keypointIndex] || `kp ${state.selection.keypointIndex + 1}`;
      lines.push(`${name}:${visibility}`);
    }
  }
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

function toWorldSize(sizePx, scale) {
  const s = scale !== undefined ? scale : state.view.scale;
  const effective = Math.max(s, 0.0001);
  return sizePx / effective;
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

function isWithinImage(worldX, worldY) {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
    return false;
  }
  if (state.imageWidth <= 0 || state.imageHeight <= 0) {
    return false;
  }
  return worldX >= 0 && worldX <= state.imageWidth
    && worldY >= 0 && worldY <= state.imageHeight;
}

function onMouseDown(event) {
  if (!state.imageBitmap) {
    return;
  }
  
  const pos = getPointerState(event);
  const { worldX, worldY, isMagnifier } = pos;
  state.lastMouse.screenX = pos.screenX;
  state.lastMouse.screenY = pos.screenY;

  if (!isMagnifier && !isWithinImage(worldX, worldY)) {
    return;
  }

  state.dragging.snapshotTaken = false;
  state.dragging.pendingSelection = null;
  state.dragging.isMagnifier = isMagnifier; // Latch context
  clearHover();

  // Use GLOBAL coordinates for startX/Y to handle dragging out of bounds
  if (event.button === 2 || event.button === 1 || state.spaceDown) {
    state.dragging.mode = "pan";
    state.dragging.startX = event.clientX;
    state.dragging.startY = event.clientY;
    if (isMagnifier) {
      state.dragging.startWorldX = state.magnifier.x;
      state.dragging.startWorldY = state.magnifier.y;
    } else {
      state.dragging.startOffsetX = state.view.offsetX;
      state.dragging.startOffsetY = state.view.offsetY;
    }
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
      // Also latch start for consistency
      state.dragging.startX = event.clientX;
      state.dragging.startY = event.clientY;
      return;
    }
    const addedIndex = addKeypointAt(state.selection.objectIndex, worldX, worldY);
    if (addedIndex >= 0) {
      state.dragging.mode = "keypoint";
      state.dragging.startWorldX = worldX;
      state.dragging.startWorldY = worldY;
      state.dragging.snapshotTaken = true;
      state.dragging.startX = event.clientX;
      state.dragging.startY = event.clientY;
      state.magnifier.active = true;
      if (state.magnifier.minimized) {
        setMagnifierMinimized(false);
      }
      if (!isMagnifier) {
        state.magnifier.x = worldX;
        state.magnifier.y = worldY;
      }
    }
    return;
  }

  const keyPick = pickKeypoint(worldX, worldY, pos.scale);
  if (keyPick) {
    setSelection(keyPick.objectIndex, keyPick.keypointIndex, null);
    state.dragging.mode = "keypoint";
    state.dragging.startWorldX = worldX;
    state.dragging.startWorldY = worldY;
    state.dragging.startX = event.clientX;
    state.dragging.startY = event.clientY;
    state.magnifier.active = true;
    if (state.magnifier.minimized) {
      setMagnifierMinimized(false);
    }
    if (!isMagnifier) {
      state.magnifier.x = worldX;
      state.magnifier.y = worldY;
    }
    return;
  }

  const cornerPick = pickCorner(worldX, worldY, pos.scale);
  if (cornerPick) {
    setSelection(cornerPick.objectIndex, -1, cornerPick.corner);
    state.dragging.mode = "bboxCorner";
    state.dragging.startCorners = cornerPick.corners;
    state.dragging.startX = event.clientX;
    state.dragging.startY = event.clientY;
    return;
  }

  const bboxPick = pickBBox(worldX, worldY);
  state.dragging.mode = "pendingPan";
  state.dragging.startX = event.clientX;
  state.dragging.startY = event.clientY;
  
  if (isMagnifier) {
      state.dragging.startWorldX = state.magnifier.x;
      state.dragging.startWorldY = state.magnifier.y;
  } else {
      state.dragging.startOffsetX = state.view.offsetX;
      state.dragging.startOffsetY = state.view.offsetY;
  }
  
  state.dragging.pendingSelection = bboxPick
    ? { objectIndex: bboxPick.objectIndex, keypointIndex: -1, corner: null }
    : null;
}

function onMouseMove(event) {
  if (!state.imageBitmap) {
    return;
  }
  
  // Determine context: latched context if dragging, else current target
  const isMagnifier = state.dragging.mode ? state.dragging.isMagnifier : (event.target === magnifierCanvas);
  
  // Get pointer state forcing the determined context
  const pos = getPointerState(event, isMagnifier);
  const { worldX, worldY } = pos;
  
  state.lastMouse.screenX = event.clientX; // Rough global pos for general use
  state.lastMouse.screenY = event.clientY;

  // If not dragging, update hover (using correct context)
  if (!state.dragging.mode) {
    updateHover(worldX, worldY, pos.scale);
    return;
  }

  clearHover();

  if (state.dragging.mode === "pendingPan") {
    const dx = event.clientX - state.dragging.startX;
    const dy = event.clientY - state.dragging.startY;
    if (Math.hypot(dx, dy) < PAN_DRAG_THRESHOLD) {
      return;
    }
    state.dragging.mode = "pan";
    state.dragging.pendingSelection = null;
  }

  if (state.dragging.mode === "pan") {
    const dx = event.clientX - state.dragging.startX;
    const dy = event.clientY - state.dragging.startY;
    
    if (isMagnifier) {
         // Magnifier Pan: move center opposite to drag direction
         const effectiveScale = pos.scale;
         state.magnifier.x = state.dragging.startWorldX - dx / effectiveScale;
         state.magnifier.y = state.dragging.startWorldY - dy / effectiveScale;
    } else {
        // Main Pan
        state.view.offsetX = state.dragging.startOffsetX + dx;
        state.view.offsetY = state.dragging.startOffsetY + dy;
    }
    return;
  }

  if (state.dragging.mode === "newBBox") {
    state.dragging.currentWorldX = worldX;
    state.dragging.currentWorldY = worldY;
    // Follow with magnifier if main drag
    if (!isMagnifier) {
      state.magnifier.x = worldX;
      state.magnifier.y = worldY;
    }
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
    
    // Follow with magnifier if dragging on main
    if (!isMagnifier) {
      state.magnifier.x = worldX;
      state.magnifier.y = worldY;
    }
    
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
    
    // Follow with magnifier if dragging on main
    if (!isMagnifier) {
      state.magnifier.x = worldX;
      state.magnifier.y = worldY;
    }
    
    markDirty();
  }
}

function onDoubleClick(event) {
  if (!state.imageBitmap) {
    return;
  }
  if (event.target === magnifierCanvas) {
    return;
  }
  const pos = getPointerState(event, false);
  if (!isWithinImage(pos.worldX, pos.worldY)) {
    return;
  }
  state.magnifier.active = true;
  if (state.magnifier.minimized) {
    setMagnifierMinimized(false);
  }
  state.magnifier.x = pos.worldX;
  state.magnifier.y = pos.worldY;
}

function onMouseUp(event) {
  // state.magnifierActive = false; // REMOVED: Magnifier stays open
  
  if (state.dragging.mode === "pendingPan") {
    const dx = event.clientX - state.dragging.startX;
    const dy = event.clientY - state.dragging.startY;
    if (Math.hypot(dx, dy) < PAN_DRAG_THRESHOLD) {
      if (state.dragging.pendingSelection) {
        const { objectIndex, keypointIndex, corner } = state.dragging.pendingSelection;
        setSelection(objectIndex, keypointIndex, corner);
      } else {
        clearSelection();
      }
    }
    state.dragging.pendingSelection = null;
    state.dragging.mode = null;
    return;
  }
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
  const zoomFactor = delta > 0 ? 0.85 : 1.15;
  
  const pos = getPointerState(event);
  const { isMagnifier, worldX, worldY } = pos;

  if (!isWithinImage(worldX, worldY)) {
    return;
  }
  
  if (isMagnifier) {
      const rect = magnifierCanvas.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      
      // Calculate min scale to fit the entire image in the magnifier
      const minScaleX = rect.width / state.imageWidth;
      const minScaleY = rect.height / state.imageHeight;
      const minScale = Math.min(minScaleX, minScaleY);

      const currentScale = state.magnifier.scale;
      const nextScale = clamp(currentScale * zoomFactor, minScale, 50);
      
      const newX = worldX - (screenX - rect.width / 2) / nextScale;
      const newY = worldY - (screenY - rect.height / 2) / nextScale;
      
      state.magnifier.scale = nextScale;
      state.magnifier.x = newX;
      state.magnifier.y = newY;
  } else {
      const nextScale = clamp(state.view.scale * zoomFactor, 0.1, 18);
      state.view.scale = nextScale;
      
      const rect = canvas.getBoundingClientRect();
      const localScreenX = event.clientX - rect.left;
      const localScreenY = event.clientY - rect.top;
      
      state.view.scale = nextScale;
      state.view.offsetX = localScreenX - worldX * nextScale;
      state.view.offsetY = localScreenY - worldY * nextScale;
  }
}

function onTouchStart(event) {
  if (!state.imageBitmap) {
    return;
  }
  event.preventDefault();
  const touches = getTouchPoints(event);
  
  if (touches.length === 1) {
    const touch = touches[0];
    const now = Date.now();
    const isMain = !touch.isMagnifier;
    if (isMain && !isWithinImage(touch.worldX, touch.worldY)) {
      state.touch.lastTapTime = 0;
      state.touch.pinchIsMagnifier = false;
      state.dragging.mode = null;
      state.dragging.pendingSelection = null;
      state.dragging.snapshotTaken = false;
      state.touch.mode = "swipeOnly";
      state.touch.swipeEligible = true;
      state.touch.startX = touch.x;
      state.touch.startY = touch.y;
      state.touch.lastX = touch.x;
      state.touch.lastY = touch.y;
      state.touch.startTime = now;
      return;
    }
    if (isMain) {
      const dt = now - state.touch.lastTapTime;
      const dx = touch.x - state.touch.lastTapX;
      const dy = touch.y - state.touch.lastTapY;
      if (dt > 0 && dt < DOUBLE_TAP_MAX_DELAY && Math.hypot(dx, dy) < DOUBLE_TAP_MAX_DISTANCE) {
        state.touch.lastTapTime = 0;
        state.touch.pinchIsMagnifier = false;
        state.touch.mode = null;
        state.dragging.mode = null;
        state.touch.swipeEligible = false;
        state.magnifier.active = true;
        if (state.magnifier.minimized) {
          setMagnifierMinimized(false);
        }
        state.magnifier.x = touch.worldX;
        state.magnifier.y = touch.worldY;
        return;
      }
      state.touch.lastTapTime = now;
      state.touch.lastTapX = touch.x;
      state.touch.lastTapY = touch.y;
    }
    
    clearHover();
    state.dragging.mode = null;
    state.dragging.snapshotTaken = false;
    state.dragging.pendingSelection = null;
    
    state.lastMouse.screenX = touch.x;
    state.lastMouse.screenY = touch.y;

    const scale = touch.isMagnifier ? state.magnifier.scale : state.view.scale;
    const keyPick = pickKeypoint(touch.worldX, touch.worldY, scale);
    if (keyPick) {
      setSelection(keyPick.objectIndex, keyPick.keypointIndex, null);
      state.dragging.mode = "keypoint";
      state.dragging.startWorldX = touch.worldX;
      state.dragging.startWorldY = touch.worldY;
      state.touch.mode = "keypoint";
      state.touch.swipeEligible = false;
      state.magnifier.active = true;
      if (state.magnifier.minimized) {
        setMagnifierMinimized(false);
      }
      if (!touch.isMagnifier) {
        state.magnifier.x = touch.worldX;
        state.magnifier.y = touch.worldY;
      }
      return;
    }

    const cornerPick = pickCorner(touch.worldX, touch.worldY, scale);
    if (cornerPick) {
      setSelection(cornerPick.objectIndex, -1, cornerPick.corner);
      state.dragging.mode = "bboxCorner";
      state.dragging.startCorners = cornerPick.corners;
      state.touch.mode = "bboxCorner";
      state.touch.swipeEligible = false;
      return;
    }

    const bboxPick = pickBBox(touch.worldX, touch.worldY);
    state.dragging.mode = "pendingPan";
    state.dragging.startX = touch.x;
    state.dragging.startY = touch.y;
    
    if (touch.isMagnifier) {
        state.dragging.startWorldX = state.magnifier.x;
        state.dragging.startWorldY = state.magnifier.y;
    } else {
        state.dragging.startOffsetX = state.view.offsetX;
        state.dragging.startOffsetY = state.view.offsetY;
    }
    
    state.dragging.pendingSelection = bboxPick
      ? { objectIndex: bboxPick.objectIndex, keypointIndex: -1, corner: null }
      : null;
    state.touch.mode = "pendingPan";
    state.touch.swipeEligible = !bboxPick && !touch.isMagnifier;
    state.touch.startX = touch.x;
    state.touch.startY = touch.y;
    state.touch.lastX = touch.x;
    state.touch.lastY = touch.y;
    state.touch.startOffsetX = state.view.offsetX;
    state.touch.startOffsetY = state.view.offsetY;
    state.touch.startTime = Date.now();
    return;
  }
  if (touches.length === 2) {
    const dist = touchDistance(touches[0], touches[1]);
    const isMagnifier = touches[0].isMagnifier;
    state.dragging.mode = null;
    state.touch.mode = "pinch";
    state.touch.startDist = dist;
    state.touch.startScale = isMagnifier ? state.magnifier.scale : state.view.scale;
    state.touch.startTime = Date.now();
    state.touch.swipeEligible = false;
    state.touch.pinchIsMagnifier = isMagnifier;
  }
}

function onTouchMove(event) {
  if (!state.imageBitmap || !state.touch.mode) {
    return;
  }
  event.preventDefault();
  const touches = getTouchPoints(event);
  if (touches.length === 1) {
    const touch = touches[0];
    const { worldX, worldY, isMagnifier } = touch;
    state.touch.lastX = touch.x;
    state.touch.lastY = touch.y;
    state.lastMouse.screenX = touch.x;
    state.lastMouse.screenY = touch.y;

    if (state.touch.mode === "swipeOnly") {
      return;
    }

    if (state.touch.mode === "pendingPan") {
      const dx = touch.x - state.dragging.startX;
      const dy = touch.y - state.dragging.startY;
      if (Math.hypot(dx, dy) < PAN_DRAG_THRESHOLD) {
        return;
      }
      state.touch.mode = "pan";
      state.dragging.mode = "pan";
      state.dragging.pendingSelection = null;
    }

    if (state.touch.mode === "pan") {
      const dx = touch.x - state.touch.startX;
      const dy = touch.y - state.touch.startY;
      
      if (isMagnifier) {
          const effectiveScale = state.magnifier.scale;
          state.magnifier.x = state.dragging.startWorldX - dx / effectiveScale;
          state.magnifier.y = state.dragging.startWorldY - dy / effectiveScale;
      } else {
          state.view.offsetX = state.touch.startOffsetX + dx;
          state.view.offsetY = state.touch.startOffsetY + dy;
      }
      return;
    }

    if (state.touch.mode === "keypoint") {
      const annotation = state.annotations[state.selection.objectIndex];
      if (!annotation) {
        return;
      }
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
      if (!isMagnifier) {
          state.magnifier.x = worldX;
          state.magnifier.y = worldY;
      }
      markDirty();
      return;
    }

    if (state.touch.mode === "bboxCorner") {
      const annotation = state.annotations[state.selection.objectIndex];
      if (!annotation) {
        return;
      }
      ensureUndoSnapshot();
      const bbox = annotation.bbox;
      const corners = state.dragging.startCorners;
      if (!corners) {
        return;
      }
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
      if (!isMagnifier) {
          state.magnifier.x = worldX;
          state.magnifier.y = worldY;
      }
      markDirty();
      return;
    }
  }
  if (touches.length === 2) {
    const center = touchCenter(touches[0], touches[1]);
    const dist = touchDistance(touches[0], touches[1]);
    if (!Number.isFinite(dist) || dist <= 0 || state.touch.startDist <= 0) {
      return;
    }
    state.touch.mode = "pinch";
    state.touch.swipeEligible = false;
    if (state.touch.pinchIsMagnifier) {
      if (!magnifierCanvas || state.magnifier.minimized) {
        return;
      }
      const rect = magnifierCanvas.getBoundingClientRect();
      const effectiveScale = state.magnifier.scale;
      const worldX = (center.x - rect.width / 2) / effectiveScale + state.magnifier.x;
      const worldY = (center.y - rect.height / 2) / effectiveScale + state.magnifier.y;
      if (!isWithinImage(worldX, worldY)) {
        return;
      }
      const minScaleX = rect.width / state.imageWidth;
      const minScaleY = rect.height / state.imageHeight;
      const minScale = Math.min(minScaleX, minScaleY);
      const nextScale = clamp(state.touch.startScale * (dist / state.touch.startDist), minScale, 50);
      state.magnifier.scale = nextScale;
      state.magnifier.x = worldX - (center.x - rect.width / 2) / nextScale;
      state.magnifier.y = worldY - (center.y - rect.height / 2) / nextScale;
    } else {
      const worldBefore = screenToWorld(center.x, center.y);
      if (!isWithinImage(worldBefore.x, worldBefore.y)) {
        return;
      }
      const nextScale = clamp(state.touch.startScale * (dist / state.touch.startDist), 0.1, 18);
      state.view.scale = nextScale;
      state.view.offsetX = center.x - worldBefore.x * nextScale;
      state.view.offsetY = center.y - worldBefore.y * nextScale;
    }
  }
}

function onTouchEnd(event) {
  if (!state.imageBitmap || !state.touch.mode) {
    state.magnifierActive = false;
    return;
  }
  event.preventDefault();
  const remainingTouches = getTouchPoints(event);
  if (remainingTouches.length === 0) {
    state.magnifierActive = false;
    state.touch.pinchIsMagnifier = false;
  }
  if (remainingTouches.length === 1) {
    const touch = remainingTouches[0];
    state.touch.mode = "pan";
    state.touch.startX = touch.x;
    state.touch.startY = touch.y;
    state.touch.lastX = touch.x;
    state.touch.lastY = touch.y;
    if (touch.isMagnifier) {
      state.dragging.startWorldX = state.magnifier.x;
      state.dragging.startWorldY = state.magnifier.y;
    } else {
      state.touch.startOffsetX = state.view.offsetX;
      state.touch.startOffsetY = state.view.offsetY;
    }
    state.touch.startTime = Date.now();
    state.dragging.mode = "pan";
    state.touch.pinchIsMagnifier = false;
    return;
  }
  if (remainingTouches.length > 1) {
    return;
  }
  if (state.touch.mode === "pendingPan") {
    const dx = state.touch.lastX - state.touch.startX;
    const dy = state.touch.lastY - state.touch.startY;
    if (Math.hypot(dx, dy) < PAN_DRAG_THRESHOLD) {
      if (state.dragging.pendingSelection) {
        const { objectIndex, keypointIndex, corner } = state.dragging.pendingSelection;
        setSelection(objectIndex, keypointIndex, corner);
      } else {
        clearSelection();
      }
    }
  }
  if ((state.touch.mode === "pan" || state.touch.mode === "swipeOnly")
    && event.changedTouches && event.changedTouches.length) {
    const rect = canvas.getBoundingClientRect();
    const changed = event.changedTouches[0];
    state.touch.lastX = changed.clientX - rect.left;
    state.touch.lastY = changed.clientY - rect.top;
  }
  if ((state.touch.mode === "pan" || state.touch.mode === "swipeOnly") && state.touch.swipeEligible) {
    const dt = Date.now() - state.touch.startTime;
    const dx = state.touch.lastX - state.touch.startX;
    const dy = state.touch.lastY - state.touch.startY;
    if (dt <= TOUCH_SWIPE_MAX_TIME
      && Math.abs(dx) >= TOUCH_SWIPE_THRESHOLD
      && Math.abs(dx) >= Math.abs(dy) * TOUCH_SWIPE_AXIS_RATIO) {
      if (dx > 0) {
        changeImage(state.index - 1);
      } else {
        changeImage(state.index + 1);
      }
    }
  }
  state.dragging.mode = null;
  state.dragging.pendingSelection = null;
  state.dragging.snapshotTaken = false;
  state.touch.mode = null;
  state.touch.swipeEligible = false;
}

function onKeyDown(event) {
  if (event.code === "Escape") {
    if (!loadModal.classList.contains("hidden")) {
      closeModal();
      return;
    }
    if (!helpModal.classList.contains("hidden")) {
      closeHelp();
      return;
    }
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

  if (event.code === "Home") {
    event.preventDefault();
    changeImage(0);
  }

  if (event.code === "End") {
    event.preventDefault();
    changeImage(state.images.length - 1);
  }

  if (event.code === "PageUp") {
    event.preventDefault();
    changeImage(state.index - 100);
  }

  if (event.code === "PageDown") {
    event.preventDefault();
    changeImage(state.index + 100);
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
  const viewState = {
    scale: state.view.scale,
    offsetX: state.view.offsetX,
    offsetY: state.view.offsetY
  };
  const magnifierState = {
    active: state.magnifier.active,
    x: state.magnifier.x,
    y: state.magnifier.y,
    scale: state.magnifier.scale,
    screenX: state.magnifier.screenX,
    screenY: state.magnifier.screenY,
    width: state.magnifier.width,
    height: state.magnifier.height,
    minimized: state.magnifier.minimized,
    restoreWidth: state.magnifier.restoreWidth,
    restoreHeight: state.magnifier.restoreHeight,
    restoreX: state.magnifier.restoreX,
    restoreY: state.magnifier.restoreY
  };
  await loadImage(nextIndex, {
    preserveView: true,
    preserveMagnifier: true,
    viewState,
    magnifierState
  });
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
  const content = serializeLabels();
  if (content === null) {
    return;
  }
  const payload = {
    labelsDir: state.labelsDir,
    file: labelName,
    content
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

function updateHover(worldX, worldY, scale) {
  const pick = pickKeypoint(worldX, worldY, scale);
  if (pick) {
    state.hover.objectIndex = pick.objectIndex;
    state.hover.keypointIndex = pick.keypointIndex;
    state.hover.screenX = state.lastMouse.screenX;
    state.hover.screenY = state.lastMouse.screenY;
    return;
  }
  clearHover();
}

function clearHover() {
  state.hover.objectIndex = -1;
  state.hover.keypointIndex = -1;
}

function getPointerState(event, forcedMagnifier = null) {
  const isMagnifier = forcedMagnifier !== null ? forcedMagnifier : (event.target === magnifierCanvas);
  const target = isMagnifier ? magnifierCanvas : canvas;
  const rect = target.getBoundingClientRect();
  const screenX = event.clientX - rect.left;
  const screenY = event.clientY - rect.top;
  
  if (isMagnifier) {
    const effectiveScale = state.magnifier.scale;
    // worldX = (screenX - width/2) / scale + centerX
    const worldX = (screenX - rect.width / 2) / effectiveScale + state.magnifier.x;
    const worldY = (screenY - rect.height / 2) / effectiveScale + state.magnifier.y;
    return { screenX: event.clientX, screenY: event.clientY, worldX, worldY, scale: effectiveScale, isMagnifier: true };
  }
  
  const world = screenToWorld(screenX, screenY);
  return { screenX: event.clientX, screenY: event.clientY, worldX: world.x, worldY: world.y, scale: state.view.scale, isMagnifier: false };
}

function getMousePos(event) {
  return getPointerState(event);
}

function getTouchPoints(event) {
  const touches = event.touches ? Array.from(event.touches) : [];
  const target = event.target;
  const rect = target.getBoundingClientRect();
  const isMagnifier = target === magnifierCanvas;
  
  return touches.map((touch) => {
    const screenX = touch.clientX - rect.left;
    const screenY = touch.clientY - rect.top;
    
    if (isMagnifier) {
      const effectiveScale = state.magnifier.scale;
      const worldX = (screenX - rect.width / 2) / effectiveScale + state.magnifier.x;
      const worldY = (screenY - rect.height / 2) / effectiveScale + state.magnifier.y;
      return { x: screenX, y: screenY, worldX, worldY, isMagnifier };
    }
    
    const world = screenToWorld(screenX, screenY);
    return { x: screenX, y: screenY, worldX: world.x, worldY: world.y, isMagnifier };
  });
}

function touchDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function touchCenter(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function setStatus(text) {
  state.statusText = text;
}

function getColorScheme() {
  return COLOR_SCHEMES[state.colorSchemeIndex] || COLOR_SCHEMES[0];
}

function getClassColor(classId) {
  const scheme = getColorScheme();
  const colors = scheme && Array.isArray(scheme.classColors) ? scheme.classColors : [];
  const index = Number.isFinite(classId) ? Math.abs(Math.round(classId)) : 0;
  if (colors.length === 0) {
    return "#e4572e";
  }
  return colors[index % colors.length] || "#e4572e";
}

function cycleColorScheme() {
  if (COLOR_SCHEMES.length === 0) {
    return;
  }
  state.colorSchemeIndex = (state.colorSchemeIndex + 1) % COLOR_SCHEMES.length;
  const scheme = getColorScheme();
  setStatus(`Color scheme: ${scheme.name}`);
}

function getWorkspaceRect() {
  if (workspace) {
    return workspace.getBoundingClientRect();
  }
  return { width: window.innerWidth || 0, height: window.innerHeight || 0 };
}

function getOsdLineHeight() {
  if (!osdEl || !window.getComputedStyle) {
    return 18;
  }
  const styles = window.getComputedStyle(osdEl);
  const lineHeight = parseFloat(styles.lineHeight);
  if (Number.isFinite(lineHeight)) {
    return lineHeight;
  }
  const fontSize = parseFloat(styles.fontSize);
  if (Number.isFinite(fontSize)) {
    return fontSize * 1.3;
  }
  return 18;
}

function ensureMagnifierAnchor() {
  if (!Number.isFinite(state.magnifier.width) || state.magnifier.width <= 0) {
    state.magnifier.width = MAGNIFIER_DEFAULT_WIDTH;
  }
  if (!Number.isFinite(state.magnifier.height) || state.magnifier.height <= 0) {
    state.magnifier.height = MAGNIFIER_DEFAULT_HEIGHT;
  }
  if (!Number.isFinite(state.magnifier.restoreWidth) || state.magnifier.restoreWidth <= 0) {
    state.magnifier.restoreWidth = state.magnifier.width;
  }
  if (!Number.isFinite(state.magnifier.restoreHeight) || state.magnifier.restoreHeight <= 0) {
    state.magnifier.restoreHeight = state.magnifier.height;
  }
  if (!Number.isFinite(state.magnifier.restoreX)) {
    state.magnifier.restoreX = state.magnifier.screenX;
  }
  if (!Number.isFinite(state.magnifier.restoreY)) {
    state.magnifier.restoreY = state.magnifier.screenY;
  }
  if (!Number.isFinite(state.magnifier.screenX) || !Number.isFinite(state.magnifier.screenY)) {
    const osdHeight = osdEl ? osdEl.offsetHeight : 100;
    const extraOffset = osdEl ? getOsdLineHeight() * 2 : 0;
    state.magnifier.screenX = 12;
    state.magnifier.screenY = osdHeight + 24 + extraOffset;
  }
}

function clampMagnifierPosition(left, top, width, height) {
  const rect = getWorkspaceRect();
  const maxLeft = Math.max(0, rect.width - width);
  const maxTop = Math.max(0, rect.height - height);
  return {
    left: clamp(left, 0, maxLeft),
    top: clamp(top, 0, maxTop)
  };
}

function clampMagnifierSize(width, height, left, top) {
  const rect = getWorkspaceRect();
  const maxWidth = Math.max(40, rect.width - left);
  const maxHeight = Math.max(40, rect.height - top);
  const minWidth = Math.min(MAGNIFIER_MIN_WIDTH, maxWidth);
  const minHeight = Math.min(MAGNIFIER_MIN_HEIGHT, maxHeight);
  return {
    width: clamp(width, minWidth, maxWidth),
    height: clamp(height, minHeight, maxHeight)
  };
}

function updateMagnifierMinimizeButton() {
  if (!magnifierMinimizeBtn) {
    return;
  }
  if (state.magnifier.minimized) {
    magnifierMinimizeBtn.textContent = "+";
    magnifierMinimizeBtn.title = "Restore magnifier";
    magnifierMinimizeBtn.setAttribute("aria-label", "Restore magnifier");
  } else {
    magnifierMinimizeBtn.textContent = "-";
    magnifierMinimizeBtn.title = "Minimize magnifier";
    magnifierMinimizeBtn.setAttribute("aria-label", "Minimize magnifier");
  }
}

function setMagnifierMinimized(next) {
  state.magnifier.minimized = next;
  if (next) {
    state.magnifier.restoreWidth = state.magnifier.width;
    state.magnifier.restoreHeight = state.magnifier.height;
    state.magnifier.restoreX = state.magnifier.screenX;
    state.magnifier.restoreY = state.magnifier.screenY;
    const rect = getWorkspaceRect();
    const centerX = state.magnifier.screenX + state.magnifier.width / 2;
    if (centerX > rect.width / 2) {
      state.magnifier.screenX = state.magnifier.screenX + state.magnifier.width - MAGNIFIER_MINIMIZED_SIZE;
    }
    state.magnifier.width = MAGNIFIER_MINIMIZED_SIZE;
    state.magnifier.height = MAGNIFIER_MINIMIZED_SIZE;
  } else {
    const restoreWidth = Number.isFinite(state.magnifier.restoreWidth)
      ? state.magnifier.restoreWidth
      : MAGNIFIER_DEFAULT_WIDTH;
    const restoreHeight = Number.isFinite(state.magnifier.restoreHeight)
      ? state.magnifier.restoreHeight
      : MAGNIFIER_DEFAULT_HEIGHT;
    const restoreX = Number.isFinite(state.magnifier.restoreX)
      ? state.magnifier.restoreX
      : state.magnifier.screenX;
    const restoreY = Number.isFinite(state.magnifier.restoreY)
      ? state.magnifier.restoreY
      : state.magnifier.screenY;
    state.magnifier.width = restoreWidth;
    state.magnifier.height = restoreHeight;
    state.magnifier.screenX = restoreX;
    state.magnifier.screenY = restoreY;
  }
  updateMagnifierMinimizeButton();
}

function beginMagnifierDrag(event, mode) {
  if (!state.magnifier.active) {
    return;
  }
  if (state.magnifier.minimized && mode === "resize") {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  ensureMagnifierAnchor();
  const drag = state.magnifier.drag;
  drag.mode = mode;
  drag.pointerId = event.pointerId;
  drag.startX = event.clientX;
  drag.startY = event.clientY;
  drag.startLeft = state.magnifier.screenX;
  drag.startTop = state.magnifier.screenY;
  drag.startWidth = state.magnifier.width;
  drag.startHeight = state.magnifier.height;
  drag.target = event.currentTarget;
  if (drag.target && drag.target.setPointerCapture) {
    drag.target.setPointerCapture(event.pointerId);
  }
}

function onMagnifierDragMove(event) {
  const drag = state.magnifier.drag;
  if (!drag || !drag.mode) {
    return;
  }
  if (drag.pointerId !== null && event.pointerId !== drag.pointerId) {
    return;
  }
  event.preventDefault();
  if (drag.mode === "move") {
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const nextLeft = drag.startLeft + dx;
    const nextTop = drag.startTop + dy;
    const clamped = clampMagnifierPosition(nextLeft, nextTop, state.magnifier.width, state.magnifier.height);
    state.magnifier.screenX = clamped.left;
    state.magnifier.screenY = clamped.top;
    return;
  }
  if (drag.mode === "resize") {
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const rawWidth = drag.startWidth + dx;
    const rawHeight = drag.startHeight + dy;
    const nextSize = clampMagnifierSize(rawWidth, rawHeight, drag.startLeft, drag.startTop);
    state.magnifier.width = nextSize.width;
    state.magnifier.height = nextSize.height;
    if (!state.magnifier.minimized) {
      state.magnifier.restoreWidth = state.magnifier.width;
      state.magnifier.restoreHeight = state.magnifier.height;
    }
  }
}

function endMagnifierDrag(event) {
  const drag = state.magnifier.drag;
  if (!drag || !drag.mode) {
    return;
  }
  if (drag.pointerId !== null && event.pointerId !== drag.pointerId) {
    return;
  }
  event.preventDefault();
  if (drag.target && drag.target.releasePointerCapture) {
    drag.target.releasePointerCapture(drag.pointerId);
  }
  drag.mode = null;
  drag.pointerId = null;
  drag.target = null;
}

function updateMagnifier() {
  if (!state.imageBitmap || !magnifierCanvas || !magCtx || !state.magnifier.active) {
    if (magnifier) magnifier.classList.add("hidden");
    return;
  }

  magnifier.classList.remove("hidden");
  magnifier.classList.toggle("minimized", state.magnifier.minimized);
  
  const selectedAnn = state.annotations[state.selection.objectIndex];
  if (selectedAnn) {
    magnifier.style.borderColor = getClassColor(selectedAnn.classId);
  } else {
    magnifier.style.borderColor = "var(--accent)";
  }
  
  ensureMagnifierAnchor();
  let width = state.magnifier.width;
  let height = state.magnifier.height;
  if (state.magnifier.minimized) {
    width = MAGNIFIER_MINIMIZED_SIZE;
    height = MAGNIFIER_MINIMIZED_SIZE;
    state.magnifier.width = width;
    state.magnifier.height = height;
  } else {
    const nextSize = clampMagnifierSize(width, height, state.magnifier.screenX, state.magnifier.screenY);
    width = nextSize.width;
    height = nextSize.height;
    state.magnifier.width = width;
    state.magnifier.height = height;
    state.magnifier.restoreWidth = width;
    state.magnifier.restoreHeight = height;
  }
  const clamped = clampMagnifierPosition(state.magnifier.screenX, state.magnifier.screenY, width, height);
  state.magnifier.screenX = clamped.left;
  state.magnifier.screenY = clamped.top;

  magnifier.style.width = `${width}px`;
  magnifier.style.height = `${height}px`;
  magnifier.style.left = `${state.magnifier.screenX}px`;
  magnifier.style.top = `${state.magnifier.screenY}px`;

  if (state.magnifier.minimized) {
    return;
  }

  const rect = magnifier.getBoundingClientRect();
  if (magnifierCanvas.width !== rect.width || magnifierCanvas.height !== rect.height) {
    magnifierCanvas.width = rect.width;
    magnifierCanvas.height = rect.height;
  }

  magCtx.setTransform(1, 0, 0, 1, 0, 0);
  magCtx.clearRect(0, 0, rect.width, rect.height);
  magCtx.fillStyle = "#fff";
  magCtx.fillRect(0, 0, rect.width, rect.height);

  const effectiveScale = state.magnifier.scale;
  
  const worldX = state.magnifier.x;
  const worldY = state.magnifier.y;

  const transX = -worldX * effectiveScale + rect.width / 2;
  const transY = -worldY * effectiveScale + rect.height / 2;

  magCtx.imageSmoothingEnabled = false;
  magCtx.setTransform(effectiveScale, 0, 0, effectiveScale, transX, transY);
  magCtx.drawImage(state.imageBitmap, 0, 0);

  const visible = getVisibleIndices();
  for (const idx of visible) {
    const annotation = state.annotations[idx];
    if (!annotation) {
      continue;
    }
    drawAnnotation(magCtx, effectiveScale, annotation, idx === state.selection.objectIndex);
  }

  if (state.dragging.mode === "newBBox") {
    drawNewBBox(magCtx, effectiveScale);
  }

  magCtx.setTransform(1, 0, 0, 1, 0, 0);
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const crossSize = 15;
  
  magCtx.strokeStyle = "rgba(0,0,0,0.5)";
  magCtx.lineWidth = 3;
  magCtx.beginPath();
  magCtx.moveTo(cx - crossSize, cy);
  magCtx.lineTo(cx + crossSize, cy);
  magCtx.moveTo(cx, cy - crossSize);
  magCtx.lineTo(cx, cy + crossSize);
  magCtx.stroke();

  magCtx.strokeStyle = "rgba(255,255,255,0.8)";
  magCtx.lineWidth = 1;
  magCtx.beginPath();
  magCtx.moveTo(cx - crossSize, cy);
  magCtx.lineTo(cx + crossSize, cy);
  magCtx.moveTo(cx, cy - crossSize);
  magCtx.lineTo(cx, cy + crossSize);
  magCtx.stroke();
  
}

function pickThreshold(scale) {
  return 10 / scale;
}

function pickKeypoint(worldX, worldY, scale) {
  const radius = pickThreshold(scale);
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
      const kx = kp.x * state.imageWidth;
      const ky = kp.y * state.imageHeight;
      const dist = Math.hypot(worldX - kx, worldY - ky);
      if (dist <= radius) {
        return { objectIndex: idx, keypointIndex: k };
      }
    }
  }
  return null;
}

function pickCorner(worldX, worldY, scale) {
  const radius = pickThreshold(scale);
  const order = buildPickOrder();
  for (const idx of order) {
    const ann = state.annotations[idx];
    if (!ann) {
      continue;
    }
    const corners = bboxCorners(ann.bbox);
    for (const corner of ["tl", "tr", "bl", "br"]) {
      const cornerPos = corners[corner];
      const dist = Math.hypot(worldX - cornerPos.x, worldY - cornerPos.y);
      if (dist <= radius) {
        return { objectIndex: idx, corner, corners };
      }
    }
  }
  return null;
}

function pickBBox(worldX, worldY) {
  const order = buildPickOrder();
  for (const idx of order) {
    const ann = state.annotations[idx];
    if (!ann) {
      continue;
    }
    const { x, y, w, h } = bboxToPixels(ann.bbox);
    if (worldX >= x && worldX <= x + w && worldY >= y && worldY <= y + h) {
      return { objectIndex: idx };
    }
  }
  return null;
}

init();
