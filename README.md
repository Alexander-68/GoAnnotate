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
- Show a cursor-centered magnifier window on keypoint selection or double-click/tap for precise inspection and editing.
- Keep the magnifier window anchored on screen once opened so selections inside it do not reposition the view.
- Move, resize, or minimize the magnifier window using its corner handles.
- Add new objects and keypoints with automatic keypoint naming and class reuse.
- Switch between multiple annotation color schemes for visibility.
- Save changes to label files on image change with fixed six-decimal precision.
- Keep the OSD status marked as modified until switching images or undoing all changes.
- Allow undo per image and clear undo history when switching images.
- Preserve the current pan/zoom and magnifier state when switching images.
- Use a full-screen canvas with overlay OSD, top-right Load/Help buttons, and bottom-left Prev / bottom-right Next buttons for image navigation.
- Log loaded dataset paths with total and labeled image counts on load.
- Automatically suggest a Labels Directory when an Images Directory is selected in the UI, prioritized as follows:
    1.  YOLO-style: `.../labels/{subdir}` if images are in `.../images/{subdir}`.
    2.  Subdirectory: `imagesDir/labels`.
    3.  Sibling: `../labels`.
    4.  Parent: `..`.

## Interactions

Keyboard
- `A` / `D` or `Left` / `Right Arrow`: Previous / next image (saves current labels before switching).     
- `Home` / `End`: Jump to the first / last image.
- `PageUp` / `PageDown`: Jump 100 images backward / forward.
- `Esc` or `Ctrl` + `Z`: Undo the last annotation edit (per image).
- `V`: Cycle visibility of the active keypoint (0 -> 1 -> 2) and update its color.
- `B`: Cycle annotation color schemes.
- `Z` / `C` or `Up` / `Down Arrow`: Select previous / next object (if no keypoint selected) or previous / next keypoint (if keypoint selected).
- `X`: Unselect keypoint (if selected) or unselect object (show all).
- `Delete` / `F`: Remove the selected keypoint, or remove the selected object.
- `+` / `E` / `-` / `Q`: Increment/decrement the selected keypoint name (available IDs only), or increment/decrement the selected object class ID when no keypoint is selected.

Mouse
- Left click: Select keypoint (opens magnifier) or bounding box (selection only).
- Left drag: Move the selected keypoint (shows magnifier).
- Left drag on empty space or bbox: Pan the view (shows magnifier).
- Drag bounding box corners: Resize the bounding box (bbox center cannot be dragged).
- `Ctrl` + left drag: Create a new bounding box when no object is selected (uses the last selected class ID or 0).
- `Ctrl` + left click: Add a new keypoint to the selected object. It starts from the minimal available ID or from the next available ID above the last selected keypoint.
- Right drag or Space + drag: Pan the view.
- Mouse wheel: Zoom (cursor-centered, only when over the image).
- Hover keypoint: Show the keypoint name and visibility tooltip.
- Magnifier corners: Drag top-left to move, drag bottom-right to resize (free aspect), click top-right to minimize and click the minimized square to restore.
- Double click: Center the magnifier on the cursor.
- Click or drag outside the image: No action.

Touch
- Swipe right: Previous image (saves current labels before switching, works outside the image too).
- Swipe left: Next image (saves current labels before switching, works outside the image too).
- Tap a bounding box: Select the object (selection only).
- Tap a keypoint: Select it and open the magnifier.
- Drag a keypoint: Move the selected keypoint (shows magnifier).
- Drag a bounding box corner: Resize the bounding box.
- One-finger drag: Pan the view (shows magnifier).
- Pinch: Zoom in or out (centered on the pinch midpoint, only over the image).
- Pinch inside the magnifier: Zoom the magnifier view.
- Double tap: Center the magnifier on the tap.
- Touch outside the image: No action.

UI
- The app opens with the project popup visible on start.
- The top-right `Load` button opens the popup with Images Dir and Labels Dir inputs.
- The `Help` button below `Load` opens a popup with usage instructions and shortcuts.
- The bottom-left `Prev` and bottom-right `Next` buttons switch images (disabled at the first/last image).
- Changes are saved automatically as soon as the image is changed. Undo works only within unsaved changes.
- Recent folders appear as a dropdown suggestion for each directory field.
- The GoAnnotate title in the popup links to the project repository.
- Click the minimized magnifier (plus sign) to restore it after minimizing.

## Run

Requires Go 1.25+.

```bash
go run .
```

By default, the server listens on `127.0.0.1:8080`. You can configure the address and port using the `-ip` and `-port` flags:

```bash
go run . -ip 0.0.0.0 -port 9090
```

To restrict directory browsing to a specific path (e.g., for security or convenience), use the `-data-root` flag:

```bash
go run . -data-root C:\my\data\folder
```

Then open `http://127.0.0.1:8080` (or your configured address) in your browser.

## Tests

```bash
node tests/labels.test.js
```
