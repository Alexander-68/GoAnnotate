package main

import (
	"cmp"
	"embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
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

type listResponse struct {
	Images []imageEntry `json:"images"`
}

type browseResponse struct {
	Current string   `json:"current"`
	Parent  string   `json:"parent"`
	Dirs    []string `json:"dirs"`
}

type imageEntry struct {
	Name        string `json:"name"`
	LabelExists bool   `json:"labelExists"`
}

type labelPayload struct {
	LabelsDir string `json:"labelsDir"`
	File      string `json:"file"`
	Content   string `json:"content"`
}

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
	}

	log.Printf("Starting GoAnnotate with: ip=%s, port=%d, data-root=%q", *ip, *port, *dr)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/list", handleList)
	mux.HandleFunc("GET /api/image", handleImage)
	mux.HandleFunc("GET /api/labels", handleLabelsGet)
	mux.HandleFunc("POST /api/labels", handleLabelsPost)
	mux.HandleFunc("GET /api/browse", handleBrowse)
	mux.HandleFunc("GET /api/suggest_labels", handleSuggestLabels)
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
	var labelsAbs string
	if labelsDir != "" {
		labelsAbs, err = filepath.Abs(labelsDir)
		if err != nil {
			http.Error(w, "invalid labelsDir", http.StatusBadRequest)
			return
		}
	}

	entries, err := os.ReadDir(imagesAbs)
	if err != nil {
		http.Error(w, "unable to read imagesDir", http.StatusInternalServerError)
		return
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
	writeJSON(w, listResponse{Images: images})
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
		// Ensure absPath is inside dataRoot
		if !strings.HasPrefix(strings.ToLower(absPath), strings.ToLower(dataRoot)) {
			absPath = dataRoot
		}
	}

	entries, err := os.ReadDir(absPath)
	if err != nil {
		http.Error(w, "unable to read directory", http.StatusInternalServerError)
		return
	}

	var dirs []string
	for _, entry := range entries {
		if entry.IsDir() || (entry.Type()&os.ModeSymlink != 0) {
			if entry.Type()&os.ModeSymlink != 0 {
				fi, err := os.Stat(filepath.Join(absPath, entry.Name()))
				if err != nil || !fi.IsDir() {
					continue
				}
			}
			dirs = append(dirs, entry.Name())
		}
	}

	slices.SortFunc(dirs, func(a, b string) int {
		return cmp.Compare(strings.ToLower(a), strings.ToLower(b))
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

	// 2. Check images/labels
	try1 := filepath.Join(absImages, "labels")
	if isDir(try1) {
		writeJSON(w, map[string]string{"labelsDir": try1})
		return
	}

	// 3. Check ../labels
	try2 := filepath.Join(parent, "labels")
	if isDir(try2) {
		writeJSON(w, map[string]string{"labelsDir": try2})
		return
	}

	// 4. Default to parent
	writeJSON(w, map[string]string{"labelsDir": parent})
}

func isDir(path string) bool {
	fi, err := os.Stat(path)
	return err == nil && fi.IsDir()
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
	if payload.LabelsDir == "" || payload.File == "" {
		http.Error(w, "labelsDir and file are required", http.StatusBadRequest)
		return
	}
	if !strings.HasSuffix(strings.ToLower(payload.File), ".txt") {
		http.Error(w, "labels must be .txt", http.StatusBadRequest)
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
	return fullAbs, nil
}
