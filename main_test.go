package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSafeJoin(t *testing.T) {
	base := t.TempDir()
	for _, rel := range []string{"a.txt", "sub/a.txt", "./a.txt"} {
		if _, err := safeJoin(base, rel); err != nil {
			t.Errorf("safeJoin(%q) unexpected error: %v", rel, err)
		}
	}
	for _, rel := range []string{"", "..", "../a.txt", "sub/../../a.txt", filepath.Join(base, "a.txt")} {
		if _, err := safeJoin(base, rel); err == nil {
			t.Errorf("safeJoin(%q) expected error", rel)
		}
	}
	if !isWithinBase(base, base) || isWithinBase(base, filepath.Dir(base)) {
		t.Error("isWithinBase wrong for base/parent")
	}
}

func TestRestoreRejectsDeletedDir(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "deleted"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "img.jpg"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	for _, rel := range []string{"deleted", "deleted/missing.jpg", "other/img.jpg"} {
		if err := restoreImageFromDeleted(dir, "img.jpg", rel); err == nil {
			t.Errorf("restore %q expected error", rel)
		}
	}
	if _, err := os.Stat(filepath.Join(dir, "img.jpg")); err != nil {
		t.Error("current image must stay in place when restore is rejected")
	}
}

func TestHistoryWriteLeavesNoBackups(t *testing.T) {
	dir := t.TempDir()
	p := labelPayload{LabelsDir: dir, File: "a.txt"}
	for _, c := range []string{"1", "2", "3"} {
		p.Content = c
		if err := updateLabelHistory(p, "0", ""); err != nil {
			t.Fatal(err)
		}
	}
	entries, _ := os.ReadDir(filepath.Join(dir, "labels-history"))
	if len(entries) != 1 {
		t.Errorf("expected only a.json in labels-history, got %d entries", len(entries))
	}
}
