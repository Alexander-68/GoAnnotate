# **YOLO11 Pose Annotator: Implementation Plan**

This document outlines the technical strategy for building a high-performance, single-binary image annotation tool tailored for **YOLO11 Detection** and **YOLO11-Pose** (17-keypoint) formats. 

## **1\. Architectural Overview**

The application follows a "Heavy Frontend / Light Backend" pattern to ensure portability and ease of deployment.

* **Backend (Go):** \- Primary role is serving the embedded frontend and handling static assets.  
  * Uses embed.FS to bundle all UI code into a single executable.  
* **Frontend (Vanilla JS \+ HTML5 Canvas):** \- Manages the application state in-memory.  
  * Implements a high-frequency render loop on the Canvas for smooth zoom/pan.

## **2\. Data Models (YOLO11-Pose)**

Internal representation must strictly follow the YOLO normalization rules where all coordinates are \[0, 1\] relative to image dimensions.

### **Core Structs (Internal)**

* **Bounding Box:** \[class\_id, cx, cy, w, h\]  
* **Pose Keypoints:** \[px1, py1, v1, ..., px17, py17, v17\]  
* **Visibility States (v):**  
  * 0: Not labeled / Invisible.  
  * 1: Labeled but hidden (occluded).  
  * 2: Labeled and visible.

\# Keypoints

kpt\_shape: \[17, 3\] \# number of keypoints, number of dims (2 for x,y or 3 for x,y,visible)

flip\_idx: \[0, 2, 1, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15\]

\# Classes

names:

  0: person

\# Keypoint names per class

kpt\_names:

  0:
    \- nose
    \- left\_eye
    \- right\_eye
    \- left\_ear
    \- right\_ear
    \- left\_shoulder
    \- right\_shoulder
    \- left\_elbow
    \- right\_elbow
    \- left\_wrist
    \- right\_wrist
    \- left\_hip
    \- right\_hip
    \- left\_knee
    \- right\_knee
    \- left\_ankle
    \- right\_ankle

### **Transformation Matrix**

The scale, offsetX, and offsetY variables manage the "View Transform":

* **Zooming:** Updates scale and offsets relative to the current cursor position to keep the "point under the mouse" stationary.  
* **Panning:** Modifies offsetX/Y based on relative mouse movement.

## **4\. Key Implementation Phases**

### **The Render Pipeline**

* **Layer 1:** Draw the base image (imageSmoothingEnabled \= false for pixel accuracy).  
* **Layer 2:** Draw Bounding Boxes using class-specific colors.  
* **Layer 3:** Draw Pose Skeletons. Connect keypoints (e.g., left\_shoulder to right\_shoulder) based on the flip\_idx and skeleton map.  
* **Layer 4:** Draw interactive "Handles" (active keypoints).  
* Overlay HUD showing bbox count for active image and current image name and resolution.

### **Interaction & Hotkeys**

* **Left Click:** Priority selection (Keypoint \> BBox).  
* **Drag:** Update normalized coordinates.  
* Drag BBox corner \- change that corner coords  
* **Keyboard \[A/D\]:** Slice through the image array.  
* **Keyboard \[V\]:** Cycle visibility of the active keypoint.  
* **Keyboard \[Delete\]:** Remove selected object.

## **5\. File I/O**

* Select image folder, select labels folder.  
* Manipulate images and annotations directly on the disk, saving changes automatically  
* Match annotation files to images by basename

## **6\. Challenges & Solutions**

* **High-Res Images:** Canvas has memory limits. Large images are loaded as ImageBitmap for better GPU performance.  
* **Browser Compatibility:** Use getBoundingClientRect() for mouse events to ensure the tool works correctly inside iFrames or varied layouts.  
* **Normalized Precision:** Enforce .toFixed(6) during export to prevent floating point drift in YOLO training scripts.

