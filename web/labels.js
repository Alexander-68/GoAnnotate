(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Labels = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const KPT_COUNT = 17;

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

  function formatNum(value) {
    return Number(value).toFixed(6);
  }

  function parseLabels(text) {
    const safeText = typeof text === "string" ? text : "";
    const lines = safeText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
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

  function serializeLabels(annotations) {
    if (!Array.isArray(annotations) || annotations.length === 0) {
      return "";
    }
    return annotations.map((ann) => {
      const bbox = ann && ann.bbox ? ann.bbox : { cx: 0, cy: 0, w: 0, h: 0 };
      const items = [
        ann && ann.classId != null ? ann.classId : 0,
        formatNum(bbox.cx),
        formatNum(bbox.cy),
        formatNum(bbox.w),
        formatNum(bbox.h)
      ];
      if (ann && ann.hasPose) {
        const keypoints = Array.isArray(ann.keypoints) ? ann.keypoints : [];
        for (let i = 0; i < KPT_COUNT; i += 1) {
          const kp = keypoints[i] || { x: 0, y: 0, v: 0 };
          items.push(formatNum(kp.x), formatNum(kp.y), clampVisibility(kp.v));
        }
      }
      return items.join(" ");
    }).join("\n");
  }

  return {
    KPT_COUNT,
    parseLabels,
    serializeLabels
  };
});
