package file

import (
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// allowed extension sets mirrored from file.go for oracle comparison.
var (
	imageExts = []string{".jpg", ".jpeg", ".png", ".webp", ".gif"}
	videoExts = []string{".mp4", ".mov", ".webm"}
	otherExts = []string{".txt", ".pdf", ".bin", ".exe", ".mp3", ".svg", ".tiff"}
)

const (
	imgLimit = 20 * 1024 * 1024  // 20 MB
	vidLimit = 500 * 1024 * 1024 // 500 MB
)

// writeSparseFile creates a file of the given logical size without allocating
// the full backing storage (sparse via Seek + single-byte write).
func writeSparseFile(t *testing.T, path string, size int64) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("create sparse file: %v", err)
	}
	defer f.Close()
	if size == 0 {
		return
	}
	if _, err := f.Seek(size-1, 0); err != nil {
		t.Fatalf("seek: %v", err)
	}
	if _, err := f.Write([]byte{0}); err != nil {
		t.Fatalf("write: %v", err)
	}
}

// Feature: sandbase-cli, Property 13: 文件校验 — For any file type/extension/byte size, Validate passes iff extension is in the allowed set for its type (image: jpg/jpeg/png/webp/gif; video: mp4/mov/webm) AND size <= limit (image 20MB, video 500MB).
func TestProperty13_FileValidation(t *testing.T) {
	rng := rand.New(rand.NewSource(13))
	dir := t.TempDir()

	for iter := 0; iter < 120; iter++ {
		// Pick an extension from a mixed pool: image, video, or unsupported.
		var ext string
		switch rng.Intn(3) {
		case 0:
			ext = imageExts[rng.Intn(len(imageExts))]
		case 1:
			ext = videoExts[rng.Intn(len(videoExts))]
		default:
			otherPool := otherExts
			// Occasionally vary case to exercise case-insensitive matching.
			ext = otherPool[rng.Intn(len(otherPool))]
		}
		if rng.Intn(4) == 0 {
			ext = strings.ToUpper(ext)
		}

		// Determine the oracle: which type does this extension belong to?
		lower := strings.ToLower(ext)
		var oracleType string
		var limit int64
		if contains(imageExts, lower) {
			oracleType = "image"
			limit = imgLimit
		} else if contains(videoExts, lower) {
			oracleType = "video"
			limit = vidLimit
		}

		// Choose a size: relative to the relevant limit if known, else arbitrary small.
		var size int64
		if oracleType != "" {
			// boundary cases: limit-1, limit, limit+1, plus random within/over.
			switch rng.Intn(5) {
			case 0:
				size = limit - 1
			case 1:
				size = limit
			case 2:
				size = limit + 1
			case 3:
				size = rng.Int63n(limit + 1) // <= limit
			default:
				size = limit + 1 + rng.Int63n(1024) // over limit (capped)
			}
		} else {
			size = rng.Int63n(4096)
		}

		path := filepath.Join(dir, fmt.Sprintf("f%d%s", iter, ext))
		writeSparseFile(t, path, size)

		v, err := (&FileService{}).Validate(path)
		if err != nil {
			t.Fatalf("Property 13 failed: Validate error: %v", err)
		}

		// Oracle: valid iff known type AND size <= limit.
		wantValid := oracleType != "" && size <= limit

		if v.Valid != wantValid {
			t.Fatalf("Property 13 failed: ext=%q size=%d got Valid=%v want %v", ext, size, v.Valid, wantValid)
		}
		if wantValid && v.FileType != oracleType {
			t.Fatalf("Property 13 failed: ext=%q got FileType=%q want %q", ext, v.FileType, oracleType)
		}

		os.Remove(path)
	}
}

func contains(set []string, v string) bool {
	for _, s := range set {
		if s == v {
			return true
		}
	}
	return false
}

// Feature: sandbase-cli, Property 14: 下载文件名生成 — For any slug, output URL, and optional index, BuildFilename matches `<slug-segment>_<timestamp>(_<index>)?.<ext>` with ext from the URL; different indices produce different names.
func TestProperty14_BuildFilename(t *testing.T) {
	rng := rand.New(rand.NewSource(14))
	f := &FileService{}

	slugSegments := []string{"flux", "kling-video", "sd3", "model_x", "claude"}
	urlExts := []string{".png", ".jpg", ".mp4", ".webp", ".gif", ".mov"}

	for iter := 0; iter < 150; iter++ {
		// Build a slug with 1..4 path segments.
		nseg := 1 + rng.Intn(4)
		segs := make([]string, nseg)
		for i := range segs {
			segs[i] = slugSegments[rng.Intn(len(slugSegments))]
		}
		slug := strings.Join(segs, "/")
		lastSeg := segs[len(segs)-1]

		ext := urlExts[rng.Intn(len(urlExts))]
		// Sometimes add a query string to verify ext extraction ignores it.
		url := fmt.Sprintf("https://cdn.example.com/path/output%s", ext)
		if rng.Intn(2) == 0 {
			url += "?token=abc123&v=2"
		}

		index := rng.Intn(5) // 0..4

		name := f.BuildFilename(slug, url, index)

		// Pattern checks: starts with last slug segment + "_", ends with the URL ext.
		if !strings.HasPrefix(name, lastSeg+"_") {
			t.Fatalf("Property 14 failed: name=%q does not start with %q_", name, lastSeg)
		}
		if !strings.HasSuffix(name, ext) {
			t.Fatalf("Property 14 failed: name=%q does not end with ext %q", name, ext)
		}

		// Strip prefix and suffix to inspect the timestamp(_index) middle.
		mid := strings.TrimSuffix(strings.TrimPrefix(name, lastSeg+"_"), ext)
		parts := strings.Split(mid, "_")
		if index > 0 {
			if len(parts) != 2 {
				t.Fatalf("Property 14 failed: index=%d name=%q expected <ts>_<index>, mid=%q", index, name, mid)
			}
			if parts[1] != fmt.Sprintf("%d", index) {
				t.Fatalf("Property 14 failed: index segment got %q want %d", parts[1], index)
			}
		} else {
			if len(parts) != 1 {
				t.Fatalf("Property 14 failed: index=0 name=%q expected no index segment, mid=%q", name, mid)
			}
		}

		// Different indices produce different names (timestamp held constant within call set).
		n1 := f.BuildFilename(slug, url, 1)
		n2 := f.BuildFilename(slug, url, 2)
		if n1 == n2 {
			t.Fatalf("Property 14 failed: indices 1 and 2 produced same name %q", n1)
		}
	}
}
