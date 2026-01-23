const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const imagesDirInput = document.getElementById("imagesDir");
const labelsDirInput = document.getElementById("labelsDir");
const imagesDirList = document.getElementById("imagesDirList");
const labelsDirList = document.getElementById("labelsDirList");
const openModalBtn = document.getElementById("openModalBtn");
const openHelpBtn = document.getElementById("openHelpBtn");
const deleteBtn = document.getElementById("deleteBtn");
const undoBtn = document.getElementById("undoBtn");
const markBtn = document.getElementById("markBtn");
const cropBtn = document.getElementById("cropBtn");
const confirmLoadBtn = document.getElementById("confirmLoadBtn");
const loadModal = document.getElementById("loadModal");
const helpModal = document.getElementById("helpModal");
const deleteModal = document.getElementById("deleteModal");
const markModal = document.getElementById("markModal");
const cropModal = document.getElementById("cropModal");
const historyModal = document.getElementById("historyModal");
const prevImageBtn = document.getElementById("prevImageBtn");
const nextImageBtn = document.getElementById("nextImageBtn");
const browseImagesBtn = document.getElementById("browseImagesBtn");
const browseLabelsBtn = document.getElementById("browseLabelsBtn");
const folderPicker = document.getElementById("folderPicker");
const folderPickerModal = document.getElementById("folderPickerModal");
const pickerList = document.getElementById("pickerList");
const pickerCurrentPath = document.getElementById("pickerCurrentPath");
const pickerBackBtn = document.getElementById("pickerBackBtn");
const pickerTitle = document.getElementById("pickerTitle");
const pickerCancelBtn = document.getElementById("pickerCancelBtn");
const pickerSelectBtn = document.getElementById("pickerSelectBtn");
const osdEl = document.getElementById("osd");
const osdTextEl = document.getElementById("osdText");
const osdMinimizeBtn = document.getElementById("osdMinimize");
const labelsSection = document.getElementById("labelsSection");
const magnifier = document.getElementById("magnifier");
const magnifierCanvas = document.getElementById("magnifierCanvas");
const magCtx = magnifierCanvas ? magnifierCanvas.getContext("2d") : null;
const magnifierMoveHandle = document.getElementById("magnifierMove");
const magnifierResizeHandle = document.getElementById("magnifierResize");
const magnifierMinimizeBtn = document.getElementById("magnifierMinimize");
const workspace = document.querySelector(".workspace");
const deleteAnnotationsBtn = document.getElementById("deleteAnnotationsBtn");
const deleteImageBtn = document.getElementById("deleteImageBtn");
const deleteCancelBtn = document.getElementById("deleteCancelBtn");
const markCurrentDoneBtn = document.getElementById("markCurrentDoneBtn");
const markCurrentTodoBtn = document.getElementById("markCurrentTodoBtn");
const markFolderDoneBtn = document.getElementById("markFolderDoneBtn");
const markFolderTodoBtn = document.getElementById("markFolderTodoBtn");
const markCancelBtn = document.getElementById("markCancelBtn");
const cropAspect11Btn = document.getElementById("cropAspect11Btn");
const cropAspect12Btn = document.getElementById("cropAspect12Btn");
const cropAspect23Btn = document.getElementById("cropAspect23Btn");
const cropAspect34Btn = document.getElementById("cropAspect34Btn");
const cropAspect169Btn = document.getElementById("cropAspect169Btn");
const cropCancelBtn = document.getElementById("cropCancelBtn");
const restoreInitialBtn = document.getElementById("restoreInitialBtn");
const restoreLatestBtn = document.getElementById("restoreLatestBtn");
const historyCancelBtn = document.getElementById("historyCancelBtn");

let loadRequestId = 0;
let loadAbortController = null;
let pickerActiveTarget = null;
let pickerCurrentPathVal = "";
let pickerSelectedPath = "";

const MAX_RECENTS = 10;
const MAX_UNDO = 512;

const DEFAULT_KPT_COUNT = (typeof Labels !== "undefined" && Number.isFinite(Labels.DEFAULT_KPT_COUNT))
  ? Labels.DEFAULT_KPT_COUNT
  : 17;
const POSE_FORMATS = {
  yolo11_pose: {
    label: "yolo11-pose",
    count: 17,
    keypointNames: [
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
    ],
    skeleton: [
      [0, 1], [0, 2], [1, 3], [2, 4],
      [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
      [5, 11], [6, 12], [11, 12],
      [11, 13], [13, 15], [12, 14], [14, 16]
    ]
  },
  mpii_pose: {
    label: "mpii_pose",
    count: 16,
    keypointNames: [
      "right ankle",
      "right knee",
      "right hip",
      "left hip",
      "left knee",
      "left ankle",
      "pelvis",
      "thorax",
      "upper neck",
      "head top",
      "right wrist",
      "right elbow",
      "right shoulder",
      "left shoulder",
      "left elbow",
      "left wrist"
    ],
    skeleton: [
      [0, 1], [1, 2], [2, 6], [6, 3], [3, 4], [4, 5],
      [6, 7], [7, 12], [12, 11], [11, 10],
      [7, 13], [13, 14], [14, 15],
      [7, 8], [8, 9]
    ]
  }
};
const DEFAULT_POSE_FORMAT = "yolo11_pose";

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
const CROP_DASH_PX = 6;
const CROP_GAP_PX = 4;
const CROP_FILL_COLOR = "rgba(10, 10, 10, 0.08)";
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
  imageOverride: "",
  restoreImageRel: "",
  imageVersions: {},
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
  lastSelectedKeypointIndex: -1,
  keypointCount: DEFAULT_KPT_COUNT,
  colorSchemeIndex: 0,
  lastMouse: {
    screenX: null,
    screenY: null,
    isMagnifier: false
  },
  hover: {
    objectIndex: -1,
    keypointIndex: -1,
    screenX: 0,
    screenY: 0,
    isMagnifier: false
  },
  crop: {
    active: false,
    bbox: null
  },
  baseCrop: {
    active: false,
    bbox: null
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
    cropCorner: null,
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
    },
    minimizeDrag: {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      moved: false,
      target: null
    },
    ignoreMinimizeClick: false
  },
  spaceDown: false,
  dirty: false,
  modifiedSinceLoad: false,
  undoStack: [],
  osdCache: "",
  osdMinimized: false,
  statusText: "Idle",
  loadingImage: false,
  pendingIndex: null,
  cachedViewState: null,
  cachedMagnifierState: null,
  reviewDone: new Set()
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

  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      handleDeleteRequest();
    });
  }
  if (undoBtn) {
    undoBtn.addEventListener("click", () => {
      undo();
    });
  }
  if (markBtn) {
    markBtn.addEventListener("click", () => {
      openMarkModal();
    });
  }
  if (cropBtn) {
    cropBtn.addEventListener("click", () => {
      openCropModal();
    });
  }

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
    applyPickerSelection();
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

  if (prevImageBtn) {
    prevImageBtn.addEventListener("click", () => {
      changeImage(getActiveIndex() - 1);
    });
  }

  if (nextImageBtn) {
    nextImageBtn.addEventListener("click", () => {
      changeImage(getActiveIndex() + 1);
    });
  }

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
  if (magnifier) {
    magnifier.addEventListener("pointerdown", (event) => beginMagnifierMinimizedDrag(event), { capture: true });
  }
  if (magnifierMinimizeBtn) {
    magnifierMinimizeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (state.magnifier.ignoreMinimizeClick) {
        state.magnifier.ignoreMinimizeClick = false;
        return;
      }
      setMagnifierMinimized(!state.magnifier.minimized);
    });
  }
  if (osdMinimizeBtn) {
    osdMinimizeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setOsdMinimized(!state.osdMinimized);
    });
  }

  loadModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target && target.dataset && target.dataset.close) {
      closeModal();
    }
  });

  if (folderPickerModal) {
    folderPickerModal.addEventListener("click", (event) => {
      const target = event.target;
      if (target && target.dataset && target.dataset.close) {
        closePicker();
      }
    });
  }

  if (deleteModal) {
    deleteModal.addEventListener("click", (event) => {
      const target = event.target;
      if (target && target.dataset && target.dataset.close) {
        closeDeleteModal();
      }
    });
  }
  if (markModal) {
    markModal.addEventListener("click", (event) => {
      const target = event.target;
      if (target && target.dataset && target.dataset.close) {
        closeMarkModal();
      }
    });
  }
  if (cropModal) {
    cropModal.addEventListener("click", (event) => {
      const target = event.target;
      if (target && target.dataset && target.dataset.close) {
        closeCropModal();
      }
    });
  }
  if (historyModal) {
    historyModal.addEventListener("click", (event) => {
      const target = event.target;
      if (target && target.dataset && target.dataset.close) {
        closeHistoryModal();
      }
    });
  }

  if (deleteCancelBtn) {
    deleteCancelBtn.addEventListener("click", () => {
      closeDeleteModal();
    });
  }
  if (markCancelBtn) {
    markCancelBtn.addEventListener("click", () => {
      closeMarkModal();
    });
  }
  if (cropCancelBtn) {
    cropCancelBtn.addEventListener("click", () => {
      closeCropModal();
    });
  }
  if (historyCancelBtn) {
    historyCancelBtn.addEventListener("click", () => {
      closeHistoryModal();
    });
  }

  if (deleteAnnotationsBtn) {
    deleteAnnotationsBtn.addEventListener("click", () => {
      closeDeleteModal();
      deleteAllAnnotations();
    });
  }

  if (deleteImageBtn) {
    deleteImageBtn.addEventListener("click", () => {
      closeDeleteModal();
      deleteCurrentImageAndLabels();
    });
  }

  if (markCurrentDoneBtn) {
    markCurrentDoneBtn.addEventListener("click", async () => {
      closeMarkModal();
      await markCurrentReviewStatus("Done", { autoAdvance: true });
    });
  }
  if (markCurrentTodoBtn) {
    markCurrentTodoBtn.addEventListener("click", async () => {
      closeMarkModal();
      await markCurrentReviewStatus("TODO", { autoAdvance: true });
    });
  }
  if (markFolderDoneBtn) {
    markFolderDoneBtn.addEventListener("click", async () => {
      closeMarkModal();
      await markFolderReviewStatus("Done");
    });
  }
  if (markFolderTodoBtn) {
    markFolderTodoBtn.addEventListener("click", async () => {
      closeMarkModal();
      await markFolderReviewStatus("TODO");
    });
  }
  if (cropAspect11Btn) {
    cropAspect11Btn.addEventListener("click", () => {
      closeCropModal();
      applyAspectCrop(1, 1);
    });
  }
  if (cropAspect12Btn) {
    cropAspect12Btn.addEventListener("click", () => {
      closeCropModal();
      applyAspectCrop(1, 2);
    });
  }
  if (cropAspect23Btn) {
    cropAspect23Btn.addEventListener("click", () => {
      closeCropModal();
      applyAspectCrop(2, 3);
    });
  }
  if (cropAspect34Btn) {
    cropAspect34Btn.addEventListener("click", () => {
      closeCropModal();
      applyAspectCrop(3, 4);
    });
  }
  if (cropAspect169Btn) {
    cropAspect169Btn.addEventListener("click", () => {
      closeCropModal();
      applyAspectCrop(16, 9);
    });
  }
  if (restoreInitialBtn) {
    restoreInitialBtn.addEventListener("click", async () => {
      closeHistoryModal();
      await restoreFromHistory("initial");
    });
  }
  if (restoreLatestBtn) {
    restoreLatestBtn.addEventListener("click", async () => {
      closeHistoryModal();
      await restoreFromHistory("latest");
    });
  }

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
  updateImageNav();
  updateMagnifierMinimizeButton();
  updateOsdMinimizeButton();
  updateOsd();
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

function openDeleteModal() {
  if (!deleteModal) {
    return;
  }
  deleteModal.classList.remove("hidden");
  deleteModal.setAttribute("aria-hidden", "false");
}

function openMarkModal() {
  if (!markModal) {
    return;
  }
  if (!state.images.length) {
    setStatus("No images loaded.");
    return;
  }
  markModal.classList.remove("hidden");
  markModal.setAttribute("aria-hidden", "false");
}

function openCropModal() {
  if (!cropModal) {
    return;
  }
  if (!state.images.length) {
    setStatus("No images loaded.");
    return;
  }
  cropModal.classList.remove("hidden");
  cropModal.setAttribute("aria-hidden", "false");
}

function openHistoryModal() {
  if (!historyModal) {
    return;
  }
  if (!state.images.length) {
    setStatus("No images loaded.");
    return;
  }
  historyModal.classList.remove("hidden");
  historyModal.setAttribute("aria-hidden", "false");
}

function closeDeleteModal() {
  if (!deleteModal) {
    return;
  }
  deleteModal.classList.add("hidden");
  deleteModal.setAttribute("aria-hidden", "true");
}

function closeMarkModal() {
  if (!markModal) {
    return;
  }
  markModal.classList.add("hidden");
  markModal.setAttribute("aria-hidden", "true");
}

function closeCropModal() {
  if (!cropModal) {
    return;
  }
  cropModal.classList.add("hidden");
  cropModal.setAttribute("aria-hidden", "true");
}

function closeHistoryModal() {
  if (!historyModal) {
    return;
  }
  historyModal.classList.add("hidden");
  historyModal.setAttribute("aria-hidden", "true");
}

async function openPicker(target, title) {
  pickerActiveTarget = target;
  if (pickerTitle) {
    pickerTitle.textContent = title || "Select Directory";
  }
  if (folderPickerModal) {
    folderPickerModal.classList.remove("hidden");
    folderPickerModal.setAttribute("aria-hidden", "false");
  } else {
    folderPicker.classList.remove("hidden");
  }
  let startPath = target.value.trim();
  pickerSelectedPath = startPath;
  await navigatePicker(startPath);
}

function applyPickerSelection(overridePath) {
  if (!pickerActiveTarget) {
    return;
  }
  const val = overridePath || pickerSelectedPath || pickerCurrentPathVal;
  pickerActiveTarget.value = val;
  if (pickerActiveTarget === imagesDirInput) {
    checkLabelsVisibility();
    suggestLabels(val);
  }
  closePicker();
}

function closePicker() {
  if (folderPickerModal) {
    folderPickerModal.classList.add("hidden");
    folderPickerModal.setAttribute("aria-hidden", "true");
  } else {
    folderPicker.classList.add("hidden");
  }
  pickerActiveTarget = null;
}

async function navigatePicker(targetPath) {
  let bitmap = null;
  let bitmapAttached = false;
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

    let clickTimer = null;
    let lastTapTime = 0;
    let suppressClick = false;
    const selectFolder = () => {
      pickerSelectedPath = fullPath;
      // Update UI highlights
      Array.from(pickerList.children).forEach(c => c.classList.remove("selected"));
      item.classList.add("selected");
      updateSelectBtnText();
    };
    const commitSelection = () => {
      selectFolder();
      applyPickerSelection(fullPath);
    };

    item.addEventListener("click", () => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (clickTimer) {
        clearTimeout(clickTimer);
      }
      clickTimer = setTimeout(() => {
        clickTimer = null;
        if (dir.hasSubdirs) {
          navigatePicker(fullPath);
        } else {
          // Select this folder without entering
          selectFolder();
        }
      }, 240);
    });

    item.addEventListener("dblclick", (event) => {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      event.preventDefault();
      commitSelection();
    });

    item.addEventListener("pointerup", (event) => {
      if (event.pointerType !== "touch") {
        return;
      }
      const now = performance.now();
      if (now - lastTapTime < 300) {
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
        }
        suppressClick = true;
        commitSelection();
        lastTapTime = 0;
        return;
      }
      lastTapTime = now;
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

  setStatus("Loading image list...");
  try {
    const listUrl = `/api/list?imagesDir=${encodeURIComponent(imagesDir)}&labelsDir=${encodeURIComponent(labelsDir)}`;
    const response = await fetch(listUrl);
    if (!response.ok) {
      throw new Error("Unable to list images");
    }
    const data = await response.json();
    const images = data.images || [];
    const labelFiles = Number.isFinite(data.labelFiles)
      ? data.labelFiles
      : images.reduce((count, entry) => count + (entry.labelExists ? 1 : 0), 0);
    const warnings = [];
    if (images.length === 0) {
      warnings.push("No images found in the Images Dir.");
    }
    if (labelFiles === 0) {
      warnings.push("No label files found in the Labels Dir.");
    }
    if (warnings.length > 0) {
      const message = `${warnings.join(" ")}\n\nSelect Cancel to change folders, or OK to load anyway.`;
      const proceed = window.confirm(message);
      if (!proceed) {
        setStatus("Update directories and try again.");
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

    state.images = images;
    state.imageVersions = {};
    await loadReviewStatus(labelsDir);
    state.keypointCount = DEFAULT_KPT_COUNT;
    if (state.images.length === 0) {
      setStatus("No images found in the directory.");
      state.loadingImage = false;
      state.pendingIndex = null;
      state.imageBitmap = null;
      state.imageWidth = 0;
      state.imageHeight = 0;
      state.imageName = "";
      state.annotations = [];
      state.baseAnnotations = [];
      state.crop = { active: false, bbox: null };
      state.baseCrop = { active: false, bbox: null };
      state.undoStack = [];
      state.dirty = false;
      state.modifiedSinceLoad = false;
      updateImageNav();
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
  
  if (loadAbortController) {
    loadAbortController.abort();
  }
  loadAbortController = new AbortController();
  const signal = loadAbortController.signal;

  const currentRequestId = ++loadRequestId;

  const preserveView = options && options.preserveView;
  const preserveMagnifier = options && options.preserveMagnifier;
  const viewState = options && options.viewState;
  const magnifierState = options && options.magnifierState;
  const entry = state.images[index];
  state.imageOverride = "";
  state.restoreImageRel = "";
  state.loadingImage = true;
  state.dragging.mode = null;
  state.dragging.pendingSelection = null;
  state.dragging.snapshotTaken = false;
  state.touch.mode = null;
  state.touch.swipeEligible = false;

  setStatus(`Loading ${entry.name}...`);

  try {
    const version = state.imageVersions[entry.name] || 0;
    const imageUrl = `/api/image?imagesDir=${encodeURIComponent(state.imagesDir)}&file=${encodeURIComponent(entry.name)}&v=${version}`;
    const imageResponse = await fetch(imageUrl, { signal });
    if (!imageResponse.ok) {
      throw new Error("Unable to load image");
    }
    const blob = await imageResponse.blob();
    
    if (loadRequestId !== currentRequestId) {
      return;
    }

    bitmap = await createImageBitmap(blob);

    if (loadRequestId !== currentRequestId) {
      bitmap.close();
      bitmap = null;
      return;
    }

    const labelName = `${stripExt(entry.name)}.txt`;
    const labelUrl = `/api/labels?labelsDir=${encodeURIComponent(state.labelsDir)}&file=${encodeURIComponent(labelName)}`;
    const labelResponse = await fetch(labelUrl, { signal });
    
    if (loadRequestId !== currentRequestId) {
      bitmap.close();
      bitmap = null;
      return;
    }

    if (!labelResponse.ok) {
      throw new Error("Unable to load labels");
    }
    const labelText = await labelResponse.text();
    const annotations = parseLabels(labelText);
    const keypointCount = inferKeypointCount(annotations, state.keypointCount);

    if (state.imageBitmap) {
        state.imageBitmap.close();
    }

    state.index = index;
    state.imageName = entry.name;
    state.imageBitmap = bitmap;
    bitmapAttached = true;
    state.imageWidth = bitmap.width;
    state.imageHeight = bitmap.height;
    state.annotations = annotations;
    state.keypointCount = keypointCount;
    state.baseAnnotations = cloneAnnotations(annotations);
    state.selection = { objectIndex: -1, keypointIndex: -1, corner: null };
    state.hover = { objectIndex: -1, keypointIndex: -1, screenX: 0, screenY: 0, isMagnifier: false };
    state.crop = { active: false, bbox: null };
    state.baseCrop = { active: false, bbox: null };
    state.dirty = false;
    state.modifiedSinceLoad = false;
    state.undoStack = [];
    if (preserveView && viewState) {
      if (Number.isFinite(viewState.relX)
        && Number.isFinite(viewState.relY)
        && Number.isFinite(viewState.scale)
        && state.imageWidth > 0) {
        state.view.scale = viewState.scale;
        const newCx = viewState.relX * state.imageWidth;
        const newCy = viewState.relY * state.imageHeight;
        state.view.offsetX = (state.canvasSize.width / 2) - newCx * state.view.scale;
        state.view.offsetY = (state.canvasSize.height / 2) - newCy * state.view.scale;
      } else if (Number.isFinite(viewState.scale)
        && Number.isFinite(viewState.offsetX)
        && Number.isFinite(viewState.offsetY)) {
        state.view.scale = viewState.scale;
        state.view.offsetX = viewState.offsetX;
        state.view.offsetY = viewState.offsetY;
      } else {
        fitImage();
      }
    } else {
      fitImage();
    }
    if (preserveMagnifier && magnifierState) {
      state.magnifier.active = magnifierState.active;
      if (Number.isFinite(magnifierState.relX)
        && Number.isFinite(magnifierState.relY)
        && state.imageWidth > 0) {
        state.magnifier.x = magnifierState.relX * state.imageWidth;
        state.magnifier.y = magnifierState.relY * state.imageHeight;
      } else {
        state.magnifier.x = magnifierState.x;
        state.magnifier.y = magnifierState.y;
      }
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

      // Auto-center magnifier on target keypoint with object-switch fallbacks.
      if (state.magnifier.active
        && magnifierState.targetKeypointIndex !== undefined) {
        const targetObj = state.annotations.find((ann) => ann.classId === 0);
        if (targetObj) {
          const targetIdx = findNearestValidKeypointIndex(
            targetObj,
            magnifierState.targetKeypointIndex
          );
          if (targetIdx !== -1) {
            const kp = targetObj.keypoints[targetIdx];
            state.magnifier.x = kp.x * state.imageWidth;
            state.magnifier.y = kp.y * state.imageHeight;
          } else {
            centerMagnifierOnObject(targetObj);
          }
        }
      }

      updateMagnifierMinimizeButton();
    }
    setStatus(`${entry.name} (${state.index + 1}/${state.images.length})`);
    
    // Update cached state on successful full load
    state.cachedViewState = null;
    state.cachedMagnifierState = null;

  } catch (error) {
    if (error.name === "AbortError") {
        return;
    }
    if (loadRequestId === currentRequestId) {
        setStatus(`Error: ${error.message}`);
    }
  } finally {
    if (bitmap && !bitmapAttached) {
      bitmap.close();
    }
    if (loadRequestId === currentRequestId) {
        state.loadingImage = false;
        state.pendingIndex = null;
        updateImageNav();
    }
  }
}

async function loadImageBitmap(file) {
  if (!state.imagesDir || !file) {
    return;
  }
  const version = state.imageVersions[file] || 0;
  const imageUrl = `/api/image?imagesDir=${encodeURIComponent(state.imagesDir)}&file=${encodeURIComponent(file)}&v=${version}`;
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error("Unable to load image");
  }
  const blob = await imageResponse.blob();
  const bitmap = await createImageBitmap(blob);
  if (state.imageBitmap) {
    state.imageBitmap.close();
  }
  state.imageBitmap = bitmap;
  state.imageWidth = bitmap.width;
  state.imageHeight = bitmap.height;
  fitImage();
}

function applyHistoryCrop(crop) {
  if (!crop || !state.imageWidth || !state.imageHeight) {
    state.crop = { active: false, bbox: null };
    return;
  }
  const cx = (crop.x + crop.w / 2) / state.imageWidth;
  const cy = (crop.y + crop.h / 2) / state.imageHeight;
  const w = crop.w / state.imageWidth;
  const h = crop.h / state.imageHeight;
  state.crop = {
    active: true,
    bbox: {
      cx: clamp(cx, 0, 1),
      cy: clamp(cy, 0, 1),
      w: clamp(w, 0, 1),
      h: clamp(h, 0, 1)
    }
  };
}

async function loadLabelHistory() {
  if (!state.labelsDir || !state.imageName) {
    return null;
  }
  const labelName = `${stripExt(state.imageName)}.txt`;
  const historyUrl = `/api/labels_history?labelsDir=${encodeURIComponent(state.labelsDir)}&file=${encodeURIComponent(labelName)}`;
  const response = await fetch(historyUrl);
  if (!response.ok) {
    return null;
  }
  return response.json();
}

async function restoreFromHistory(kind) {
  if (!state.imagesDir || !state.labelsDir || !state.imageName) {
    setStatus("No image loaded.");
    return;
  }
  const history = await loadLabelHistory();
  if (!history || !history[kind] || typeof history[kind].content !== "string") {
    setStatus("No history available for this image.");
    return;
  }
  const entry = history[kind];
  const nextAnnotations = parseLabels(entry.content);
  const nextKeypointCount = inferKeypointCount(nextAnnotations, state.keypointCount);
  const imageRel = entry.imageRel || "";

  try {
    if (imageRel) {
      await loadImageBitmap(imageRel);
      state.imageOverride = imageRel;
      state.restoreImageRel = imageRel;
    } else if (state.imageOverride) {
      await loadImageBitmap(state.imageName);
      state.imageOverride = "";
      state.restoreImageRel = "";
    } else {
      state.restoreImageRel = "";
    }
  } catch (error) {
    setStatus(`History image error: ${error.message}`);
    return;
  }

  state.annotations = nextAnnotations;
  state.keypointCount = nextKeypointCount;
  state.selection = { objectIndex: -1, keypointIndex: -1, corner: null };
  state.hover = { objectIndex: -1, keypointIndex: -1, screenX: 0, screenY: 0, isMagnifier: false };
  state.undoStack = [];
  if (kind === "initial") {
    applyHistoryCrop(entry.crop || null);
  } else {
    applyHistoryCrop(null);
  }
  clearSelection();
  markDirty();
  setStatus(`Restored ${kind} labels (unsaved).`);
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

function getPoseFormatByCount(count) {
  if (count === POSE_FORMATS.mpii_pose.count) {
    return POSE_FORMATS.mpii_pose;
  }
  return POSE_FORMATS[DEFAULT_POSE_FORMAT];
}

function inferKeypointCount(annotations, fallbackCount) {
  const fallback = Number.isFinite(fallbackCount) ? fallbackCount : DEFAULT_KPT_COUNT;
  let seenMpii = false;
  for (const ann of annotations) {
    if (!ann || !Array.isArray(ann.keypoints)) {
      continue;
    }
    const count = ann.keypoints.length;
    if (count === POSE_FORMATS.yolo11_pose.count) {
      return count;
    }
    if (count === POSE_FORMATS.mpii_pose.count) {
      seenMpii = true;
    }
  }
  return seenMpii ? POSE_FORMATS.mpii_pose.count : fallback;
}

function getAnnotationKeypointCount(annotation) {
  if (!annotation || !Array.isArray(annotation.keypoints)) {
    return state.keypointCount;
  }
  const count = annotation.keypoints.length;
  if (annotation.hasPose && (count === POSE_FORMATS.yolo11_pose.count || count === POSE_FORMATS.mpii_pose.count)) {
    return count;
  }
  return state.keypointCount;
}

function getPoseFormatForAnnotation(annotation) {
  return getPoseFormatByCount(getAnnotationKeypointCount(annotation));
}

function getKeypointName(annotation, index) {
  const names = getPoseFormatForAnnotation(annotation).keypointNames;
  return names[index] || `kp ${index + 1}`;
}

function getSkeletonForAnnotation(annotation) {
  return getPoseFormatForAnnotation(annotation).skeleton;
}

function createEmptyKeypoints(count = state.keypointCount) {
  const points = [];
  const total = Number.isFinite(count) ? count : DEFAULT_KPT_COUNT;
  for (let i = 0; i < total; i += 1) {
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

function serializeLabelsFor(annotations) {
  if (!ensureLabelsModule()) {
    return null;
  }
  return Labels.serializeLabels(annotations);
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
    if (state.crop.active && state.dragging.mode !== "newCrop") {
      drawCrop(ctx, viewScale);
    }
    if (state.dragging.mode === "newCrop") {
      drawNewCrop(ctx, viewScale);
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

function drawCrop(ctx, scale) {
  if (!state.crop.active || !state.crop.bbox) {
    return;
  }
  const { x, y, w, h } = cropToPixels(state.crop.bbox);
  if (w < 1 || h < 1) {
    return;
  }
  drawCropBox(ctx, scale, x, y, w, h);
}

function drawNewCrop(ctx, scale) {
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
  drawCropBox(ctx, scale, x, y, w, h);
}

function drawCropBox(ctx, scale, x, y, w, h) {
  const dash = toWorldSize(CROP_DASH_PX, scale);
  const gap = toWorldSize(CROP_GAP_PX, scale);
  ctx.save();
  ctx.fillStyle = CROP_FILL_COLOR;
  ctx.fillRect(x, y, w, h);
  ctx.lineWidth = toWorldSize(2, scale);
  ctx.setLineDash([dash, gap]);
  ctx.strokeStyle = "#0b0b0b";
  ctx.lineDashOffset = 0;
  ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = toWorldSize(1, scale);
  ctx.strokeStyle = "#fef6e8";
  ctx.lineDashOffset = dash / 2;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
  drawCropCorners(ctx, scale, x, y, w, h);
}

function drawCropCorners(ctx, scale, x, y, w, h) {
  const size = toWorldSize(8, scale);
  const corners = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h]
  ];
  ctx.save();
  ctx.fillStyle = "#fef6e8";
  ctx.strokeStyle = "#0b0b0b";
  ctx.lineWidth = toWorldSize(1, scale);
  for (const [cx, cy] of corners) {
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);
  }
  ctx.restore();
}

function drawSkeleton(ctx, scale, annotation, isActive) {
  const scheme = getColorScheme();
  ctx.strokeStyle = isActive ? scheme.skeleton.active : scheme.skeleton.inactive;
  ctx.lineWidth = toWorldSize(isActive ? 2 : 1, scale);
  const skeleton = getSkeletonForAnnotation(annotation);
  for (const [a, b] of skeleton) {
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

function parseColorToRgb(color) {
  if (typeof color !== "string") {
    return null;
  }
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r, g, b };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return { r, g, b };
    }
  }
  const match = trimmed.match(/^rgba?\((.+)\)$/i);
  if (match) {
    const parts = match[1].split(",").map((part) => part.trim());
    if (parts.length >= 3) {
      const read = (value) => {
        if (value.endsWith("%")) {
          return Math.round(parseFloat(value) * 2.55);
        }
        return Math.round(parseFloat(value));
      };
      const r = read(parts[0]);
      const g = read(parts[1]);
      const b = read(parts[2]);
      if ([r, g, b].every((n) => Number.isFinite(n))) {
        return { r, g, b };
      }
    }
  }
  return null;
}

function getContrastColor(color) {
  const rgb = parseColorToRgb(color);
  if (!rgb) {
    return "#ffffff";
  }
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? "#111111" : "#ffffff";
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
    const outerRadius = radius + toWorldSize(1, scale);
    ctx.beginPath();
    const visColor = scheme.visColors[kp.v] || scheme.visColors[2];
    const lineWidth = toWorldSize(isSelected ? 4 : 1.5, scale);
    ctx.arc(pos.x, pos.y, outerRadius, 0, Math.PI * 2);
    ctx.strokeStyle = getContrastColor(visColor);
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = visColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
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

function drawHoverLabelOn(targetCtx, width, height, dpr) {
  const { objectIndex, keypointIndex } = state.hover;
  if (objectIndex < 0 || keypointIndex < 0) {
    return;
  }
  const annotation = state.annotations[objectIndex];
  const kp = annotation ? annotation.keypoints[keypointIndex] : null;
  const visibility = kp ? clampVisibility(kp.v) : 0;
  const name = getKeypointName(annotation, keypointIndex);
  const label = `${name}:${visibility}`;
  targetCtx.save();
  targetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  targetCtx.font = "15px 'Space Grotesk', 'Trebuchet MS', sans-serif";
  targetCtx.textAlign = "left";
  targetCtx.textBaseline = "top";
  const paddingX = 7.5;
  const paddingY = 3.75;
  const textWidth = targetCtx.measureText(label).width;
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
  targetCtx.fillStyle = "rgba(29, 28, 26, 0.9)";
  targetCtx.fillRect(boxX, boxY, boxWidth, boxHeight);
  targetCtx.fillStyle = "#fef6e8";
  targetCtx.fillText(label, boxX + paddingX, boxY + paddingY);
  targetCtx.restore();
}

function drawHoverLabel() {
  if (state.hover.isMagnifier) {
    return;
  }
  const { dpr, width, height } = state.canvasSize;
  drawHoverLabelOn(ctx, width, height, dpr);
}

function drawMagnifierHoverLabel() {
  if (!state.hover.isMagnifier) {
    return;
  }
  if (!magnifierCanvas || !magCtx || state.magnifier.minimized) {
    return;
  }
  if (magnifierCanvas.width <= 0 || magnifierCanvas.height <= 0) {
    return;
  }
  drawHoverLabelOn(magCtx, magnifierCanvas.width, magnifierCanvas.height, 1);
}

function buildOsdSummaryLine() {
  const totalFiles = state.images.length;
  const fileIndex = totalFiles > 0 ? state.index + 1 : 0;
  const totalObjects = state.annotations.length;
  const base = `File ${fileIndex}/${totalFiles}`;
  const objIndex = state.selection.objectIndex;
  const obj = state.annotations[objIndex];
  if (!obj) {
    return `${base} Objs ${totalObjects}`;
  }
  let suffix = `Obj ${objIndex}/${totalObjects}`;
  if (obj.hasPose) {
    const totalKpts = obj.keypoints.length;
    if (state.selection.keypointIndex >= 0 && totalKpts > 0) {
      const kpIndex = Math.min(state.selection.keypointIndex, totalKpts - 1);
      suffix += ` Kpt ${kpIndex}/${totalKpts}`;
    } else {
      suffix += ` Kpts ${totalKpts}`;
    }
  } else {
    suffix += " Kpts 0";
  }
  return `${base} ${suffix}`;
}

function getImageFolderPath() {
  if (!state.imageName) {
    return "-";
  }
  const slashIndex = state.imageName.lastIndexOf("/");
  const backslashIndex = state.imageName.lastIndexOf("\\");
  const sepIndex = Math.max(slashIndex, backslashIndex);
  const relDir = sepIndex >= 0 ? state.imageName.slice(0, sepIndex) : "";
  const baseDir = state.imagesDir || "";
  if (!baseDir && !relDir) {
    return "-";
  }
  if (!baseDir) {
    return relDir || "-";
  }
  if (!relDir) {
    return baseDir;
  }
  const useBackslash = baseDir.includes("\\");
  const sep = useBackslash ? "\\" : "/";
  const normalizedRel = useBackslash ? relDir.replaceAll("/", "\\") : relDir.replaceAll("\\", "/");
  const trimmedBase = (baseDir.endsWith("/") || baseDir.endsWith("\\")) ? baseDir.slice(0, -1) : baseDir;
  const trimmedRel = (normalizedRel.startsWith("/") || normalizedRel.startsWith("\\")) ? normalizedRel.slice(1) : normalizedRel;
  return `${trimmedBase}${sep}${trimmedRel}`;
}

function updateOsd() {
  if (!osdEl || !osdTextEl) {
    return;
  }
  const fileLine = state.imageName ? `File: ${state.imageName}` : "File: -";
  const folderLine = `Folder: ${getImageFolderPath()}`;
  const todoCount = Math.max(0, state.images.length - state.reviewDone.size);
  const countLine = state.images.length
    ? `Index: ${state.index + 1}/${state.images.length} TODO: ${todoCount}`
    : "Index: 0/0 TODO: 0";
  const resLine = state.imageWidth && state.imageHeight
    ? `Resolution: ${state.imageWidth}x${state.imageHeight}`
    : "Resolution: -";
  let cropLine = "";
  if (state.crop.active && state.crop.bbox && state.imageWidth && state.imageHeight) {
    const cropPixels = cropToPixels(state.crop.bbox);
    if (cropPixels) {
      const cropW = Math.max(0, Math.round(cropPixels.w));
      const cropH = Math.max(0, Math.round(cropPixels.h));
      cropLine = `Crop: ${cropW}x${cropH}px`;
    }
  }
  
  let zoomLine = `Zoom: ${Math.round(state.view.scale * 100)}%`;
  if (state.magnifier.active) {
    zoomLine += ` (${Math.round(state.magnifier.scale * 100)}%)`;
  }

  const statusLine = `Status: ${state.statusText}`;
  const reviewStatus = state.imageName ? getReviewStatusForImage(state.imageName) : "-";
  const modLine = `Modified: ${state.modifiedSinceLoad ? "Yes" : "No"}, ${reviewStatus}`;
  const objectsLines = buildObjectLines();
  const selectedLines = buildSelectedLines();
  const lines = [
    fileLine,
    folderLine,
    countLine,
    resLine,
    ...(cropLine ? [cropLine] : []),
    zoomLine,
    statusLine,
    modLine,
    ...objectsLines,
    ...selectedLines
  ];
  const text = state.osdMinimized ? buildOsdSummaryLine() : lines.join("\n");
  if (text !== state.osdCache) {
    osdTextEl.textContent = text;
    state.osdCache = text;
  }
  osdEl.classList.toggle("minimized", state.osdMinimized);
}

function updateImageNav() {
  if (!prevImageBtn || !nextImageBtn) {
    return;
  }
  const total = state.images.length;
  const hasImages = total > 0;
  prevImageBtn.disabled = !hasImages || state.index <= 0;
  nextImageBtn.disabled = !hasImages || state.index >= total - 1;
}

function getReviewStatusForImage(imageName) {
  if (!imageName) {
    return "TODO";
  }
  return state.reviewDone.has(imageName) ? "Done" : "TODO";
}

function isTodoImage(imageEntry) {
  if (!imageEntry) {
    return false;
  }
  return !state.reviewDone.has(imageEntry.name);
}

function setReviewStatusForImage(imageName, status) {
  if (!imageName) {
    return;
  }
  if (status === "Done") {
    state.reviewDone.add(imageName);
  } else {
    state.reviewDone.delete(imageName);
  }
}

async function loadReviewStatus(labelsDir) {
  state.reviewDone = new Set();
  if (!labelsDir) {
    return;
  }
  try {
    const response = await fetch(`/api/review_status?labelsDir=${encodeURIComponent(labelsDir)}`);
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    const done = Array.isArray(data.done) ? data.done : [];
    const available = new Set(state.images.map((entry) => entry.name));
    state.reviewDone = new Set(
      done.map((entry) => String(entry)).filter((entry) => available.has(entry))
    );
  } catch (error) {
    console.error("Review status load error:", error);
  }
}

async function saveReviewStatus() {
  if (!state.labelsDir) {
    return false;
  }
  const payload = {
    labelsDir: state.labelsDir,
    done: Array.from(state.reviewDone)
  };
  try {
    const response = await fetch("/api/review_status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return response.ok;
  } catch (error) {
    console.error("Review status save error:", error);
    return false;
  }
}

function findNextTodoIndex(startIndex, step) {
  const total = state.images.length;
  if (total === 0) {
    return -1;
  }
  const direction = step >= 0 ? 1 : -1;
  for (let i = 0; i < total; i += 1) {
    const idx = (startIndex + i * direction + total) % total;
    if (isTodoImage(state.images[idx])) {
      return idx;
    }
  }
  return -1;
}

function navigateTodo(step) {
  if (state.images.length === 0) {
    return;
  }
  const current = getActiveIndex();
  const startIndex = current + (step >= 0 ? 1 : -1);
  const nextIndex = findNextTodoIndex(startIndex, step);
  if (nextIndex === -1) {
    setStatus("No TODO images.");
    return;
  }
  changeImage(nextIndex);
}

async function markCurrentReviewStatus(status, options = {}) {
  if (!state.imageName) {
    setStatus("No image loaded.");
    return;
  }
  if (state.dirty) {
    await saveLabels({ skipReviewUpdate: true });
    if (state.dirty) {
      setStatus("Save failed. Review status not updated.");
      return;
    }
  }
  setReviewStatusForImage(state.imageName, status);
  const saved = await saveReviewStatus();
  if (!saved) {
    setStatus("Unable to save review status.");
    return;
  }
  setStatus(`Marked ${state.imageName} ${status}.`);
  if (options.autoAdvance) {
    navigateTodo(1);
  }
}

async function markFolderReviewStatus(status) {
  if (state.images.length === 0) {
    setStatus("No images loaded.");
    return;
  }
  if (status === "Done") {
    state.images.forEach((entry) => {
      setReviewStatusForImage(entry.name, "Done");
    });
  } else {
    state.reviewDone.clear();
  }
  const saved = await saveReviewStatus();
  if (!saved) {
    setStatus("Unable to save review status.");
    return;
  }
  setStatus(`Marked folder ${status}.`);
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
      const name = getKeypointName(obj, state.selection.keypointIndex);
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

function cropToPixels(bbox) {
  if (!bbox) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  return bboxToPixels(bbox);
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
  if (!state.imageBitmap || state.loadingImage) {
    return;
  }
  
  const pos = getPointerState(event);
  const { worldX, worldY, isMagnifier } = pos;
  state.lastMouse.screenX = pos.screenX;
  state.lastMouse.screenY = pos.screenY;
  state.lastMouse.isMagnifier = pos.isMagnifier;

  if (!isMagnifier && !isWithinImage(worldX, worldY)) {
    return;
  }

  state.dragging.snapshotTaken = false;
  state.dragging.pendingSelection = null;
  state.dragging.cropCorner = null;
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

  if (event.altKey) {
    state.dragging.mode = "newCrop";
    state.dragging.startWorldX = worldX;
    state.dragging.startWorldY = worldY;
    state.dragging.currentWorldX = worldX;
    state.dragging.currentWorldY = worldY;
    state.dragging.startX = event.clientX;
    state.dragging.startY = event.clientY;
    return;
  }

  if (event.ctrlKey) {
    state.dragging.mode = "ctrlPending";
    state.dragging.startWorldX = worldX;
    state.dragging.startWorldY = worldY;
    state.dragging.currentWorldX = worldX;
    state.dragging.currentWorldY = worldY;
    state.dragging.startX = event.clientX;
    state.dragging.startY = event.clientY;
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
    if (!isMagnifier) {
      state.magnifier.x = worldX;
      state.magnifier.y = worldY;
    }
    return;
  }

  const cropPick = pickCropCorner(worldX, worldY, pos.scale);
  if (cropPick) {
    state.dragging.mode = "cropCorner";
    state.dragging.startCorners = cropPick.corners;
    state.dragging.cropCorner = cropPick.corner;
    state.dragging.startX = event.clientX;
    state.dragging.startY = event.clientY;
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
  if (!state.imageBitmap || state.loadingImage) {
    return;
  }
  
  // Determine context: latched context if dragging, else current target
  const isMagnifier = state.dragging.mode ? state.dragging.isMagnifier : (event.target === magnifierCanvas);
  
  // Get pointer state forcing the determined context
  const pos = getPointerState(event, isMagnifier);
  const { worldX, worldY } = pos;
  
  state.lastMouse.screenX = pos.screenX;
  state.lastMouse.screenY = pos.screenY;
  state.lastMouse.isMagnifier = pos.isMagnifier;

  // If not dragging, update hover (using correct context)
  if (!state.dragging.mode) {
    updateHover(worldX, worldY, pos.scale, pos.screenX, pos.screenY, pos.isMagnifier);
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

  if (state.dragging.mode === "ctrlPending") {
    const dx = event.clientX - state.dragging.startX;
    const dy = event.clientY - state.dragging.startY;
    if (Math.hypot(dx, dy) < PAN_DRAG_THRESHOLD) {
      return;
    }
    state.dragging.mode = "newBBox";
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

  if (state.dragging.mode === "newCrop") {
    state.dragging.currentWorldX = worldX;
    state.dragging.currentWorldY = worldY;
    return;
  }

  if (state.dragging.mode === "cropCorner") {
    if (!state.crop.bbox || !state.dragging.startCorners) {
      return;
    }
    ensureUndoSnapshot();
    const nx = clamp(worldX / state.imageWidth, 0, 1);
    const ny = clamp(worldY / state.imageHeight, 0, 1);
    const updated = updateCorners(
      state.dragging.startCorners,
      state.dragging.cropCorner,
      nx,
      ny,
      { keepAspect: event.shiftKey }
    );
    const minX = clamp(Math.min(updated.x1, updated.x2), 0, 1);
    const maxX = clamp(Math.max(updated.x1, updated.x2), 0, 1);
    const minY = clamp(Math.min(updated.y1, updated.y2), 0, 1);
    const maxY = clamp(Math.max(updated.y1, updated.y2), 0, 1);
    state.crop.bbox = {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      w: Math.max(0.0001, maxX - minX),
      h: Math.max(0.0001, maxY - minY)
    };
    state.crop.active = true;
    markDirty();
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
    const updated = updateCorners(
      corners,
      state.selection.corner,
      nx,
      ny,
      { keepAspect: event.shiftKey }
    );
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

function onDoubleClick(event) {
  if (!state.imageBitmap || state.loadingImage) {
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
  if (state.dragging.mode === "ctrlPending") {
    const pos = getPointerState(event, state.dragging.isMagnifier);
    if (state.selection.objectIndex >= 0) {
      const addedIndex = addKeypointAt(
        state.selection.objectIndex,
        pos.worldX,
        pos.worldY,
        pos.screenX,
        pos.screenY,
        pos.isMagnifier
      );
      if (addedIndex >= 0) {
        state.magnifier.active = true;
        if (!state.dragging.isMagnifier) {
          state.magnifier.x = pos.worldX;
          state.magnifier.y = pos.worldY;
        }
      }
    }
    state.dragging.mode = null;
    return;
  }
  if (state.dragging.mode === "newCrop") {
    finishNewCrop(event);
    state.dragging.mode = null;
    state.dragging.cropCorner = null;
    return;
  }
  if (state.dragging.mode === "cropCorner") {
    state.dragging.cropCorner = null;
  }
  state.dragging.mode = null;
}

function onWheel(event) {
  if (!state.imageBitmap || state.loadingImage) {
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
  if (!state.imageBitmap || state.loadingImage) {
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
    state.lastMouse.isMagnifier = touch.isMagnifier;

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
  if (!state.imageBitmap || state.loadingImage || !state.touch.mode) {
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
    state.lastMouse.isMagnifier = touch.isMagnifier;

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
  if (!state.imageBitmap || state.loadingImage || !state.touch.mode) {
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
        changeImage(getActiveIndex() - 1);
      } else {
        changeImage(getActiveIndex() + 1);
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
    if (folderPickerModal && !folderPickerModal.classList.contains("hidden")) {
      closePicker();
      return;
    }
    if (!loadModal.classList.contains("hidden")) {
      closeModal();
      return;
    }
    if (!helpModal.classList.contains("hidden")) {
      closeHelp();
      return;
    }
    if (deleteModal && !deleteModal.classList.contains("hidden")) {
      closeDeleteModal();
      return;
    }
    if (markModal && !markModal.classList.contains("hidden")) {
      closeMarkModal();
      return;
    }
    if (cropModal && !cropModal.classList.contains("hidden")) {
      closeCropModal();
      return;
    }
    if (historyModal && !historyModal.classList.contains("hidden")) {
      closeHistoryModal();
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

  if (event.code === "KeyD" && event.ctrlKey) {
    event.preventDefault();
    markCurrentReviewStatus("Done", { autoAdvance: true });
    return;
  }

  if (event.code === "KeyA" && event.ctrlKey) {
    event.preventDefault();
    markCurrentReviewStatus("TODO", { autoAdvance: true });
    return;
  }

  if (event.code === "Space") {
    state.spaceDown = true;
    event.preventDefault();
  }

  if (event.code === "KeyA") {
    event.preventDefault();
    changeImage(getActiveIndex() - 1);
  }

  if (event.code === "KeyD") {
    event.preventDefault();
    navigateTodo(1);
  }

  if (event.code === "ArrowLeft") {
    event.preventDefault();
    changeImage(getActiveIndex() - 1);
  }

  if (event.code === "ArrowRight") {
    event.preventDefault();
    changeImage(getActiveIndex() + 1);
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
    changeImage(getActiveIndex() - 100);
  }

  if (event.code === "PageDown") {
    event.preventDefault();
    changeImage(getActiveIndex() + 100);
  }

  if (event.code === "KeyV") {
    cycleVisibility();
  }

  if (event.code === "KeyB") {
    event.preventDefault();
    cycleColorScheme();
  }

  if (event.code === "KeyC" || event.code === "ArrowDown") {
    event.preventDefault();
    selectNextObject();
  }

  if (event.code === "KeyZ" || event.code === "ArrowUp") {
    event.preventDefault();
    selectPrevObject();
  }

  if (event.code === "KeyX") {
    event.preventDefault();
    if (state.selection.keypointIndex >= 0) {
      setSelection(state.selection.objectIndex, -1, null);
    } else {
      clearSelection();
    }
  }

  if (event.code === "Delete" || event.code === "KeyF") {
    handleDeleteRequest();
  }

  if (isPlusKey(event) || event.code === "KeyE") {
    event.preventDefault();
    handlePlusMinus(1);
  }

  if (isMinusKey(event) || event.code === "KeyQ") {
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
  state.lastSelectedKeypointIndex = nextIndex;
  showKeypointHover(state.selection.objectIndex, nextIndex);
  markDirty();
}

function ensureKeypoints(annotation) {
  if (!annotation.keypoints) {
    annotation.keypoints = [];
  }
  const count = getAnnotationKeypointCount(annotation);
  for (let i = annotation.keypoints.length; i < count; i += 1) {
    annotation.keypoints.push({ x: 0, y: 0, v: 0 });
  }
  if (annotation.keypoints.length > count) {
    annotation.keypoints.length = count;
  }
}

function findFirstAvailableKeypointIndex(annotation) {
  ensureKeypoints(annotation);
  const count = getAnnotationKeypointCount(annotation);

  if (state.lastSelectedKeypointIndex >= 0) {
    for (let i = state.lastSelectedKeypointIndex + 1; i < count; i++) {
      const kp = annotation.keypoints[i];
      if (kp && kp.v === 0) {
        return i;
      }
    }
  }

  for (let i = 0; i < count; i += 1) {
    const kp = annotation.keypoints[i];
    if (kp && kp.v === 0) {
      return i;
    }
  }
  return -1;
}

function findNextAvailableKeypointIndex(annotation, currentIndex, step) {
  ensureKeypoints(annotation);
  const count = getAnnotationKeypointCount(annotation);
  for (let offset = 1; offset <= count; offset += 1) {
    const idx = (currentIndex + step * offset + count) % count;
    const kp = annotation.keypoints[idx];
    if (kp && kp.v === 0) {
      return idx;
    }
  }
  return -1;
}

function addKeypointAt(objectIndex, worldX, worldY, screenX, screenY, isMagnifier) {
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
  showKeypointHover(objectIndex, nextIndex, screenX, screenY, isMagnifier);
  markDirty();
  return nextIndex;
}

function showKeypointHover(objectIndex, keypointIndex, screenX, screenY, isMagnifier) {
  const annotation = state.annotations[objectIndex];
  const kp = annotation ? annotation.keypoints[keypointIndex] : null;
  if (!kp) {
    return;
  }
  let hoverX = screenX;
  let hoverY = screenY;
  let hoverIsMagnifier = !!isMagnifier;
  if (!Number.isFinite(hoverX) || !Number.isFinite(hoverY)) {
    hoverX = state.lastMouse.screenX;
    hoverY = state.lastMouse.screenY;
    hoverIsMagnifier = !!state.lastMouse.isMagnifier;
  }
  if (!Number.isFinite(hoverX) || !Number.isFinite(hoverY)) {
    if (hoverIsMagnifier && magnifierCanvas && state.magnifier.active && !state.magnifier.minimized) {
      const width = magnifierCanvas.width;
      const height = magnifierCanvas.height;
      if (width > 0 && height > 0) {
        const worldX = kp.x * state.imageWidth;
        const worldY = kp.y * state.imageHeight;
        hoverX = (worldX - state.magnifier.x) * state.magnifier.scale + width / 2;
        hoverY = (worldY - state.magnifier.y) * state.magnifier.scale + height / 2;
      }
    }
  }
  if (!Number.isFinite(hoverX) || !Number.isFinite(hoverY)) {
    const pos = worldToScreen(kp.x * state.imageWidth, kp.y * state.imageHeight);
    hoverX = pos.x;
    hoverY = pos.y;
    hoverIsMagnifier = false;
  }
  state.hover.objectIndex = objectIndex;
  state.hover.keypointIndex = keypointIndex;
  state.hover.screenX = hoverX;
  state.hover.screenY = hoverY;
  state.hover.isMagnifier = hoverIsMagnifier;
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

function finishNewCrop(event) {
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
  pushUndo();
  const minX = clamp(Math.min(startX, endX) / state.imageWidth, 0, 1);
  const maxX = clamp(Math.max(startX, endX) / state.imageWidth, 0, 1);
  const minY = clamp(Math.min(startY, endY) / state.imageHeight, 0, 1);
  const maxY = clamp(Math.max(startY, endY) / state.imageHeight, 0, 1);
  state.crop.bbox = {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    w: Math.max(0.0001, maxX - minX),
    h: Math.max(0.0001, maxY - minY)
  };
  state.crop.active = true;
  markDirty();
}

function applyAspectCrop(widthRatio, heightRatio) {
  if (!Number.isFinite(widthRatio) || !Number.isFinite(heightRatio) || heightRatio <= 0 || widthRatio <= 0) {
    return;
  }
  if (!state.imageWidth || !state.imageHeight) {
    return;
  }
  const bounds = getAnnotationBoundsPixels();
  if (!bounds) {
    return;
  }
  const aspect = widthRatio / heightRatio;
  const cropRect = pickAspectCropRect(bounds, aspect, 0.1);
  if (!cropRect) {
    return;
  }
  pushUndo();
  state.crop.bbox = {
    cx: (cropRect.x + cropRect.w / 2) / state.imageWidth,
    cy: (cropRect.y + cropRect.h / 2) / state.imageHeight,
    w: Math.max(0.0001, cropRect.w / state.imageWidth),
    h: Math.max(0.0001, cropRect.h / state.imageHeight)
  };
  state.crop.active = true;
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

function handleDeleteRequest() {
  if (state.selection.objectIndex >= 0) {
    deleteSelection();
    return;
  }
  openDeleteModal();
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

function deleteAllAnnotations() {
  if (!state.imageName) {
    setStatus("No image loaded.");
    return;
  }
  if (state.annotations.length === 0) {
    setStatus("No annotations to delete.");
    return;
  }
  pushUndo();
  state.annotations = [];
  clearSelection();
  markDirty();
}

async function deleteCurrentImageAndLabels() {
  if (!state.imagesDir || !state.imageName) {
    setStatus("No image loaded.");
    return;
  }
  const payload = {
    imagesDir: state.imagesDir,
    labelsDir: state.labelsDir,
    file: state.imageName
  };
  try {
    const response = await fetch("/api/delete_image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error("Delete failed");
    }
    const deletedName = state.imageName;
    const removedIndex = state.index;
    state.images.splice(removedIndex, 1);
    state.reviewDone.delete(deletedName);
    await saveReviewStatus();
    state.dirty = false;
    state.modifiedSinceLoad = false;
    state.undoStack = [];
    clearSelection();

    if (state.images.length === 0) {
      state.loadingImage = false;
      state.pendingIndex = null;
      state.imageBitmap = null;
      state.imageWidth = 0;
      state.imageHeight = 0;
      state.imageName = "";
      state.annotations = [];
      state.baseAnnotations = [];
      updateImageNav();
      setStatus(`Deleted ${deletedName} (archived). No images left.`);
      return;
    }
    const nextIndex = Math.min(removedIndex, state.images.length - 1);
    await changeImage(nextIndex);
    setStatus(`Deleted ${deletedName} (archived).`);
  } catch (error) {
    setStatus(`Delete error: ${error.message}`);
  }
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

function cloneCropState(crop) {
  if (!crop || !crop.active || !crop.bbox) {
    return { active: false, bbox: null };
  }
  return {
    active: true,
    bbox: {
      cx: crop.bbox.cx,
      cy: crop.bbox.cy,
      w: crop.bbox.w,
      h: crop.bbox.h
    }
  };
}

function pushUndo() {
  state.undoStack.push({
    annotations: cloneAnnotations(state.annotations),
    crop: cloneCropState(state.crop)
  });
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
    openHistoryModal();
    return;
  }
  const snapshot = state.undoStack.pop();
  if (Array.isArray(snapshot)) {
    state.annotations = snapshot;
  } else {
    state.annotations = snapshot.annotations || [];
    state.crop = cloneCropState(snapshot.crop);
  }
  clearSelection();
  if (annotationsEqual(state.annotations, state.baseAnnotations)
    && cropEqual(state.crop, state.baseCrop)) {
    state.dirty = false;
    state.modifiedSinceLoad = false;
    setStatus(`${state.imageName} (${state.index + 1}/${state.images.length})`);
    return;
  }
  markDirty();
}

function cropEqual(left, right) {
  const lActive = left && left.active && left.bbox;
  const rActive = right && right.active && right.bbox;
  if (!lActive && !rActive) {
    return true;
  }
  if (!lActive || !rActive) {
    return false;
  }
  return bboxEqual(left.bbox, right.bbox);
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

function getActiveIndex() {
  return Number.isFinite(state.pendingIndex) ? state.pendingIndex : state.index;
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

  const cvsW = state.canvasSize.width;
  const cvsH = state.canvasSize.height;

  let viewState = null;
  let magnifierState = null;

  if (state.imageBitmap && state.imageWidth > 0 && state.imageHeight > 0) {
    const oldW = state.imageWidth;
    const oldH = state.imageHeight;

    // View Center in World
    const viewCx = (cvsW / 2 - state.view.offsetX) / state.view.scale;
    const viewCy = (cvsH / 2 - state.view.offsetY) / state.view.scale;

    viewState = {
      relX: viewCx / oldW,
      relY: viewCy / oldH,
      scale: state.view.scale,
      offsetX: state.view.offsetX,
      offsetY: state.view.offsetY
    };
    magnifierState = {
      active: state.magnifier.active,
      relX: state.magnifier.x / oldW,
      relY: state.magnifier.y / oldH,
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
      restoreY: state.magnifier.restoreY,
      targetKeypointIndex: -1
    };

    if (state.magnifier.active) {
      let bestKpIdx = -1;
      let minD2 = Infinity;
      const mx = state.magnifier.x;
      const my = state.magnifier.y;

      state.annotations.forEach((ann) => {
        ann.keypoints.forEach((kp, idx) => {
          if (kp.v > 0) {
            const kx = kp.x * state.imageWidth;
            const ky = kp.y * state.imageHeight;
            const d2 = (kx - mx) ** 2 + (ky - my) ** 2;
            if (d2 < minD2) {
              minD2 = d2;
              bestKpIdx = idx;
            }
          }
        });
      });
      magnifierState.targetKeypointIndex = bestKpIdx;
    }

    state.cachedViewState = viewState;
    state.cachedMagnifierState = magnifierState;
  } else {
    viewState = state.cachedViewState;
    magnifierState = state.cachedMagnifierState;
  }

  state.pendingIndex = nextIndex;
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

function getAnnotationBoundsPixels() {
  if (!state.imageWidth || !state.imageHeight) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const includePoint = (px, py) => {
    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      return;
    }
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  };
  for (const ann of state.annotations) {
    if (!ann) {
      continue;
    }
    if (ann.bbox) {
      const { x, y, w, h } = bboxToPixels(ann.bbox);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h)) {
        const x2 = x + w;
        const y2 = y + h;
        includePoint(Math.min(x, x2), Math.min(y, y2));
        includePoint(Math.max(x, x2), Math.max(y, y2));
      }
    }
    if (Array.isArray(ann.keypoints)) {
      for (const kp of ann.keypoints) {
        if (!kp || kp.v <= 0) {
          continue;
        }
        includePoint(kp.x * state.imageWidth, kp.y * state.imageHeight);
      }
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  minX = clamp(minX, 0, state.imageWidth);
  minY = clamp(minY, 0, state.imageHeight);
  maxX = clamp(maxX, 0, state.imageWidth);
  maxY = clamp(maxY, 0, state.imageHeight);
  if (maxX - minX < 1) {
    const centerX = clamp(minX, 0, state.imageWidth);
    minX = clamp(centerX - 0.5, 0, Math.max(0, state.imageWidth - 1));
    maxX = Math.min(state.imageWidth, minX + 1);
  }
  if (maxY - minY < 1) {
    const centerY = clamp(minY, 0, state.imageHeight);
    minY = clamp(centerY - 0.5, 0, Math.max(0, state.imageHeight - 1));
    maxY = Math.min(state.imageHeight, minY + 1);
  }
  if (maxX <= minX || maxY <= minY) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}

function distributePadding(availableBefore, availableAfter, totalPad) {
  if (!Number.isFinite(totalPad) || totalPad <= 0) {
    return { before: 0, after: 0 };
  }
  const half = totalPad / 2;
  let before = Math.min(Math.max(availableBefore, 0), half);
  let after = Math.min(Math.max(availableAfter, 0), half);
  let leftover = totalPad - (before + after);
  if (leftover <= 0) {
    return { before, after };
  }
  let roomBefore = Math.max(availableBefore - before, 0);
  let roomAfter = Math.max(availableAfter - after, 0);
  if (roomAfter >= roomBefore) {
    const extraAfter = Math.min(roomAfter, leftover);
    after += extraAfter;
    leftover -= extraAfter;
  } else {
    const extraBefore = Math.min(roomBefore, leftover);
    before += extraBefore;
    leftover -= extraBefore;
  }
  if (leftover > 0) {
    roomBefore = Math.max(availableBefore - before, 0);
    roomAfter = Math.max(availableAfter - after, 0);
    if (roomAfter > 0) {
      const extraAfter = Math.min(roomAfter, leftover);
      after += extraAfter;
      leftover -= extraAfter;
    } else if (roomBefore > 0) {
      const extraBefore = Math.min(roomBefore, leftover);
      before += extraBefore;
      leftover -= extraBefore;
    }
  }
  return { before, after };
}

function expandBoundsWithPadding(bounds, paddingScale) {
  if (!bounds) {
    return null;
  }
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width <= 0 || height <= 0) {
    return null;
  }
  const totalPadX = Math.max(0, width * paddingScale);
  const totalPadY = Math.max(0, height * paddingScale);
  const leftSpace = Math.max(0, bounds.minX);
  const rightSpace = Math.max(0, state.imageWidth - bounds.maxX);
  const topSpace = Math.max(0, bounds.minY);
  const bottomSpace = Math.max(0, state.imageHeight - bounds.maxY);
  const padX = Math.min(totalPadX, leftSpace + rightSpace);
  const padY = Math.min(totalPadY, topSpace + bottomSpace);
  const { before: padLeft, after: padRight } = distributePadding(leftSpace, rightSpace, padX);
  const { before: padTop, after: padBottom } = distributePadding(topSpace, bottomSpace, padY);
  const minX = clamp(bounds.minX - padLeft, 0, state.imageWidth);
  const maxX = clamp(bounds.maxX + padRight, 0, state.imageWidth);
  const minY = clamp(bounds.minY - padTop, 0, state.imageHeight);
  const maxY = clamp(bounds.maxY + padBottom, 0, state.imageHeight);
  if (maxX <= minX || maxY <= minY) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}

function maxPaddingScaleForAspect(baseW, baseH, aspect) {
  if (!Number.isFinite(aspect) || aspect <= 0 || baseW <= 0 || baseH <= 0) {
    return 0;
  }
  const ratio = baseW / baseH;
  if (ratio >= aspect) {
    const maxFromWidth = state.imageWidth / baseW - 1;
    const maxFromHeight = (aspect * state.imageHeight) / baseW - 1;
    return Math.min(maxFromWidth, maxFromHeight);
  }
  const maxFromHeight = state.imageHeight / baseH - 1;
  const maxFromWidth = state.imageWidth / (baseH * aspect) - 1;
  return Math.min(maxFromHeight, maxFromWidth);
}

function getAspectPaddedBounds(bounds, aspect, paddingScale) {
  if (!bounds) {
    return null;
  }
  const baseW = bounds.maxX - bounds.minX;
  const baseH = bounds.maxY - bounds.minY;
  if (baseW <= 0 || baseH <= 0) {
    return null;
  }
  const minSize = computeAspectCropSize(baseW, baseH, aspect);
  if (minSize.w > state.imageWidth || minSize.h > state.imageHeight) {
    return null;
  }
  let effectivePadding = 0;
  if (Number.isFinite(paddingScale) && paddingScale > 0) {
    const maxPadding = maxPaddingScaleForAspect(baseW, baseH, aspect);
    effectivePadding = clamp(paddingScale, 0, Math.max(0, maxPadding));
  }
  return expandBoundsWithPadding(bounds, effectivePadding);
}

function computeAspectCropSize(baseW, baseH, aspect) {
  let cropW = baseW;
  let cropH = baseW / aspect;
  if (cropH < baseH) {
    cropH = baseH;
    cropW = baseH * aspect;
  }
  return { w: cropW, h: cropH };
}

function buildAspectCropRect(bounds, aspect) {
  const baseW = bounds.maxX - bounds.minX;
  const baseH = bounds.maxY - bounds.minY;
  if (baseW <= 0 || baseH <= 0) {
    return null;
  }
  const size = computeAspectCropSize(baseW, baseH, aspect);
  if (size.w > state.imageWidth || size.h > state.imageHeight) {
    return null;
  }
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const maxX = Math.max(0, state.imageWidth - size.w);
  const maxY = Math.max(0, state.imageHeight - size.h);
  const x = clamp(centerX - size.w / 2, 0, maxX);
  const y = clamp(centerY - size.h / 2, 0, maxY);
  return { x, y, w: size.w, h: size.h };
}

function pickAspectCropRect(bounds, aspect, paddingScale) {
  if (!Number.isFinite(aspect) || aspect <= 0) {
    return null;
  }
  const candidates = [];
  const primaryBounds = getAspectPaddedBounds(bounds, aspect, paddingScale);
  const primary = primaryBounds ? buildAspectCropRect(primaryBounds, aspect) : null;
  if (primary) {
    candidates.push(primary);
  }
  if (Math.abs(aspect - 1) > 0.001) {
    const altAspect = 1 / aspect;
    const altBounds = getAspectPaddedBounds(bounds, altAspect, paddingScale);
    const alternate = altBounds ? buildAspectCropRect(altBounds, altAspect) : null;
    if (alternate) {
      candidates.push(alternate);
    }
  }
  if (!candidates.length) {
    return null;
  }
  candidates.sort((a, b) => (a.w * a.h) - (b.w * b.h));
  return candidates[0];
}

function getCropRectPixels() {
  if (!state.crop.active || !state.crop.bbox) {
    return null;
  }
  const minX = clamp((state.crop.bbox.cx - state.crop.bbox.w / 2) * state.imageWidth, 0, state.imageWidth);
  const maxX = clamp((state.crop.bbox.cx + state.crop.bbox.w / 2) * state.imageWidth, 0, state.imageWidth);
  const minY = clamp((state.crop.bbox.cy - state.crop.bbox.h / 2) * state.imageHeight, 0, state.imageHeight);
  const maxY = clamp((state.crop.bbox.cy + state.crop.bbox.h / 2) * state.imageHeight, 0, state.imageHeight);
  const x = Math.floor(minX);
  const y = Math.floor(minY);
  const w = Math.max(1, Math.ceil(maxX) - x);
  const h = Math.max(1, Math.ceil(maxY) - y);
  if (w < 1 || h < 1) {
    return null;
  }
  return { x, y, w, h };
}

function remapAnnotationsForCrop(annotations, cropRect) {
  if (!cropRect) {
    return annotations;
  }
  const cropX2 = cropRect.x + cropRect.w;
  const cropY2 = cropRect.y + cropRect.h;
  const remapped = [];
  for (const ann of annotations) {
    if (!ann || !ann.bbox) {
      continue;
    }
    const { x, y, w, h } = bboxToPixels(ann.bbox);
    const x2 = x + w;
    const y2 = y + h;
    const ix1 = Math.max(x, cropRect.x);
    const iy1 = Math.max(y, cropRect.y);
    const ix2 = Math.min(x2, cropX2);
    const iy2 = Math.min(y2, cropY2);
    const iw = ix2 - ix1;
    const ih = iy2 - iy1;
    if (iw < MIN_BBOX_PIXELS || ih < MIN_BBOX_PIXELS) {
      continue;
    }
    const minX = clamp((ix1 - cropRect.x) / cropRect.w, 0, 1);
    const maxX = clamp((ix2 - cropRect.x) / cropRect.w, 0, 1);
    const minY = clamp((iy1 - cropRect.y) / cropRect.h, 0, 1);
    const maxY = clamp((iy2 - cropRect.y) / cropRect.h, 0, 1);
    const next = {
      classId: ann.classId,
      bbox: {
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
        w: Math.max(0.0001, maxX - minX),
        h: Math.max(0.0001, maxY - minY)
      },
      keypoints: [],
      hasPose: ann.hasPose
    };
    if (Array.isArray(ann.keypoints) && ann.keypoints.length > 0) {
      for (const kp of ann.keypoints) {
        if (!kp || kp.v === 0) {
          next.keypoints.push({ x: 0, y: 0, v: 0 });
          continue;
        }
        const px = kp.x * state.imageWidth;
        const py = kp.y * state.imageHeight;
        if (px < cropRect.x || px > cropX2 || py < cropRect.y || py > cropY2) {
          next.keypoints.push({ x: 0, y: 0, v: 0 });
          continue;
        }
        const nx = clamp((px - cropRect.x) / cropRect.w, 0, 1);
        const ny = clamp((py - cropRect.y) / cropRect.h, 0, 1);
        next.keypoints.push({ x: nx, y: ny, v: kp.v });
      }
    }
    remapped.push(next);
  }
  return remapped;
}

async function saveLabels(options = {}) {
  if (!state.imagesDir || !state.labelsDir || !state.imageName) {
    return;
  }
  const labelName = `${stripExt(state.imageName)}.txt`;
  const cropRect = getCropRectPixels();
  const restoreImageRel = state.restoreImageRel;
  const annotationsForSave = cropRect
    ? remapAnnotationsForCrop(state.annotations, cropRect)
    : state.annotations;
  const content = serializeLabelsFor(annotationsForSave);
  if (content === null) {
    return;
  }
  const shouldMarkDone = state.modifiedSinceLoad && !options.skipReviewUpdate;
  const payload = {
    labelsDir: state.labelsDir,
    file: labelName,
    content,
    imagesDir: cropRect ? state.imagesDir : undefined,
    imageFile: cropRect ? state.imageName : undefined,
    crop: cropRect || undefined
  };
  if (restoreImageRel) {
    payload.imagesDir = state.imagesDir;
    payload.imageFile = state.imageName;
    payload.restoreImage = restoreImageRel;
  }

  try {
    const response = await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Save failed");
    }
    state.dirty = false;
    if (cropRect) {
      state.crop = { active: false, bbox: null };
      state.imageVersions[state.imageName] = (state.imageVersions[state.imageName] || 0) + 1;
    }
    if (restoreImageRel) {
      state.imageVersions[state.imageName] = (state.imageVersions[state.imageName] || 0) + 1;
      state.imageOverride = "";
      state.restoreImageRel = "";
    }
    let reviewSaved = true;
    if (shouldMarkDone) {
      setReviewStatusForImage(state.imageName, "Done");
      reviewSaved = await saveReviewStatus();
    }
    if (reviewSaved) {
      setStatus(`Saved ${labelName}`);
    } else {
      setStatus(`Saved ${labelName}, review status not saved.`);
    }
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

function pickCropCorner(worldX, worldY, scale) {
  if (!state.crop.active || !state.crop.bbox) {
    return null;
  }
  const radius = toWorldSize(10, scale);
  const corners = cropCorners(state.crop.bbox);
  if (!corners) {
    return null;
  }
  for (const corner of ["tl", "tr", "bl", "br"]) {
    const cornerPos = corners[corner];
    const dist = Math.hypot(worldX - cornerPos.x, worldY - cornerPos.y);
    if (dist <= radius) {
      return { corner, corners };
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

function cropCorners(bbox) {
  if (!bbox) {
    return null;
  }
  return bboxCorners(bbox);
}

function updateCorners(corners, activeCorner, nx, ny, options = {}) {
  const current = {
    x1: corners.tl.x / state.imageWidth,
    y1: corners.tl.y / state.imageHeight,
    x2: corners.br.x / state.imageWidth,
    y2: corners.br.y / state.imageHeight
  };
  let nextX = nx;
  let nextY = ny;
  if (options.keepAspect) {
    const width = Math.abs(current.x2 - current.x1);
    const height = Math.abs(current.y2 - current.y1);
    const aspect = Number.isFinite(options.aspectRatio) && options.aspectRatio > 0
      ? options.aspectRatio
      : (width > 0 && height > 0 ? width / height : 1);
    let opposite = { x: current.x1, y: current.y1 };
    if (activeCorner === "tl") {
      opposite = { x: current.x2, y: current.y2 };
    } else if (activeCorner === "tr") {
      opposite = { x: current.x1, y: current.y2 };
    } else if (activeCorner === "bl") {
      opposite = { x: current.x2, y: current.y1 };
    }
    const dx = nextX - opposite.x;
    const dy = nextY - opposite.y;
    const fallbackSignX = (activeCorner === "tl" || activeCorner === "bl") ? -1 : 1;
    const fallbackSignY = (activeCorner === "tl" || activeCorner === "tr") ? -1 : 1;
    const signX = dx === 0 ? fallbackSignX : Math.sign(dx);
    const signY = dy === 0 ? fallbackSignY : Math.sign(dy);
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    let adjDx = absDx;
    let adjDy = absDy;
    if (absDx === 0 && absDy === 0) {
      adjDx = 0;
      adjDy = 0;
    } else if (absDy === 0) {
      adjDy = absDx / aspect;
    } else if (absDx === 0) {
      adjDx = absDy * aspect;
    } else if (absDx / absDy > aspect) {
      adjDx = absDy * aspect;
    } else {
      adjDy = absDx / aspect;
    }
    nextX = opposite.x + adjDx * signX;
    nextY = opposite.y + adjDy * signY;
  }
  if (activeCorner === "tl") {
    current.x1 = nextX;
    current.y1 = nextY;
  }
  if (activeCorner === "tr") {
    current.x2 = nextX;
    current.y1 = nextY;
  }
  if (activeCorner === "bl") {
    current.x1 = nextX;
    current.y2 = nextY;
  }
  if (activeCorner === "br") {
    current.x2 = nextX;
    current.y2 = nextY;
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

function isValidKeypoint(kp) {
  return kp && Number.isFinite(kp.x) && Number.isFinite(kp.y) && kp.v > 0;
}

function findNearestValidKeypointIndex(ann, preferredIndex) {
  if (!ann || !ann.keypoints || preferredIndex < 0) {
    return -1;
  }
  const keypoints = ann.keypoints;
  const lastIdx = keypoints.length - 1;
  if (preferredIndex <= lastIdx && isValidKeypoint(keypoints[preferredIndex])) {
    return preferredIndex;
  }
  for (let i = Math.min(preferredIndex - 1, lastIdx); i >= 0; i -= 1) {
    if (isValidKeypoint(keypoints[i])) {
      return i;
    }
  }
  for (let i = Math.max(preferredIndex + 1, 0); i <= lastIdx; i += 1) {
    if (isValidKeypoint(keypoints[i])) {
      return i;
    }
  }
  return -1;
}

function centerMagnifierOnObject(ann) {
  const fallbackX = state.imageWidth / 2;
  const fallbackY = state.imageHeight / 2;
  if (!ann || !ann.bbox) {
    state.magnifier.x = fallbackX;
    state.magnifier.y = fallbackY;
    return;
  }
  const cx = Number.isFinite(ann.bbox.cx) ? ann.bbox.cx * state.imageWidth : fallbackX;
  const cy = Number.isFinite(ann.bbox.cy) ? ann.bbox.cy * state.imageHeight : fallbackY;
  state.magnifier.x = cx;
  state.magnifier.y = cy;
}

function setSelection(objectIndex, keypointIndex, corner) {
  if (state.selection.objectIndex !== objectIndex) {
    // Auto-center magnifier when switching objects
    if (state.magnifier.active && state.selection.objectIndex >= 0 && objectIndex >= 0) {
      const oldObj = state.annotations[state.selection.objectIndex];
      const newObj = state.annotations[objectIndex];
      if (oldObj && newObj) {
        let bestIdx = -1;
        let minD2 = Infinity;
        const mx = state.magnifier.x;
        const my = state.magnifier.y;

        if (oldObj.keypoints) {
          for (let i = 0; i < oldObj.keypoints.length; i++) {
            const kp = oldObj.keypoints[i];
            // Consider visible keypoints to find what we are looking at
            if (kp.v > 0) {
              const kx = kp.x * state.imageWidth;
              const ky = kp.y * state.imageHeight;
              const d2 = (kx - mx) ** 2 + (ky - my) ** 2;
              if (d2 < minD2) {
                minD2 = d2;
                bestIdx = i;
              }
            }
          }
        }

        if (bestIdx !== -1 && newObj.keypoints) {
          const targetIdx = findNearestValidKeypointIndex(newObj, bestIdx);
          if (targetIdx !== -1) {
            const targetKp = newObj.keypoints[targetIdx];
            state.magnifier.x = targetKp.x * state.imageWidth;
            state.magnifier.y = targetKp.y * state.imageHeight;
          } else {
            centerMagnifierOnObject(newObj);
          }
        } else {
          centerMagnifierOnObject(newObj);
        }
      }
    }
    state.lastSelectedKeypointIndex = -1;
  }
  state.selection.objectIndex = objectIndex;
  state.selection.keypointIndex = keypointIndex;
  if (keypointIndex >= 0) {
    state.lastSelectedKeypointIndex = keypointIndex;
  }
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

function selectNext() {
  const objIdx = state.selection.objectIndex;
  const kpIdx = state.selection.keypointIndex;

  if (objIdx >= 0 && kpIdx >= 0) {
    const ann = state.annotations[objIdx];
    const nextKp = findNextVisibleKeypoint(ann, kpIdx, 1);
    if (nextKp !== -1) {
      setSelection(objIdx, nextKp, null);
      return;
    }
  }
  selectNextObject();
}

function selectPrev() {
  const objIdx = state.selection.objectIndex;
  const kpIdx = state.selection.keypointIndex;

  if (objIdx >= 0 && kpIdx >= 0) {
    const ann = state.annotations[objIdx];
    const prevKp = findNextVisibleKeypoint(ann, kpIdx, -1);
    if (prevKp !== -1) {
      setSelection(objIdx, prevKp, null);
      return;
    }
  }
  selectPrevObject();
}

function findNextVisibleKeypoint(ann, currentIndex, step) {
  if (!ann || !ann.keypoints) return -1;
  const count = ann.keypoints.length;
  for (let i = 1; i <= count; i++) {
    const idx = (currentIndex + step * i + count) % count;
    if (ann.keypoints[idx] && ann.keypoints[idx].v > 0) {
      return idx;
    }
  }
  return -1;
}

function updateHover(worldX, worldY, scale, screenX, screenY, isMagnifier) {
  const pick = pickKeypoint(worldX, worldY, scale);
  if (pick) {
    let hoverX = screenX;
    let hoverY = screenY;
    let hoverIsMagnifier = !!isMagnifier;
    if (!Number.isFinite(hoverX) || !Number.isFinite(hoverY)) {
      hoverX = state.lastMouse.screenX;
      hoverY = state.lastMouse.screenY;
      hoverIsMagnifier = !!state.lastMouse.isMagnifier;
    }
    state.hover.objectIndex = pick.objectIndex;
    state.hover.keypointIndex = pick.keypointIndex;
    state.hover.screenX = hoverX;
    state.hover.screenY = hoverY;
    state.hover.isMagnifier = hoverIsMagnifier;
    return;
  }
  clearHover();
}

function clearHover() {
  state.hover.objectIndex = -1;
  state.hover.keypointIndex = -1;
  state.hover.isMagnifier = false;
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
    return { screenX, screenY, worldX, worldY, scale: effectiveScale, isMagnifier: true };
  }
  
  const world = screenToWorld(screenX, screenY);
  return { screenX, screenY, worldX: world.x, worldY: world.y, scale: state.view.scale, isMagnifier: false };
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

function updateOsdMinimizeButton() {
  if (!osdMinimizeBtn) {
    return;
  }
  if (state.osdMinimized) {
    osdMinimizeBtn.textContent = "+";
    osdMinimizeBtn.title = "Restore status panel";
    osdMinimizeBtn.setAttribute("aria-label", "Restore status panel");
  } else {
    osdMinimizeBtn.textContent = "-";
    osdMinimizeBtn.title = "Minimize status panel";
    osdMinimizeBtn.setAttribute("aria-label", "Minimize status panel");
  }
}

function setOsdMinimized(next) {
  state.osdMinimized = next;
  updateOsdMinimizeButton();
  state.osdCache = "";
  updateOsd();
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

function beginMagnifierMinimizedDrag(event) {
  if (!state.magnifier.active || !state.magnifier.minimized) {
    return;
  }
  if (event.button !== undefined && event.button !== 0) {
    return;
  }
  const pending = state.magnifier.minimizeDrag;
  pending.active = true;
  pending.pointerId = event.pointerId;
  pending.startX = event.clientX;
  pending.startY = event.clientY;
  pending.moved = false;
  pending.target = event.currentTarget;
}

function startMagnifierMoveFromMinimized(pending, event) {
  ensureMagnifierAnchor();
  const drag = state.magnifier.drag;
  drag.mode = "move";
  drag.pointerId = event.pointerId;
  drag.startX = pending.startX;
  drag.startY = pending.startY;
  drag.startLeft = state.magnifier.screenX;
  drag.startTop = state.magnifier.screenY;
  drag.startWidth = state.magnifier.width;
  drag.startHeight = state.magnifier.height;
  drag.target = pending.target;
  if (drag.target && drag.target.setPointerCapture) {
    drag.target.setPointerCapture(event.pointerId);
  }
  state.magnifier.ignoreMinimizeClick = true;
}

function onMagnifierDragMove(event) {
  const drag = state.magnifier.drag;
  const pending = state.magnifier.minimizeDrag;
  if ((!drag || !drag.mode) && pending && pending.active) {
    if (pending.pointerId !== null && event.pointerId !== pending.pointerId) {
      return;
    }
    const dx = event.clientX - pending.startX;
    const dy = event.clientY - pending.startY;
    if (!pending.moved && Math.hypot(dx, dy) >= 4) {
      pending.moved = true;
      pending.active = false;
      startMagnifierMoveFromMinimized(pending, event);
    }
  }
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
    const rect = getWorkspaceRect();
    let nextLeft = drag.startLeft + dx;
    let nextTop = drag.startTop + dy;
    let nextWidth = drag.startWidth;
    let nextHeight = drag.startHeight;
    if (!state.magnifier.minimized) {
      const minWidth = Math.min(MAGNIFIER_MIN_WIDTH, rect.width);
      const minHeight = Math.min(MAGNIFIER_MIN_HEIGHT, rect.height);
      if (nextLeft + nextWidth > rect.width) {
        nextWidth = clamp(rect.width - nextLeft, minWidth, rect.width);
      }
      if (nextTop + nextHeight > rect.height) {
        nextHeight = clamp(rect.height - nextTop, minHeight, rect.height);
      }
    }
    nextLeft = clamp(nextLeft, 0, Math.max(0, rect.width - nextWidth));
    nextTop = clamp(nextTop, 0, Math.max(0, rect.height - nextHeight));
    state.magnifier.screenX = nextLeft;
    state.magnifier.screenY = nextTop;
    if (!state.magnifier.minimized) {
      state.magnifier.width = nextWidth;
      state.magnifier.height = nextHeight;
      state.magnifier.restoreWidth = nextWidth;
      state.magnifier.restoreHeight = nextHeight;
    }
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
  const pending = state.magnifier.minimizeDrag;
  if (pending && pending.active) {
    if (pending.pointerId === null || event.pointerId === pending.pointerId) {
      pending.active = false;
      pending.pointerId = null;
      pending.target = null;
      pending.moved = false;
    }
  }
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
  if (state.magnifier.ignoreMinimizeClick) {
    setTimeout(() => {
      state.magnifier.ignoreMinimizeClick = false;
    }, 0);
  }
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
  
  drawMagnifierHoverLabel();
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
