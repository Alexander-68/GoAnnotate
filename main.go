package main

import (
	"embed"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

//go:embed web/*
var webContent embed.FS

type listResponse struct {
	Images []imageEntry `json:"images"`
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
	mux := http.NewServeMux()
	mux.HandleFunc("/api/list", handleList)
	mux.HandleFunc("/api/image", handleImage)
	mux.HandleFunc("/api/labels", handleLabels)
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	webFS, err := fs.Sub(webContent, "web")
	if err != nil {
		log.Fatalf("web assets: %v", err)
	}
	fileServer := http.FileServer(http.FS(webFS))
	mux.Handle("/", fileServer)

	addr := "127.0.0.1:8080"
	log.Printf("GoAnnotate running at http://%s", addr)
	log.Fatal(http.ListenAndServe(addr, logRequests(mux)))
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		dur := time.Since(start).Truncate(time.Millisecond)
		log.Printf("%s %s (%s)", r.Method, r.URL.Path, dur)
	})
}

func handleList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
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
			}
		}
		images = append(images, imageEntry{Name: name, LabelExists: labelExists})
	}

	sort.Slice(images, func(i, j int) bool {
		return strings.ToLower(images[i].Name) < strings.ToLower(images[j].Name)
	})

	writeJSON(w, listResponse{Images: images})
}

func handleImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	imagesDir := strings.TrimSpace(r.URL.Query().Get("imagesDir"))
	file := strings.TrimSpace(r.URL.Query().Get("file"))
	if imagesDir == "" || file == "" {
		http.Error(w, "imagesDir and file are required", http.StatusBadRequest)
		return
	}
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

func handleLabels(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
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
	case http.MethodPost:
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
		w.WriteHeader(http.StatusOK)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
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
