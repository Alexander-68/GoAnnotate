package main

import (
	"cmp"
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
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

//go:embed web/*
var webContent embed.FS
var dataRoot string
var dataRootResolved string

type listResponse struct {
	Images     []imageEntry `json:"images"`
	LabelFiles int          `json:"labelFiles"`
}

type browseResponse struct {
	Current string     `json:"current"`
	Parent  string     `json:"parent"`
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
	LabelsDir string    `json:"labelsDir"`
	File      string    `json:"file"`
	Content   string    `json:"content"`
	ImagesDir string    `json:"imagesDir"`
	ImageFile string    `json:"imageFile"`
	Crop      *cropRect `json:"crop"`
}

type cropRect struct {
	X int `json:"x"`
	Y int `json:"y"`
	W int `json:"w"`
	H int `json:"h"`
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
		dataRoot = abs
		if resolved, err := filepath.EvalSymlinks(abs); err == nil {
			dataRootResolved = resolved
		} else {
			dataRootResolved = abs
		}
	}

	log.Printf("Starting GoAnnotate with: ip=%s, port=%d, data-root=%q", *ip, *port, *dr)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/list", handleList)
	mux.HandleFunc("GET /api/image", handleImage)
	mux.HandleFunc("GET /api/labels", handleLabelsGet)
	mux.HandleFunc("POST /api/labels", handleLabelsPost)
	mux.HandleFunc("POST /api/delete_image", handleDeleteImage)
	mux.HandleFunc("GET /api/browse", handleBrowse)
	mux.HandleFunc("GET /api/suggest_labels", handleSuggestLabels)
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
	log.Fatal(http.ListenAndServe(addr, logRequests(mux)))
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

func handleList(w http.ResponseWriter, r *http.Request) {
	imagesDir := strings.TrimSpace(r.URL.Query().Get("imagesDir"))
	labelsDir := strings.TrimSpace(r.URL.Query().Get("labelsDir"))
	if imagesDir == "" {
		http.Error(w, "imagesDir is required", http.StatusBadRequest)
		return
	}

	imagesAbs, err := filepath.Abs(imagesDir)
	if err != nil {
		http.Error(w, "invalid imagesDir", http.StatusBadRequest)
		return
	}
	if err := enforceDataRootResolved(imagesAbs); err != nil {
		http.Error(w, "imagesDir outside data-root", http.StatusBadRequest)
		return
	}
	var labelsAbs string
	if labelsDir != "" {
		labelsAbs, err = filepath.Abs(labelsDir)
		if err != nil {
			http.Error(w, "invalid labelsDir", http.StatusBadRequest)
			return
		}
		if err := enforceDataRootResolved(labelsAbs); err != nil {
			http.Error(w, "labelsDir outside data-root", http.StatusBadRequest)
			return
		}
	}

	entries, err := os.ReadDir(imagesAbs)
	if err != nil {
		http.Error(w, "unable to read imagesDir", http.StatusInternalServerError)
		return
	}

	labelFiles := 0
	if labelsAbs != "" {
		labelEntries, err := os.ReadDir(labelsAbs)
		if err == nil {
			for _, entry := range labelEntries {
				if entry.IsDir() {
					continue
				}
				if strings.HasSuffix(strings.ToLower(entry.Name()), ".txt") {
					labelFiles++
				}
			}
		}
	}

	var images []imageEntry
	labeledCount := 0
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		ext := strings.ToLower(filepath.Ext(name))
		if !isImageExt(ext) {
			continue
		}
		labelExists := false
		if labelsAbs != "" {
			labelPath := filepath.Join(labelsAbs, trimExt(name)+".txt")
			if _, err := os.Stat(labelPath); err == nil {
				labelExists = true
				labeledCount++
			}
		}
		images = append(images, imageEntry{Name: name, LabelExists: labelExists})
	}

	slices.SortFunc(images, func(a, b imageEntry) int {
		return cmp.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name))
	})

	log.Printf("Loaded dataset imagesDir=%q labelsDir=%q images=%d labeled=%d",
		imagesAbs, labelsAbs, len(images), labeledCount)
	writeJSON(w, listResponse{Images: images, LabelFiles: labelFiles})
}

func handleBrowse(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimSpace(r.URL.Query().Get("path"))
	if path == "" {
		if dataRoot != "" {
			path = dataRoot
		} else {
			var err error
			path, err = os.Getwd()
			if err != nil {
				http.Error(w, "unable to get current directory", http.StatusInternalServerError)
				return
			}
		}
	}

	absPath, err := filepath.Abs(path)
	if err != nil {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}

	if dataRoot != "" {
		if err := enforceDataRootResolved(absPath); err != nil {
			absPath = dataRoot
		}
	}

	entries, err := os.ReadDir(absPath)
	if err != nil {
		http.Error(w, "unable to read directory", http.StatusInternalServerError)
		return
	}

	var dirs []dirEntry
	for _, entry := range entries {
		if entry.IsDir() || (entry.Type()&os.ModeSymlink != 0) {
			isDir := entry.IsDir()
			fullSubPath := filepath.Join(absPath, entry.Name())
			if !isDir {
				// verify symlink
				fi, err := os.Stat(fullSubPath)
				if err != nil || !fi.IsDir() {
					continue
				}
			}
			if err := enforceDataRootResolved(fullSubPath); err != nil {
				continue
			}

			// Analyze content of the subdirectory
			hasSubdirs := false
			imgCount := 0
			lblCount := 0

			subEntries, _ := os.ReadDir(fullSubPath)
			for _, sub := range subEntries {
				if sub.IsDir() {
					hasSubdirs = true
				} else {
					sl := strings.ToLower(sub.Name())
					if isImageExt(filepath.Ext(sl)) {
						imgCount++
					} else if strings.HasSuffix(sl, ".txt") {
						lblCount++
					}
				}
			}

			dirs = append(dirs, dirEntry{
				Name:       entry.Name(),
				HasSubdirs: hasSubdirs,
				Images:     imgCount,
				Labels:     lblCount,
			})
		}
	}

	slices.SortFunc(dirs, func(a, b dirEntry) int {
		return cmp.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name))
	})

	parent := filepath.Dir(absPath)
	if parent == absPath {
		parent = "" // We are at the root
	}
	if dataRoot != "" && strings.EqualFold(absPath, dataRoot) {
		parent = "" // We are at the data-root, prevent going up
	}

	writeJSON(w, browseResponse{
		Current: absPath,
		Parent:  parent,
		Dirs:    dirs,
	})
}

func handleSuggestLabels(w http.ResponseWriter, r *http.Request) {
	imagesDir := strings.TrimSpace(r.URL.Query().Get("imagesDir"))
	if imagesDir == "" {
		http.Error(w, "imagesDir required", http.StatusBadRequest)
		return
	}
	absImages, err := filepath.Abs(imagesDir)
	if err != nil {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	if err := enforceDataRootResolved(absImages); err != nil {
		http.Error(w, "imagesDir outside data-root", http.StatusBadRequest)
		return
	}

	parent := filepath.Dir(absImages)

	// 1. Check .../images/{subdir} -> .../labels/{subdir}
	if strings.EqualFold(filepath.Base(parent), "images") {
		subdir := filepath.Base(absImages)
		grandparent := filepath.Dir(parent)
		tryYolo := filepath.Join(grandparent, "labels", subdir)
		if isDir(tryYolo) {
			writeJSON(w, map[string]string{"labelsDir": tryYolo})
			return
		}
	}

	// 2. Check sibling folder by replacing "images"/"image" in the name.
	base := filepath.Base(absImages)
	if replaced, ok := replaceInsensitive(base, "images", "labels"); ok {
		trySibling := filepath.Join(parent, replaced)
		if isDir(trySibling) {
			writeJSON(w, map[string]string{"labelsDir": trySibling})
			return
		}
	}
	if replaced, ok := replaceInsensitive(base, "image", "label"); ok {
		trySibling := filepath.Join(parent, replaced)
		if isDir(trySibling) {
			writeJSON(w, map[string]string{"labelsDir": trySibling})
			return
		}
	}

	// 3. Check images/labels
	try1 := filepath.Join(absImages, "labels")
	if isDir(try1) {
		writeJSON(w, map[string]string{"labelsDir": try1})
		return
	}

	// 4. Check ../labels
	try2 := filepath.Join(parent, "labels")
	if isDir(try2) {
		writeJSON(w, map[string]string{"labelsDir": try2})
		return
	}

	// 5. Default to parent
	writeJSON(w, map[string]string{"labelsDir": parent})
}

func isDir(path string) bool {
	fi, err := os.Stat(path)
	return err == nil && fi.IsDir()
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
	imagesDir := strings.TrimSpace(r.URL.Query().Get("imagesDir"))
	file := strings.TrimSpace(r.URL.Query().Get("file"))
	if imagesDir == "" || file == "" {
		http.Error(w, "imagesDir and file are required", http.StatusBadRequest)
		return
	}
	log.Println(file)
	fullPath, err := safeJoin(imagesDir, file)
	if err != nil {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	if !isImageExt(strings.ToLower(filepath.Ext(fullPath))) {
		http.Error(w, "unsupported image type", http.StatusBadRequest)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	if ct := mime.TypeByExtension(filepath.Ext(fullPath)); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	http.ServeFile(w, r, fullPath)
}

func handleLabelsGet(w http.ResponseWriter, r *http.Request) {
	labelsDir := strings.TrimSpace(r.URL.Query().Get("labelsDir"))
	file := strings.TrimSpace(r.URL.Query().Get("file"))
	if labelsDir == "" || file == "" {
		http.Error(w, "labelsDir and file are required", http.StatusBadRequest)
		return
	}
	if !strings.HasSuffix(strings.ToLower(file), ".txt") {
		http.Error(w, "labels must be .txt", http.StatusBadRequest)
		return
	}
	fullPath, err := safeJoin(labelsDir, file)
	if err != nil {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	data, err := os.ReadFile(fullPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			w.WriteHeader(http.StatusOK)
			return
		}
		http.Error(w, "unable to read labels", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write(data)
}

func handleLabelsPost(w http.ResponseWriter, r *http.Request) {
	body := http.MaxBytesReader(w, r.Body, 8<<20)
	defer body.Close()
	payloadBytes, err := io.ReadAll(body)
	if err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	var payload labelPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	payload.LabelsDir = strings.TrimSpace(payload.LabelsDir)
	payload.File = strings.TrimSpace(payload.File)
	payload.ImagesDir = strings.TrimSpace(payload.ImagesDir)
	payload.ImageFile = strings.TrimSpace(payload.ImageFile)
	if payload.LabelsDir == "" || payload.File == "" {
		http.Error(w, "labelsDir and file are required", http.StatusBadRequest)
		return
	}
	if !strings.HasSuffix(strings.ToLower(payload.File), ".txt") {
		http.Error(w, "labels must be .txt", http.StatusBadRequest)
		return
	}
	if payload.Crop != nil {
		if payload.ImagesDir == "" || payload.ImageFile == "" {
			http.Error(w, "imagesDir and imageFile are required for crop", http.StatusBadRequest)
			return
		}
		if err := cropAndSaveLabels(payload); err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, errBadRequest) {
				status = http.StatusBadRequest
			}
			http.Error(w, fmt.Sprintf("unable to crop and save: %v", err), status)
			return
		}
		log.Printf("Updated %s (cropped)", payload.File)
		w.WriteHeader(http.StatusOK)
		return
	}
	fullPath, err := safeJoin(payload.LabelsDir, payload.File)
	if err != nil {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
		http.Error(w, "unable to create labels dir", http.StatusInternalServerError)
		return
	}
	if err := os.WriteFile(fullPath, []byte(payload.Content), 0o644); err != nil {
		http.Error(w, "unable to save labels", http.StatusInternalServerError)
		return
	}
	log.Printf("Updated %s", payload.File)
	w.WriteHeader(http.StatusOK)
}

func cropAndSaveLabels(payload labelPayload) error {
	tmpImagePath, imagePath, err := cropImageToTemp(payload.ImagesDir, payload.ImageFile, *payload.Crop)
	if err != nil {
		return err
	}
	defer func() {
		_ = os.Remove(tmpImagePath)
	}()

	labelPath, err := safeJoin(payload.LabelsDir, payload.File)
	if err != nil {
		return fmt.Errorf("%w: %v", errBadRequest, err)
	}
	if err := os.MkdirAll(filepath.Dir(labelPath), 0o755); err != nil {
		return err
	}
	tmpLabelPath, err := writeTempFile(filepath.Dir(labelPath), "goannotate-label-*.tmp", []byte(payload.Content), 0o644)
	if err != nil {
		return err
	}
	defer func() {
		_ = os.Remove(tmpLabelPath)
	}()

	imageBackup, imageHadOriginal, err := replaceWithTemp(tmpImagePath, imagePath)
	if err != nil {
		return err
	}
	labelBackup, labelHadOriginal, err := replaceWithTemp(tmpLabelPath, labelPath)
	if err != nil {
		rollbackReplace(imagePath, imageBackup, imageHadOriginal)
		return err
	}

	if imageHadOriginal {
		if err := archiveBackup(payload.ImagesDir, imageBackup, payload.ImageFile); err != nil {
			log.Printf("Warning: unable to archive image backup: %v", err)
		}
	}
	if labelHadOriginal {
		if err := archiveBackup(payload.LabelsDir, labelBackup, payload.File); err != nil {
			log.Printf("Warning: unable to archive label backup: %v", err)
		}
	}
	return nil
}

func cropImageToTemp(imagesDir, imageFile string, crop cropRect) (string, string, error) {
	if crop.W <= 0 || crop.H <= 0 {
		return "", "", fmt.Errorf("%w: crop width/height must be > 0", errBadRequest)
	}
	fullPath, err := safeJoin(imagesDir, imageFile)
	if err != nil {
		return "", "", fmt.Errorf("%w: %v", errBadRequest, err)
	}
	ext := strings.ToLower(filepath.Ext(fullPath))
	if !isImageExt(ext) {
		return "", "", fmt.Errorf("%w: unsupported image type", errBadRequest)
	}
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" {
		return "", "", fmt.Errorf("%w: crop supports only jpg and png", errBadRequest)
	}
	srcFile, err := os.Open(fullPath)
	if err != nil {
		return "", "", err
	}
	img, _, err := image.Decode(srcFile)
	if err != nil {
		_ = srcFile.Close()
		return "", "", err
	}
	if err := srcFile.Close(); err != nil {
		return "", "", err
	}
	bounds := img.Bounds()
	if crop.X < 0 || crop.Y < 0 || crop.X+crop.W > bounds.Dx() || crop.Y+crop.H > bounds.Dy() {
		return "", "", fmt.Errorf("%w: crop rectangle out of bounds", errBadRequest)
	}
	srcRect := image.Rect(crop.X, crop.Y, crop.X+crop.W, crop.Y+crop.H)
	dst := image.NewRGBA(image.Rect(0, 0, crop.W, crop.H))
	draw.Draw(dst, dst.Bounds(), img, srcRect.Min, draw.Src)

	tmpFile, err := os.CreateTemp(filepath.Dir(fullPath), "goannotate-crop-*.tmp")
	if err != nil {
		return "", "", err
	}
	tmpName := tmpFile.Name()
	var encodeErr error
	switch ext {
	case ".jpg", ".jpeg":
		encodeErr = jpeg.Encode(tmpFile, dst, &jpeg.Options{Quality: 95})
	case ".png":
		encodeErr = png.Encode(tmpFile, dst)
	}
	if encodeErr != nil {
		_ = tmpFile.Close()
		_ = os.Remove(tmpName)
		return "", "", encodeErr
	}
	if err := tmpFile.Close(); err != nil {
		_ = os.Remove(tmpName)
		return "", "", err
	}
	return tmpName, fullPath, nil
}

func writeTempFile(dir, pattern string, data []byte, mode fs.FileMode) (string, error) {
	tmpFile, err := os.CreateTemp(dir, pattern)
	if err != nil {
		return "", err
	}
	tmpName := tmpFile.Name()
	if _, err := tmpFile.Write(data); err != nil {
		_ = tmpFile.Close()
		_ = os.Remove(tmpName)
		return "", err
	}
	if err := tmpFile.Close(); err != nil {
		_ = os.Remove(tmpName)
		return "", err
	}
	if err := os.Chmod(tmpName, mode); err != nil {
		_ = os.Remove(tmpName)
		return "", err
	}
	return tmpName, nil
}

func replaceWithTemp(tempPath, targetPath string) (string, bool, error) {
	if tempPath == "" {
		return "", false, errors.New("missing temp file")
	}
	if _, err := os.Stat(targetPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			if err := os.Rename(tempPath, targetPath); err != nil {
				return "", false, err
			}
			return "", false, nil
		}
		return "", false, err
	}
	backupPath, err := uniqueBackupPath(targetPath)
	if err != nil {
		return "", false, err
	}
	if err := os.Rename(targetPath, backupPath); err != nil {
		return "", false, err
	}
	if err := os.Rename(tempPath, targetPath); err != nil {
		_ = os.Rename(backupPath, targetPath)
		return "", false, err
	}
	return backupPath, true, nil
}

func rollbackReplace(targetPath, backupPath string, hadOriginal bool) {
	if hadOriginal {
		_ = os.Remove(targetPath)
		_ = os.Rename(backupPath, targetPath)
		return
	}
	_ = os.Remove(targetPath)
}

func uniqueBackupPath(targetPath string) (string, error) {
	dir := filepath.Dir(targetPath)
	base := filepath.Base(targetPath)
	tmpFile, err := os.CreateTemp(dir, base+".bak-")
	if err != nil {
		return "", err
	}
	backupPath := tmpFile.Name()
	if err := tmpFile.Close(); err != nil {
		_ = os.Remove(backupPath)
		return "", err
	}
	if err := os.Remove(backupPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	return backupPath, nil
}

func archiveBackup(baseDir, backupPath, originalRel string) error {
	if backupPath == "" {
		return nil
	}
	deletedRel := filepath.Join("deleted", originalRel)
	dstPath, err := safeJoin(baseDir, deletedRel)
	if err != nil {
		return err
	}
	uniquePath, err := uniqueDeletedPath(dstPath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(uniquePath), 0o755); err != nil {
		return err
	}
	return os.Rename(backupPath, uniquePath)
}

func handleDeleteImage(w http.ResponseWriter, r *http.Request) {
	body := http.MaxBytesReader(w, r.Body, 1<<20)
	defer body.Close()
	payloadBytes, err := io.ReadAll(body)
	if err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	var payload deletePayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	payload.ImagesDir = strings.TrimSpace(payload.ImagesDir)
	payload.LabelsDir = strings.TrimSpace(payload.LabelsDir)
	payload.File = strings.TrimSpace(payload.File)
	if payload.ImagesDir == "" || payload.File == "" {
		http.Error(w, "imagesDir and file are required", http.StatusBadRequest)
		return
	}
	imagePath, err := safeJoin(payload.ImagesDir, payload.File)
	if err != nil {
		http.Error(w, "invalid image path", http.StatusBadRequest)
		return
	}
	if !isImageExt(strings.ToLower(filepath.Ext(imagePath))) {
		http.Error(w, "unsupported image type", http.StatusBadRequest)
		return
	}

	result := deleteResponse{}
	if _, moved, err := moveFileToDeleted(payload.ImagesDir, payload.File); err != nil {
		http.Error(w, "unable to delete image", http.StatusInternalServerError)
		return
	} else if moved {
		result.DeletedImage = true
	}

	if payload.LabelsDir != "" {
		labelName := trimExt(payload.File) + ".txt"
		if _, moved, err := moveFileToDeleted(payload.LabelsDir, labelName); err != nil {
			http.Error(w, "unable to delete label", http.StatusInternalServerError)
			return
		} else if moved {
			result.DeletedLabel = true
		}
	}

	log.Printf("Deleted image=%q label=%t (archived)", payload.File, result.DeletedLabel)
	writeJSON(w, result)
}

func handleReviewStatusGet(w http.ResponseWriter, r *http.Request) {
	labelsDir := strings.TrimSpace(r.URL.Query().Get("labelsDir"))
	if labelsDir == "" {
		http.Error(w, "labelsDir is required", http.StatusBadRequest)
		return
	}
	fullPath, err := safeJoin(labelsDir, reviewStatusFilename)
	if err != nil {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	data, err := os.ReadFile(fullPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			writeJSON(w, reviewStatusResponse{Done: []string{}})
			return
		}
		http.Error(w, "unable to read review status", http.StatusInternalServerError)
		return
	}
	if len(data) == 0 {
		writeJSON(w, reviewStatusResponse{Done: []string{}})
		return
	}
	var payload reviewStatusResponse
	if err := json.Unmarshal(data, &payload); err != nil {
		http.Error(w, "invalid review status", http.StatusInternalServerError)
		return
	}
	writeJSON(w, reviewStatusResponse{Done: payload.Done})
}

func handleReviewStatusPost(w http.ResponseWriter, r *http.Request) {
	body := http.MaxBytesReader(w, r.Body, 1<<20)
	defer body.Close()
	payloadBytes, err := io.ReadAll(body)
	if err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	var payload reviewStatusPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	payload.LabelsDir = strings.TrimSpace(payload.LabelsDir)
	if payload.LabelsDir == "" {
		http.Error(w, "labelsDir is required", http.StatusBadRequest)
		return
	}
	fullPath, err := safeJoin(payload.LabelsDir, reviewStatusFilename)
	if err != nil {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	done := make([]string, 0, len(payload.Done))
	for _, item := range payload.Done {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" {
			continue
		}
		done = append(done, trimmed)
	}
	if len(done) == 0 {
		if err := os.Remove(fullPath); err != nil && !errors.Is(err, os.ErrNotExist) {
			http.Error(w, "unable to clear review status", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		return
	}
	slices.Sort(done)
	done = slices.Compact(done)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
		http.Error(w, "unable to create labels dir", http.StatusInternalServerError)
		return
	}
	data, err := json.MarshalIndent(reviewStatusResponse{Done: done}, "", "  ")
	if err != nil {
		http.Error(w, "unable to encode review status", http.StatusInternalServerError)
		return
	}
	if err := os.WriteFile(fullPath, data, 0o644); err != nil {
		http.Error(w, "unable to save review status", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
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
	ext := filepath.Ext(name)
	return strings.TrimSuffix(name, ext)
}

func isImageExt(ext string) bool {
	switch strings.ToLower(ext) {
	case ".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff":
		return true
	default:
		return false
	}
}

func moveFileToDeleted(baseDir, relPath string) (string, bool, error) {
	srcPath, err := safeJoin(baseDir, relPath)
	if err != nil {
		return "", false, err
	}
	if _, err := os.Stat(srcPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", false, nil
		}
		return "", false, err
	}
	deletedRel := filepath.Join("deleted", relPath)
	dstPath, err := safeJoin(baseDir, deletedRel)
	if err != nil {
		return "", false, err
	}
	uniquePath, err := uniqueDeletedPath(dstPath)
	if err != nil {
		return "", false, err
	}
	if err := os.MkdirAll(filepath.Dir(uniquePath), 0o755); err != nil {
		return "", false, err
	}
	if err := os.Rename(srcPath, uniquePath); err != nil {
		return "", false, err
	}
	return uniquePath, true, nil
}

func uniqueDeletedPath(path string) (string, error) {
	if _, err := os.Stat(path); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return path, nil
		}
		return "", err
	}
	dir := filepath.Dir(path)
	base := filepath.Base(path)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)
	stamp := time.Now().Format("20060102-150405")
	for i := 1; i <= 9999; i++ {
		suffix := fmt.Sprintf("%s-%s", name, stamp)
		if i > 1 {
			suffix = fmt.Sprintf("%s-%s-%d", name, stamp, i)
		}
		candidate := filepath.Join(dir, suffix+ext)
		if _, err := os.Stat(candidate); err != nil {
			if errors.Is(err, os.ErrNotExist) {
				return candidate, nil
			}
			return "", err
		}
	}
	return "", errors.New("unable to allocate deleted filename")
}

func safeJoin(baseDir, rel string) (string, error) {
	if baseDir == "" {
		return "", errors.New("missing base dir")
	}
	if rel == "" {
		return "", errors.New("missing file")
	}
	if filepath.IsAbs(rel) {
		return "", errors.New("file must be relative")
	}
	baseAbs, err := filepath.Abs(baseDir)
	if err != nil {
		return "", err
	}
	if err := enforceDataRootResolved(baseAbs); err != nil {
		return "", err
	}
	fullAbs, err := filepath.Abs(filepath.Join(baseAbs, rel))
	if err != nil {
		return "", err
	}
	relPath, err := filepath.Rel(baseAbs, fullAbs)
	if err != nil {
		return "", err
	}
	if relPath == ".." || strings.HasPrefix(relPath, ".."+string(os.PathSeparator)) {
		return "", errors.New("invalid path")
	}
	if err := enforceDataRoot(fullAbs); err != nil {
		return "", err
	}
	if err := enforceDataRootResolved(filepath.Dir(fullAbs)); err != nil {
		return "", err
	}
	return fullAbs, nil
}

func enforceDataRoot(path string) error {
	if dataRoot == "" {
		return nil
	}
	if !isWithinBase(dataRoot, path) {
		return errors.New("path outside data-root")
	}
	return nil
}

func enforceDataRootResolved(path string) error {
	if dataRoot == "" {
		return nil
	}
	root := dataRootResolved
	if root == "" {
		root = dataRoot
	}
	resolved, err := filepath.EvalSymlinks(path)
	if err != nil {
		return enforceDataRoot(path)
	}
	if !isWithinBase(root, resolved) {
		return errors.New("path outside data-root")
	}
	return nil
}

func isWithinBase(base, target string) bool {
	rel, err := filepath.Rel(base, target)
	if err != nil {
		return false
	}
	if rel == "." {
		return true
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))
}
