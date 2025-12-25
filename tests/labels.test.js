const assert = require("assert/strict");
const path = require("path");

const labels = require(path.join(__dirname, "..", "web", "labels.js"));

function assertClose(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `Expected ${actual} to be close to ${expected}`);
}

function run() {
  assert.deepEqual(labels.parseLabels(""), []);
  assert.deepEqual(labels.parseLabels("not numbers here"), []);

  const parsed = labels.parseLabels("1 1.2 -0.5 0.5 0.6 0.1 0.2 3");
  assert.equal(parsed.length, 1);
  const ann = parsed[0];
  assert.equal(ann.classId, 1);
  assertClose(ann.bbox.cx, 1);
  assertClose(ann.bbox.cy, 0);
  assertClose(ann.bbox.w, 0.5);
  assertClose(ann.bbox.h, 0.6);
  assert.equal(ann.hasPose, true);
  assert.equal(ann.keypoints.length, labels.KPT_COUNT);
  assertClose(ann.keypoints[0].x, 0.1);
  assertClose(ann.keypoints[0].y, 0.2);
  assert.equal(ann.keypoints[0].v, 2);
  assert.equal(ann.keypoints[1].v, 0);

  const noPose = labels.serializeLabels([{
    classId: 2,
    bbox: { cx: 0.1, cy: 0.2, w: 0.3, h: 0.4 },
    keypoints: [],
    hasPose: false
  }]);
  assert.equal(noPose, "2 0.100000 0.200000 0.300000 0.400000");

  const keypoints = Array.from({ length: labels.KPT_COUNT }, () => ({ x: 0, y: 0, v: 0 }));
  keypoints[0] = { x: 0.5, y: 0.25, v: 7 };
  const withPose = labels.serializeLabels([{
    classId: 0,
    bbox: { cx: 0.1, cy: 0.2, w: 0.3, h: 0.4 },
    keypoints,
    hasPose: true
  }]);
  const parts = withPose.split(" ");
  assert.equal(parts.length, 5 + 3 * labels.KPT_COUNT);
  assert.equal(parts[5], "0.500000");
  assert.equal(parts[6], "0.250000");
  assert.equal(parts[7], "2");

  assert.equal(labels.serializeLabels([]), "");
}

run();
console.log("labels.test.js: ok");
