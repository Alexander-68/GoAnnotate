const assert = require("assert/strict");
const path = require("path");

const labels = require(path.join(__dirname, "..", "web", "labels.js"));

function assertClose(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `Expected ${actual} to be close to ${expected}`);
}

function run() {
  assert.deepEqual(labels.parseLabels(""), []);
  assert.deepEqual(labels.parseLabels("not numbers here"), []);

  const buildPoseLine = (count) => {
    const parts = [1, 1.2, -0.5, 0.5, 0.6];
    for (let i = 0; i < count; i += 1) {
      if (i === 0) {
        parts.push(0.1, 0.2, 3);
      } else {
        parts.push(0, 0, 0);
      }
    }
    return parts.join(" ");
  };

  const parsedMpii = labels.parseLabels(buildPoseLine(labels.MPII_KPT_COUNT));
  assert.equal(parsedMpii.length, 1);
  const mpii = parsedMpii[0];
  assert.equal(mpii.classId, 1);
  assertClose(mpii.bbox.cx, 1);
  assertClose(mpii.bbox.cy, 0);
  assertClose(mpii.bbox.w, 0.5);
  assertClose(mpii.bbox.h, 0.6);
  assert.equal(mpii.hasPose, true);
  assert.equal(mpii.keypoints.length, labels.MPII_KPT_COUNT);
  assertClose(mpii.keypoints[0].x, 0.1);
  assertClose(mpii.keypoints[0].y, 0.2);
  assert.equal(mpii.keypoints[0].v, 2);
  assert.equal(mpii.keypoints[1].v, 0);

  const parsedYolo = labels.parseLabels(buildPoseLine(labels.YOLO_KPT_COUNT));
  assert.equal(parsedYolo.length, 1);
  assert.equal(parsedYolo[0].keypoints.length, labels.YOLO_KPT_COUNT);

  const noPose = labels.serializeLabels([{
    classId: 2,
    bbox: { cx: 0.1, cy: 0.2, w: 0.3, h: 0.4 },
    keypoints: [],
    hasPose: false
  }]);
  assert.equal(noPose, "2 0.100000 0.200000 0.300000 0.400000");

  const keypoints = Array.from({ length: labels.YOLO_KPT_COUNT }, () => ({ x: 0, y: 0, v: 0 }));
  keypoints[0] = { x: 0.5, y: 0.25, v: 7 };
  const withPose = labels.serializeLabels([{
    classId: 0,
    bbox: { cx: 0.1, cy: 0.2, w: 0.3, h: 0.4 },
    keypoints,
    hasPose: true
  }]);
  const parts = withPose.split(" ");
  assert.equal(parts.length, 5 + 3 * labels.YOLO_KPT_COUNT);
  assert.equal(parts[5], "0.500000");
  assert.equal(parts[6], "0.250000");
  assert.equal(parts[7], "2");

  const mpiiKeypoints = Array.from({ length: labels.MPII_KPT_COUNT }, () => ({ x: 0, y: 0, v: 0 }));
  mpiiKeypoints[0] = { x: 0.25, y: 0.75, v: 1 };
  const mpiiPose = labels.serializeLabels([{
    classId: 3,
    bbox: { cx: 0.2, cy: 0.3, w: 0.4, h: 0.5 },
    keypoints: mpiiKeypoints,
    hasPose: true
  }]);
  const mpiiParts = mpiiPose.split(" ");
  assert.equal(mpiiParts.length, 5 + 3 * labels.MPII_KPT_COUNT);
  assert.equal(mpiiParts[5], "0.250000");
  assert.equal(mpiiParts[6], "0.750000");
  assert.equal(mpiiParts[7], "1");

  assert.equal(labels.serializeLabels([]), "");
}

run();
console.log("labels.test.js: ok");
