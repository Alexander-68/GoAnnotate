# GoAnnotate

Visualize and annotate YOLO11 detections and 17-keypoint pose labels directly against your local image set.

## Description

GoAnnotate is a single-binary Go + Canvas tool for reviewing and editing YOLO11 detection/pose annotations. The backend serves the embedded frontend and reads/writes label files on disk while the frontend handles high-frequency rendering, zoom/pan, and annotation edits.

## Functions

- Load an images directory and a labels directory, matched by basename (`image.jpg` -> `image.txt`).
- Render bounding boxes, pose skeletons, and keypoint handles with a compact OSD panel that shows status, per-class counts, selected keypoints (when present), and selected object size.
- Render zoom-invariant line weights with unfilled keypoint circles for clearer pose review.
- Draw zoom-invariant `class_id:object_id` labels inside the top-left of each bounding box.
- Edit keypoints and bounding boxes with drag handles and automatic normalized updates.
- When an object is selected, render only that object's bbox and keypoints.     
- Show keypoint names with visibility (e.g., `left ear:1`) on hover.
- Add new objects and keypoints with automatic keypoint naming and class reuse.
- Switch between multiple annotation color schemes for visibility.
- Save changes to label files on image change with fixed six-decimal precision. 
- Keep the OSD status marked as modified until switching images or undoing all changes.
- Allow undo per image and clear undo history when switching images.
- Use a full-screen canvas with overlay OSD and a top-right Load button to open the project popup.

## Interactions

Keyboard
- `A` / `D`: Previous / next image (saves current labels before switching).
- `Esc` or `Ctrl` + `Z`: Undo the last annotation edit (per image).
- `V`: Cycle visibility of the active keypoint (0 -> 1 -> 2) and update its color.
- `B`: Cycle annotation color schemes.
- `C` / `Z`: Select next / previous object.
- `X`: Unselect object (show all).
- `Delete`: Remove the selected keypoint, or remove the selected object.
- `+` / `-`: Change the selected keypoint name (available names only), or change the selected object class ID when no keypoint is selected.

Mouse
- Left click: Select keypoint (priority) or bounding box.
- Left drag: Move the selected keypoint or bounding box.
- Drag bounding box corners: Resize the bounding box.
- `Ctrl` + left drag: Create a new bounding box when no object is selected (uses the last selected class ID or 0).
- `Ctrl` + left click: Add a new keypoint to the selected object (auto-selects an unused name).
- Right drag or Space + drag: Pan the view.
- Mouse wheel: Zoom (cursor-centered).
- Hover keypoint: Show the keypoint name and visibility tooltip.

UI
- The app opens with the project popup visible on start.
- The top-right `Load` button opens the popup with Images Dir and Labels Dir inputs.
- Recent folders appear as a dropdown suggestion for each directory field.
- The GoAnnotate title in the popup links to the project repository.

## Run

```bash
go run .
```

Then open `http://127.0.0.1:8080` in your browser.

## Tests

```bash
node tests/labels.test.js
```
