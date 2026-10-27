package main

import (
	"bytes"
	"cmp"
	"crypto/rand"
	"embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"image"
	"image/draw"
	"image/jpeg"
	"image/png"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

//go:embed web/*
var webContent embed.FS

// dataRoot restricts all file access when -data-root is set; dataRootDir is the
// matching os.Root, so every directory opened by openDir stays inside it.
var (
	dataRoot    string
	dataRootDir *os.Root
)

type listResponse struct {
	Images    []imageEntry `json:"images"`
	LabelsDir string       `json:"labelsDir"`
}

type browseResponse struct {
	Current string     `json:"current"`
	Parent  string     `json:"parent"`
	Images  int        `json:"images"`
	Labels  int        `json:"labels"`
	Dirs    []dirEntry `json:"dirs"`
}

type dirEntry struct {
	Name       string `json:"name"`
	HasSubdirs bool   `json:"hasSubdirs"`
	Images     int    `json:"images"`
	Labels     int    `json:"labels"`
}

type imageEntry struct {
	Name        string `json:"name"`
	LabelExists bool   `json:"labelExists"`
}

type labelPayload struct {
	LabelsDir    string    `json:"labelsDir"`
	File         string    `json:"file"`
	Content      string    `json:"content"`
	ImagesDir    string    `json:"imagesDir"`
	ImageFile    string    `json:"imageFile"`
	Crop         *cropRect `json:"crop"`
	RestoreImage string    `json:"restoreImage"`
}

type cropRect struct {
	X int `json:"x"`
	Y int `json:"y"`
	W int `json:"w"`
	H int `json:"h"`
}

type labelHistoryEntry struct {
	Content   string    `json:"content"`
	Timestamp string    `json:"timestamp,omitempty"`
	Crop      *cropRect `json:"crop,omitempty"`
	ImageRel  string    `json:"imageRel,omitempty"`
}

type labelHistory struct {
	Initial labelHistoryEntry `json:"initial"`
	Latest  labelHistoryEntry `json:"latest"`
}

type deletePayload struct {
	ImagesDir string `json:"imagesDir"`
	LabelsDir string `json:"labelsDir"`
	File      string `json:"file"`
}

type deleteResponse struct {
	DeletedImage bool `json:"deletedImage"`
	DeletedLabel bool `json:"deletedLabel"`
}

type reviewStatusPayload struct {
	LabelsDir string   `json:"labelsDir"`
	Done      []string `json:"done"`
}

type reviewStatusResponse struct {
	Done []string `json:"done"`
}

const reviewStatusFilename = "review_status.json"

var errBadRequest = errors.New("bad request")

func main() {
	ip := flag.String("ip", "127.0.0.1", "IP address to listen on")
	port := flag.Int("port", 8080, "Port to listen on")
	dr := flag.String("data-root", "", "Root directory to restrict browsing (optional)")
	flag.Parse()

	if *dr != "" {
		abs, err := filepath.Abs(*dr)
		if err != nil {
			log.Fatalf("invalid data-root: %v", err)
		}
		if dataRootDir, err = os.OpenRoot(abs); err != nil {
			log.Fatalf("invalid data-root: %v", err)
		}
		dataRoot = abs
	}

	log.Printf("Starting GoAnnotate with: ip=%s, port=%d, data-root=%q", *ip, *port, *dr)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/list", handleList)
	mux.HandleFunc("GET /api/image", handleImage)
	mux.HandleFunc("GET /api/labels", handleLabelsGet)
	mux.HandleFunc("POST /api/labels", handleLabelsPost)
	mux.HandleFunc("GET /api/labels_history", handleLabelsHistoryGet)
	mux.HandleFunc("POST /api/delete_image", handleDeleteImage)
	mux.HandleFunc("GET /api/browse", handleBrowse)
	mux.HandleFunc("GET /api/review_status", handleReviewStatusGet)
	mux.HandleFunc("POST /api/review_status", handleReviewStatusPost)
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	webFS, err := fs.Sub(webContent, "web")
	if err != nil {
		log.Fatalf("web assets: %v", err)
	}
	fileServer := http.FileServer(http.FS(webFS))
	mux.Handle("/", fileServer)

	addr := fmt.Sprintf("%s:%d", *ip, *port)
	log.Printf("GoAnnotate running at http://%s", addr)
	srv := &http.Server{
		Addr: addr,
		// Reject cross-site requests so other web pages can't drive the write/delete API.
		Handler:           http.NewCrossOriginProtection().Handler(logRequests(mux)),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}
	log.Fatal(srv.ListenAndServe())
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		dur := time.Since(start).Truncate(time.Millisecond)
		if !strings.HasPrefix(r.URL.Path, "/api/") {
			log.Printf("%s %s (%s)", r.Method, r.URL.Path, dur)
		}
	})
}

// absDir makes dir absolute and, with -data-root, returns its path relative to the root.
func absDir(dir string) (abs, rel string, err error) {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return "", "", errors.New("missing directory")
	}
	if abs, err = filepath.Abs(dir); err != nil {
		return "", "", err
	}
	if dataRootDir == nil {
		return abs, "", nil
	}
	if rel, err = filepath.Rel(dataRoot, abs); err != nil || !filepath.IsLocal(rel) {
		return "", "", errors.New("path outside data-root")
	}
	return abs, rel, nil
}

// openDir opens dir as an os.Root: every file name used through it is confined
// to dir (no "..", absolute paths, reserved names or symlinks escaping it).
func openDir(dir string) (*os.Root, error) {
	abs, rel, err := absDir(dir)
	if err != nil {
		return nil, err
	}
	if dataRootDir == nil {
		return os.OpenRoot(abs)
	}
	return dataRootDir.OpenRoot(rel)
}

// requireDir opens dir for a handler, writing a 400 on failure.
func requireDir(w http.ResponseWriter, name, dir string) (*os.Root, bool) {
	root, err := openDir(dir)
	if err != nil {
		http.Error(w, "invalid "+name, http.StatusBadRequest)
		return nil, false
	}
	return root, true
}

func handleList(w http.ResponseWriter, r *http.Request) {
	imagesDir := r.URL.Query().Get("imagesDir")
	imgRoot, ok := requireDir(w, "imagesDir", imagesDir)
	if !ok {
		return
	}
	defer imgRoot.Close()
	imagesAbs, _, _ := absDir(imagesDir)

	entries, err := fs.ReadDir(imgRoot.FS(), ".")
	if err != nil {
		http.Error(w, "unable to read imagesDir", http.StatusInternalServerError)
		return
	}
	var images []imageEntry
	stems := map[string]bool{}
	for _, entry := range entries {
		if !entry.IsDir() && isImageExt(filepath.Ext(entry.Name())) {
			images = append(images, imageEntry{Name: entry.Name()})
			stems[trimExt(entry.Name())] = true
		}
	}

	labelsAbs := imagesAbs
	if labelsDir := strings.TrimSpace(r.URL.Query().Get("labelsDir")); labelsDir != "" {
		if labelsAbs, _, err = absDir(labelsDir); err != nil {
			http.Error(w, "invalid labelsDir", http.StatusBadRequest)
			return
		}
	} else {
		labelsAbs = detectLabelsDir(imagesAbs, stems)
	}

	labels := labelStems(labelsAbs)
	labeledCount := 0
	for i := range images {
		if labels[trimExt(images[i].Name)] {
			images[i].LabelExists = true
			labeledCount++
		}
	}
	slices.SortFunc(images, func(a, b imageEntry) int {
		return cmp.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name))
	})

	log.Printf("Loaded dataset imagesDir=%q labelsDir=%q images=%d labeled=%d",
		imagesAbs, labelsAbs, len(images), labeledCount)
	writeJSON(w, listResponse{Images: images, LabelsDir: labelsAbs})
}

// labelStems returns the base names of all .txt files in dir (empty if unreadable).
func labelStems(dir string) map[string]bool {
	stems := map[string]bool{}
	root, err := openDir(dir)
	if err != nil {
		return stems
	}
	defer root.Close()
	entries, _ := fs.ReadDir(root.FS(), ".")
	for _, entry := range entries {
		if !entry.IsDir() && strings.EqualFold(filepath.Ext(entry.Name()), ".txt") {
			stems[trimExt(entry.Name())] = true
		}
	}
	return stems
}

// detectLabelsDir picks the candidate labels directory holding the most .txt files
// that match image names. With no matches, labels live next to the images.
func detectLabelsDir(imagesAbs string, imageStems map[string]bool) string {
	parent := filepath.Dir(imagesAbs)
	base := filepath.Base(imagesAbs)
	candidates := []string{imagesAbs}
	if strings.EqualFold(filepath.Base(parent), "images") {
		// YOLO layout: .../images/{split} -> .../labels/{split}
		candidates = append(candidates, filepath.Join(filepath.Dir(parent), "labels", base))
	}
	for _, pair := range [][2]string{{"images", "labels"}, {"image", "label"}} {
		if replaced, ok := replaceInsensitive(base, pair[0], pair[1]); ok {
			candidates = append(candidates, filepath.Join(parent, replaced))
		}
	}
	candidates = append(candidates, filepath.Join(imagesAbs, "labels"), filepath.Join(parent, "labels"))

	best, bestCount := imagesAbs, 0
	for _, dir := range candidates {
		count := 0
		for stem := range labelStems(dir) {
			if imageStems[stem] {
				count++
			}
		}
		if count > bestCount {
			best, bestCount = dir, count
		}
	}
	return best
}

func handleBrowse(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimSpace(r.URL.Query().Get("path"))
	if path == "" {
		path = dataRoot
		if path == "" {
			var err error
			if path, err = os.Getwd(); err != nil {
				http.Error(w, "unable to get current directory", http.StatusInternalServerError)
				return
			}
		}
	}
	absPath, rel, err := absDir(path)
	if err != nil {
		if dataRootDir == nil {
			http.Error(w, "invalid path", http.StatusBadRequest)
			return
		}
		absPath, rel = dataRoot, "." // outside data-root: show the root instead
	}

	root, err := openDir(absPath)
	if err != nil {
		http.Error(w, "unable to read directory", http.StatusBadRequest)
		return
	}
	defer root.Close()
	entries, err := fs.ReadDir(root.FS(), ".")
	if err != nil {
		http.Error(w, "unable to read directory", http.StatusInternalServerError)
		return
	}

	resp := browseResponse{Current: absPath, Dirs: []dirEntry{}}
	_, resp.Images, resp.Labels = countEntries(entries)
	for _, entry := range entries {
		if !entry.IsDir() && entry.Type()&os.ModeSymlink == 0 {
			continue
		}
		// Opening through openDir follows symlinks but keeps them inside data-root.
		sub, err := openDir(filepath.Join(absPath, entry.Name()))
		if err != nil {
			continue
		}
		subEntries, err := fs.ReadDir(sub.FS(), ".")
		sub.Close()
		if err != nil {
			continue
		}
		d := dirEntry{Name: entry.Name()}
		d.HasSubdirs, d.Images, d.Labels = countEntries(subEntries)
		resp.Dirs = append(resp.Dirs, d)
	}
	slices.SortFunc(resp.Dirs, func(a, b dirEntry) int {
		return cmp.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name))
	})

	// No parent at the filesystem root or at data-root.
	if parent := filepath.Dir(absPath); parent != absPath && rel != "." {
		resp.Parent = parent
	}
	writeJSON(w, resp)
}

func countEntries(entries []fs.DirEntry) (hasSubdirs bool, images, labels int) {
	for _, e := range entries {
		switch ext := filepath.Ext(e.Name()); {
		case e.IsDir():
			hasSubdirs = true
		case isImageExt(ext):
			images++
		case strings.EqualFold(ext, ".txt"):
			labels++
		}
	}
	return
}

func replaceInsensitive(value, old, new string) (string, bool) {
	if old == "" {
		return value, false
	}
	lower := strings.ToLower(value)
	oldLower := strings.ToLower(old)
	if !strings.Contains(lower, oldLower) {
		return value, false
	}
	var b strings.Builder
	i := 0
	for {
		idx := strings.Index(lower[i:], oldLower)
		if idx < 0 {
			b.WriteString(value[i:])
			break
		}
		idx += i
		b.WriteString(value[i:idx])
		b.WriteString(new)
		i = idx + len(old)
	}
	return b.String(), true
}

func handleImage(w http.ResponseWriter, r *http.Request) {
	file := strings.TrimSpace(r.URL.Query().Get("file"))
	if !isImageExt(filepath.Ext(file)) {
		http.Error(w, "unsupported image type", http.StatusBadRequest)
		return
	}
	root, ok := requireDir(w, "imagesDir", r.URL.Query().Get("imagesDir"))
	if !ok {
		return
	}
	defer root.Close()
	f, err := root.Open(file)
	if err != nil {
		http.Error(w, "image not found", http.StatusNotFound)
		return
	}
	defer f.Close()
	fi, err := f.Stat()
	if err != nil || !fi.Mode().IsRegular() {
		http.Error(w, "image not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	http.ServeContent(w, r, fi.Name(), fi.ModTime(), f)
}

func isLabelFile(name string) bool {
	return strings.EqualFold(filepath.Ext(name), ".txt")
}

func handleLabelsGet(w http.ResponseWriter, r *http.Request) {
	file := strings.TrimSpace(r.URL.Query().Get("file"))
	if !isLabelFile(file) {
		http.Error(w, "labels must be .txt", http.StatusBadRequest)
		return
	}
	root, ok := requireDir(w, "labelsDir", r.URL.Query().Get("labelsDir"))
	if !ok {
		return
	}
	defer root.Close()
	data, err := readOptional(root, file)
	if err != nil {
		http.Error(w, "unable to read labels", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write(data)
}

func handleLabelsHistoryGet(w http.ResponseWriter, r *http.Request) {
	file := strings.TrimSpace(r.URL.Query().Get("file"))
	if !isLabelFile(file) {
		http.Error(w, "labels must be .txt", http.StatusBadRequest)
		return
	}
	root, ok := requireDir(w, "labelsDir", r.URL.Query().Get("labelsDir"))
	if !ok {
		return
	}
	defer root.Close()
	data, err := root.ReadFile(labelHistoryRelPath(file))
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			http.Error(w, "history not found", http.StatusNotFound)
			return
		}
		http.Error(w, "unable to read history", http.StatusInternalServerError)
		return
	}
	var history labelHistory
	if len(data) > 0 {
		if err := json.Unmarshal(data, &history); err != nil {
			http.Error(w, "invalid history", http.StatusInternalServerError)
			return
		}
	}
	writeJSON(w, history)
}

func handleLabelsPost(w http.ResponseWriter, r *http.Request) {
	var payload labelPayload
	if !readJSON(w, r, 8<<20, &payload) {
		return
	}
	payload.File = strings.TrimSpace(payload.File)
	payload.ImageFile = strings.TrimSpace(payload.ImageFile)
	payload.RestoreImage = strings.TrimSpace(payload.RestoreImage)
	if !isLabelFile(payload.File) {
		http.Error(w, "labels must be .txt", http.StatusBadRequest)
		return
	}
	lblRoot, ok := requireDir(w, "labelsDir", payload.LabelsDir)
	if !ok {
		return
	}
	defer lblRoot.Close()
	priorContent, err := readOptional(lblRoot, payload.File)
	if err != nil {
		http.Error(w, "unable to read labels", http.StatusInternalServerError)
		return
	}

	var imgRoot *os.Root
	if payload.Crop != nil || payload.RestoreImage != "" {
		if payload.ImageFile == "" {
			http.Error(w, "imageFile is required for crop/restore", http.StatusBadRequest)
			return
		}
		if imgRoot, ok = requireDir(w, "imagesDir", payload.ImagesDir); !ok {
			return
		}
		defer imgRoot.Close()
	}

	imageArchiveRel := ""
	switch {
	case payload.Crop != nil:
		imageArchiveRel, err = cropAndSaveLabels(imgRoot, lblRoot, payload)
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, errBadRequest) {
				status = http.StatusBadRequest
			}
			http.Error(w, fmt.Sprintf("unable to crop and save: %v", err), status)
			return
		}
	case payload.RestoreImage != "":
		if err := restoreImageFromDeleted(imgRoot, payload.ImageFile, payload.RestoreImage); err != nil {
			http.Error(w, fmt.Sprintf("unable to restore image: %v", err), http.StatusInternalServerError)
			return
		}
		fallthrough
	default:
		if err := writeFileAtomic(lblRoot, payload.File, []byte(payload.Content)); err != nil {
			http.Error(w, "unable to save labels", http.StatusInternalServerError)
			return
		}
	}
	if err := updateLabelHistory(lblRoot, payload, priorContent, imageArchiveRel); err != nil {
		log.Printf("Warning: unable to update label history: %v", err)
	}
	log.Printf("Updated %s (cropped=%t)", payload.File, payload.Crop != nil)
	w.WriteHeader(http.StatusOK)
}

// cropAndSaveLabels replaces the image with its crop and writes the labels. The
// originals are moved into deleted/ (returned image path is relative to imgRoot).
func cropAndSaveLabels(imgRoot, lblRoot *os.Root, payload labelPayload) (string, error) {
	cropped, err := cropImage(imgRoot, payload.ImageFile, *payload.Crop)
	if err != nil {
		return "", err
	}
	tmpImage, err := writeTemp(imgRoot, payload.ImageFile, cropped)
	if err != nil {
		return "", err
	}
	defer imgRoot.Remove(tmpImage)
	tmpLabel, err := writeTemp(lblRoot, payload.File, []byte(payload.Content))
	if err != nil {
		return "", err
	}
	defer lblRoot.Remove(tmpLabel)

	// The image exists (cropImage just read it), so imageArchive is never empty.
	imageArchive, err := moveToDeleted(imgRoot, payload.ImageFile)
	if err != nil {
		return "", err
	}
	if err := imgRoot.Rename(tmpImage, payload.ImageFile); err != nil {
		_ = imgRoot.Rename(imageArchive, payload.ImageFile)
		return "", err
	}
	labelArchive, err := moveToDeleted(lblRoot, payload.File)
	if err == nil {
		if err = lblRoot.Rename(tmpLabel, payload.File); err != nil && labelArchive != "" {
			_ = lblRoot.Rename(labelArchive, payload.File)
		}
	}
	if err != nil {
		_ = imgRoot.Rename(imageArchive, payload.ImageFile)
		return "", err
	}
	return filepath.ToSlash(imageArchive), nil
}

func labelHistoryRelPath(labelFile string) string {
	return filepath.Join("labels-history", trimExt(labelFile)+".json")
}

// readOptional reads name from root; a missing file reads as empty.
func readOptional(root *os.Root, name string) ([]byte, error) {
	data, err := root.ReadFile(name)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	return data, err
}

func updateLabelHistory(root *os.Root, payload labelPayload, priorContent []byte, imageArchiveRel string) error {
	historyRel := labelHistoryRelPath(payload.File)
	data, err := readOptional(root, historyRel)
	if err != nil {
		return err
	}
	historyExists := len(data) > 0
	var history labelHistory
	if historyExists {
		if err := json.Unmarshal(data, &history); err != nil {
			return err
		}
	} else {
		history.Initial = labelHistoryEntry{Content: string(priorContent), ImageRel: imageArchiveRel}
	}
	initialRel := history.Initial.ImageRel
	if initialRel == "" && imageArchiveRel != "" {
		history.Initial.ImageRel = imageArchiveRel
	}
	// A restored image was moved back out of deleted/, so the reference no longer exists.
	if payload.RestoreImage != "" && filepath.Clean(payload.RestoreImage) == filepath.Clean(initialRel) {
		history.Initial.ImageRel = ""
	}

	if historyExists && history.Latest.Content == payload.Content && history.Initial.ImageRel == initialRel {
		return nil
	}
	history.Latest = labelHistoryEntry{
		Content:   payload.Content,
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		Crop:      payload.Crop,
	}
	out, err := json.MarshalIndent(history, "", "  ")
	if err != nil {
		return err
	}
	return writeFileAtomic(root, historyRel, out)
}

// writeTemp writes data to a random temp file next to name and returns its path.
func writeTemp(root *os.Root, name string, data []byte) (string, error) {
	dir := filepath.Dir(name)
	if err := root.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	tmp := filepath.Join(dir, ".goannotate-"+rand.Text()+".tmp")
	if err := root.WriteFile(tmp, data, 0o644); err != nil {
		_ = root.Remove(tmp)
		return "", err
	}
	return tmp, nil
}

// writeFileAtomic writes via a temp file in the same dir and renames it over name,
// so readers never see a partially written file.
func writeFileAtomic(root *os.Root, name string, data []byte) error {
	tmp, err := writeTemp(root, name, data)
	if err != nil {
		return err
	}
	if err := root.Rename(tmp, name); err != nil {
		_ = root.Remove(tmp)
		return err
	}
	return nil
}

func restoreImageFromDeleted(root *os.Root, imageFile, restoreRel string) error {
	rel := filepath.Clean(restoreRel)
	if !strings.HasPrefix(strings.ToLower(filepath.ToSlash(rel)), "deleted/") {
		return errors.New("restore path must be a file under deleted")
	}
	if fi, err := root.Stat(rel); err != nil || !fi.Mode().IsRegular() {
		return errors.New("restore image not found")
	}
	if moved, err := moveToDeleted(root, imageFile); err != nil {
		return err
	} else if moved != "" {
		log.Printf("Archived image %s before restore", imageFile)
	}
	if err := root.MkdirAll(filepath.Dir(imageFile), 0o755); err != nil {
		return err
	}
	return root.Rename(rel, imageFile)
}

// cropImage decodes a jpg/png image from root and returns the encoded crop.
func cropImage(root *os.Root, imageFile string, crop cropRect) ([]byte, error) {
	if crop.W <= 0 || crop.H <= 0 {
		return nil, fmt.Errorf("%w: crop width/height must be > 0", errBadRequest)
	}
	ext := strings.ToLower(filepath.Ext(imageFile))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" {
		return nil, fmt.Errorf("%w: crop supports only jpg and png", errBadRequest)
	}
	f, err := root.Open(imageFile)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", errBadRequest, err)
	}
	img, _, err := image.Decode(f)
	f.Close()
	if err != nil {
		return nil, err
	}
	bounds := img.Bounds()
	if crop.X < 0 || crop.Y < 0 || crop.W > bounds.Dx()-crop.X || crop.H > bounds.Dy()-crop.Y {
		return nil, fmt.Errorf("%w: crop rectangle out of bounds", errBadRequest)
	}
	srcRect := image.Rect(crop.X, crop.Y, crop.X+crop.W, crop.Y+crop.H)
	dst := image.NewRGBA(image.Rect(0, 0, crop.W, crop.H))
	draw.Draw(dst, dst.Bounds(), img, srcRect.Min, draw.Src)

	var buf bytes.Buffer
	if ext == ".png" {
		err = png.Encode(&buf, dst)
	} else {
		err = jpeg.Encode(&buf, dst, &jpeg.Options{Quality: 95})
	}
	return buf.Bytes(), err
}

func handleDeleteImage(w http.ResponseWriter, r *http.Request) {
	var payload deletePayload
	if !readJSON(w, r, 1<<20, &payload) {
		return
	}
	payload.File = strings.TrimSpace(payload.File)
	if !isImageExt(filepath.Ext(payload.File)) {
		http.Error(w, "unsupported image type", http.StatusBadRequest)
		return
	}
	imgRoot, ok := requireDir(w, "imagesDir", payload.ImagesDir)
	if !ok {
		return
	}
	defer imgRoot.Close()

	result := deleteResponse{}
	moved, err := moveToDeleted(imgRoot, payload.File)
	if err != nil {
		http.Error(w, "unable to delete image", http.StatusInternalServerError)
		return
	}
	result.DeletedImage = moved != ""

	if strings.TrimSpace(payload.LabelsDir) != "" {
		lblRoot, ok := requireDir(w, "labelsDir", payload.LabelsDir)
		if !ok {
			return
		}
		defer lblRoot.Close()
		moved, err := moveToDeleted(lblRoot, trimExt(payload.File)+".txt")
		if err != nil {
			http.Error(w, "unable to delete label", http.StatusInternalServerError)
			return
		}
		result.DeletedLabel = moved != ""
	}

	log.Printf("Deleted image=%q label=%t (archived)", payload.File, result.DeletedLabel)
	writeJSON(w, result)
}

func handleReviewStatusGet(w http.ResponseWriter, r *http.Request) {
	root, ok := requireDir(w, "labelsDir", r.URL.Query().Get("labelsDir"))
	if !ok {
		return
	}
	defer root.Close()
	data, err := readOptional(root, reviewStatusFilename)
	if err != nil {
		http.Error(w, "unable to read review status", http.StatusInternalServerError)
		return
	}
	resp := reviewStatusResponse{Done: []string{}}
	if len(data) > 0 {
		if err := json.Unmarshal(data, &resp); err != nil {
			http.Error(w, "invalid review status", http.StatusInternalServerError)
			return
		}
	}
	writeJSON(w, resp)
}

func handleReviewStatusPost(w http.ResponseWriter, r *http.Request) {
	var payload reviewStatusPayload
	if !readJSON(w, r, 1<<20, &payload) {
		return
	}
	root, ok := requireDir(w, "labelsDir", payload.LabelsDir)
	if !ok {
		return
	}
	defer root.Close()
	done := make([]string, 0, len(payload.Done))
	for _, item := range payload.Done {
		if trimmed := strings.TrimSpace(item); trimmed != "" {
			done = append(done, trimmed)
		}
	}
	if len(done) == 0 {
		if err := root.Remove(reviewStatusFilename); err != nil && !errors.Is(err, fs.ErrNotExist) {
			http.Error(w, "unable to clear review status", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		return
	}
	slices.Sort(done)
	done = slices.Compact(done)
	data, err := json.MarshalIndent(reviewStatusResponse{Done: done}, "", "  ")
	if err != nil {
		http.Error(w, "unable to encode review status", http.StatusInternalServerError)
		return
	}
	if err := writeFileAtomic(root, reviewStatusFilename, data); err != nil {
		http.Error(w, "unable to save review status", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// readJSON decodes a size-limited JSON body into v, writing a 400 on failure.
func readJSON(w http.ResponseWriter, r *http.Request, limit int64, v any) bool {
	data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, limit))
	if err == nil {
		err = json.Unmarshal(data, v)
	}
	if err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json")
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	if err := enc.Encode(payload); err != nil {
		http.Error(w, "unable to encode json", http.StatusInternalServerError)
	}
}

func trimExt(name string) string {
	return strings.TrimSuffix(name, filepath.Ext(name))
}

func isImageExt(ext string) bool {
	switch strings.ToLower(ext) {
	case ".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff":
		return true
	default:
		return false
	}
}

// moveToDeleted moves rel into root's deleted/ subfolder and returns the new
// relative path, or "" when rel does not exist.
func moveToDeleted(root *os.Root, rel string) (string, error) {
	if _, err := root.Stat(rel); err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return "", nil
		}
		return "", err
	}
	dst, err := uniqueDeletedPath(root, filepath.Join("deleted", rel))
	if err != nil {
		return "", err
	}
	if err := root.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return "", err
	}
	if err := root.Rename(rel, dst); err != nil {
		return "", err
	}
	return dst, nil
}

func uniqueDeletedPath(root *os.Root, path string) (string, error) {
	exists := func(p string) (bool, error) {
		_, err := root.Stat(p)
		if errors.Is(err, fs.ErrNotExist) {
			return false, nil
		}
		return err == nil, err
	}
	if ok, err := exists(path); !ok || err != nil {
		return path, err
	}
	ext := filepath.Ext(path)
	name := strings.TrimSuffix(path, ext)
	stamp := time.Now().Format("20060102-150405")
	for i := 1; i <= 9999; i++ {
		candidate := fmt.Sprintf("%s-%s%s", name, stamp, ext)
		if i > 1 {
			candidate = fmt.Sprintf("%s-%s-%d%s", name, stamp, i, ext)
		}
		if ok, err := exists(candidate); !ok || err != nil {
			return candidate, err
		}
	}
	return "", errors.New("unable to allocate deleted filename")
}
