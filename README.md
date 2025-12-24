# GoAnnotate

Visualize and annotate YOLO11 detections and 17-keypoint pose labels directly against your local image set.

## Description

GoAnnotate is a single-binary Go + Canvas tool for reviewing and editing YOLO11 detection/pose annotations. The backend serves the embedded frontend and reads/writes label files on disk while the frontend handles high-frequency rendering, zoom/pan, and annotation edits.

## Functions

- Load an images directory and a labels directory, matched by basename (`image.jpg` -> `image.txt`).
- Render bounding boxes, pose skeletons, and keypoint handles with a compact OSD panel that shows status, per-class counts, selected keypoints, and selected object size.
- Render zoom-invariant line weights with unfilled keypoint circles for clearer pose review.
- Draw object indices inside the top-left of each bounding box.
- Edit keypoints and bounding boxes with drag handles and automatic normalized updates.
- Auto-save changes to label files with fixed six-decimal precision.
- Keep the OSD status marked as modified until switching images.
- Keep project controls in a collapsible left panel while the canvas fills the remaining space.

## Interactions

Keyboard
- `A` / `D`: Previous / next image.
- `V`: Cycle visibility of the active keypoint (0 -> 1 -> 2).
- `Delete`: Remove the selected object.

Mouse
- Left click: Select keypoint (priority) or bounding box.
- Left drag: Move the selected keypoint or bounding box.
- Drag bounding box corners: Resize the bounding box.
- Right drag or Space + drag: Pan the view.
- Mouse wheel: Zoom (cursor-centered).

UI
- `Load` opens the directory picker popup for Images Dir and Labels Dir.        
- Recent folders appear as a dropdown suggestion for each directory field.      
- The sidebar toggle collapses/expands the left panel.

## Run

```bash
go run .
```

Then open `http://127.0.0.1:8080` in your browser.
