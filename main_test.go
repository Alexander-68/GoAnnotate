package main

import (
	"bytes"
	"encoding/json"
	"image"
	"image/png"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
)

func mustWrite(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
}

func mustOpen(t *testing.T, dir string) *os.Root {
	t.Helper()
	root, err := openDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { root.Close() })
	return root
}

func TestRootConfinement(t *testing.T) {
	base := t.TempDir()
	mustWrite(t, filepath.Join(base, "sub", "a.txt"))
	root := mustOpen(t, filepath.Join(base, "sub"))
	for _, rel := range []string{"a.txt", "./a.txt"} {
		if _, err := root.Stat(rel); err != nil {
			t.Errorf("Stat(%q) unexpected error: %v", rel, err)
		}
	}
	for _, rel := range []string{"..", "../sub/a.txt", filepath.Join(base, "sub", "a.txt")} {
		if _, err := root.Stat(rel); err == nil {
			t.Errorf("Stat(%q) expected error", rel)
		}
	}
}

func TestDataRoot(t *testing.T) {
	base := t.TempDir()
	inside := filepath.Join(base, "data", "set")
	if err := os.MkdirAll(inside, 0o755); err != nil {
		t.Fatal(err)
	}
	r, err := os.OpenRoot(filepath.Join(base, "data"))
	if err != nil {
		t.Fatal(err)
	}
	dataRoot, dataRootDir = filepath.Join(base, "data"), r
	t.Cleanup(func() { r.Close(); dataRoot, dataRootDir = "", nil })

	for _, dir := range []string{dataRoot, inside} {
		if root, err := openDir(dir); err != nil {
			t.Errorf("openDir(%q) unexpected error: %v", dir, err)
		} else {
			root.Close()
		}
	}
	for _, dir := range []string{base, filepath.Join(inside, "..", "..")} {
		if _, err := openDir(dir); err == nil {
			t.Errorf("openDir(%q) expected error", dir)
		}
	}
}

func TestDetectLabelsDir(t *testing.T) {
	stems := map[string]bool{"a": true, "b": true}

	same := t.TempDir()
	mustWrite(t, filepath.Join(same, "a.jpg"))
	mustWrite(t, filepath.Join(same, "a.txt"))
	if got := detectLabelsDir(same, stems); got != same {
		t.Errorf("same folder: got %q", got)
	}

	yolo := t.TempDir()
	images := filepath.Join(yolo, "images", "train")
	labels := filepath.Join(yolo, "labels", "train")
	mustWrite(t, filepath.Join(images, "a.jpg"))
	mustWrite(t, filepath.Join(labels, "a.txt"))
	mustWrite(t, filepath.Join(labels, "b.txt"))
	if got := detectLabelsDir(images, stems); got != labels {
		t.Errorf("yolo layout: got %q, want %q", got, labels)
	}

	empty := t.TempDir()
	if got := detectLabelsDir(empty, stems); got != empty {
		t.Errorf("no labels: got %q, want images dir", got)
	}
}

func TestListAndBrowseHandlers(t *testing.T) {
	base := t.TempDir()
	images := filepath.Join(base, "images", "val")
	mustWrite(t, filepath.Join(images, "a.jpg"))
	mustWrite(t, filepath.Join(images, "b.png"))
	mustWrite(t, filepath.Join(base, "labels", "val", "a.txt"))

	rec := httptest.NewRecorder()
	handleList(rec, httptest.NewRequest("GET", "/api/list?imagesDir="+url.QueryEscape(images), nil))
	var list listResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil {
		t.Fatalf("list: %v (%s)", err, rec.Body)
	}
	if list.LabelsDir != filepath.Join(base, "labels", "val") || len(list.Images) != 2 ||
		!list.Images[0].LabelExists || list.Images[1].LabelExists {
		t.Errorf("unexpected list response: %+v", list)
	}

	rec = httptest.NewRecorder()
	handleBrowse(rec, httptest.NewRequest("GET", "/api/browse?path="+url.QueryEscape(filepath.Join(base, "images")), nil))
	var browse browseResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &browse); err != nil {
		t.Fatalf("browse: %v (%s)", err, rec.Body)
	}
	if browse.Parent != base || len(browse.Dirs) != 1 || browse.Dirs[0].Images != 2 {
		t.Errorf("unexpected browse response: %+v", browse)
	}
}

func TestRestoreRejectsDeletedDir(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "deleted"), 0o755); err != nil {
		t.Fatal(err)
	}
	mustWrite(t, filepath.Join(dir, "img.jpg"))
	root := mustOpen(t, dir)
	for _, rel := range []string{"deleted", "deleted/missing.jpg", "other/img.jpg", "deleted/../../x.jpg"} {
		if err := restoreImageFromDeleted(root, "img.jpg", rel); err == nil {
			t.Errorf("restore %q expected error", rel)
		}
	}
	if _, err := os.Stat(filepath.Join(dir, "img.jpg")); err != nil {
		t.Error("current image must stay in place when restore is rejected")
	}
}

func TestMoveToDeletedAndRestore(t *testing.T) {
	dir := t.TempDir()
	mustWrite(t, filepath.Join(dir, "img.jpg"))
	root := mustOpen(t, dir)
	first, err := moveToDeleted(root, "img.jpg")
	if err != nil || first == "" {
		t.Fatalf("moveToDeleted: %q, %v", first, err)
	}
	mustWrite(t, filepath.Join(dir, "img.jpg"))
	second, err := moveToDeleted(root, "img.jpg")
	if err != nil || second == first {
		t.Fatalf("second move must get a unique name: %q, %v", second, err)
	}
	if err := restoreImageFromDeleted(root, "img.jpg", filepath.ToSlash(first)); err != nil {
		t.Fatal(err)
	}
	if _, err := root.Stat("img.jpg"); err != nil {
		t.Error("restored image missing")
	}
}

func TestCropAndSaveLabels(t *testing.T) {
	dir := t.TempDir()
	var buf bytes.Buffer
	if err := png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, 10, 8))); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "img.png"), buf.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}
	mustWrite(t, filepath.Join(dir, "img.txt"))
	root := mustOpen(t, dir) // images and labels share one folder
	p := labelPayload{File: "img.txt", Content: "0 0.5 0.5 1 1", ImageFile: "img.png", Crop: &cropRect{X: 2, Y: 1, W: 4, H: 3}}
	archived, err := cropAndSaveLabels(root, root, p)
	if err != nil {
		t.Fatal(err)
	}
	if archived != "deleted/img.png" {
		t.Errorf("archived = %q", archived)
	}
	f, _ := root.Open("img.png")
	cfg, err := png.DecodeConfig(f)
	f.Close()
	if err != nil || cfg.Width != 4 || cfg.Height != 3 {
		t.Errorf("cropped image %dx%d, %v", cfg.Width, cfg.Height, err)
	}
	if got, _ := root.ReadFile("img.txt"); string(got) != p.Content {
		t.Errorf("label content %q", got)
	}
	if _, err := root.Stat("deleted/img.txt"); err != nil {
		t.Error("original label not archived")
	}
	if _, err := cropAndSaveLabels(root, root, labelPayload{File: "img.txt", ImageFile: "img.png", Crop: &cropRect{W: 50, H: 50}}); err == nil {
		t.Error("out-of-bounds crop must fail")
	}
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		if filepath.Ext(e.Name()) == ".tmp" {
			t.Errorf("leftover temp file %s", e.Name())
		}
	}
}

func TestHistoryWriteLeavesNoBackups(t *testing.T) {
	dir := t.TempDir()
	root := mustOpen(t, dir)
	p := labelPayload{LabelsDir: dir, File: "a.txt"}
	for _, c := range []string{"1", "2", "3"} {
		p.Content = c
		if err := updateLabelHistory(root, p, []byte("0"), ""); err != nil {
			t.Fatal(err)
		}
	}
	entries, _ := os.ReadDir(filepath.Join(dir, "labels-history"))
	if len(entries) != 1 {
		t.Errorf("expected only a.json in labels-history, got %d entries", len(entries))
	}
}
