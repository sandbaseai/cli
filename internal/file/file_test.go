package file

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/sandbaseai/cli/internal/client"
)

func newTestService(server *httptest.Server) *FileService {
	c := client.New(server.URL, "test-key", 30, false)
	return New(c)
}

// --- TestIsLocalPath ---

func TestIsLocalPath_RelativeDotSlash(t *testing.T) {
	svc := New(nil)
	if !svc.IsLocalPath("./image.png") {
		t.Error("expected ./image.png to be a local path")
	}
}

func TestIsLocalPath_RelativeParent(t *testing.T) {
	svc := New(nil)
	if !svc.IsLocalPath("../image.png") {
		t.Error("expected ../image.png to be a local path")
	}
}

func TestIsLocalPath_AbsolutePath(t *testing.T) {
	svc := New(nil)
	if !svc.IsLocalPath("/tmp/image.png") {
		t.Error("expected /tmp/image.png to be a local path")
	}
}

func TestIsLocalPath_TildePath(t *testing.T) {
	svc := New(nil)
	if !svc.IsLocalPath("~/photos/cat.jpg") {
		t.Error("expected ~/photos/cat.jpg to be a local path")
	}
}

func TestIsLocalPath_URL(t *testing.T) {
	svc := New(nil)
	if svc.IsLocalPath("https://example.com/image.png") {
		t.Error("expected URL to not be a local path")
	}
	if svc.IsLocalPath("http://example.com/image.png") {
		t.Error("expected http URL to not be a local path")
	}
}

func TestIsLocalPath_ExistingFile(t *testing.T) {
	// Create a temp file to test path detection via os.Stat
	tmp := t.TempDir()
	tmpFile := filepath.Join(tmp, "test.txt")
	if err := os.WriteFile(tmpFile, []byte("hi"), 0644); err != nil {
		t.Fatal(err)
	}

	svc := New(nil)
	if !svc.IsLocalPath(tmpFile) {
		t.Error("expected existing file to be detected as local path")
	}
}

func TestIsLocalPath_NonExistingFile(t *testing.T) {
	svc := New(nil)
	if svc.IsLocalPath("nonexistent_random_file_xyz123.txt") {
		t.Error("expected non-existing file to not be a local path")
	}
}

// --- TestValidate ---

func TestValidate_ValidImage(t *testing.T) {
	tmp := t.TempDir()
	tmpFile := filepath.Join(tmp, "photo.png")
	// Create a small file (100 bytes)
	if err := os.WriteFile(tmpFile, make([]byte, 100), 0644); err != nil {
		t.Fatal(err)
	}

	svc := New(nil)
	result, err := svc.Validate(tmpFile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Valid {
		t.Fatalf("expected valid, got error: %s", result.Error)
	}
	if result.FileType != "image" {
		t.Errorf("expected file type 'image', got %q", result.FileType)
	}
	if result.Size != 100 {
		t.Errorf("expected size 100, got %d", result.Size)
	}
}

func TestValidate_ValidVideo(t *testing.T) {
	tmp := t.TempDir()
	tmpFile := filepath.Join(tmp, "clip.mp4")
	if err := os.WriteFile(tmpFile, make([]byte, 1024), 0644); err != nil {
		t.Fatal(err)
	}

	svc := New(nil)
	result, err := svc.Validate(tmpFile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Valid {
		t.Fatalf("expected valid, got error: %s", result.Error)
	}
	if result.FileType != "video" {
		t.Errorf("expected file type 'video', got %q", result.FileType)
	}
}

func TestValidate_InvalidExtension(t *testing.T) {
	tmp := t.TempDir()
	tmpFile := filepath.Join(tmp, "readme.txt")
	if err := os.WriteFile(tmpFile, []byte("hello"), 0644); err != nil {
		t.Fatal(err)
	}

	svc := New(nil)
	result, err := svc.Validate(tmpFile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Valid {
		t.Error("expected invalid for .txt file")
	}
	if !strings.Contains(result.Error, "unsupported file extension") {
		t.Errorf("expected unsupported extension error, got: %s", result.Error)
	}
}

func TestValidate_TooLargeImage(t *testing.T) {
	tmp := t.TempDir()
	tmpFile := filepath.Join(tmp, "big.jpg")
	// Create a file that reports > 20MB by writing a sparse file
	f, err := os.Create(tmpFile)
	if err != nil {
		t.Fatal(err)
	}
	// Seek to just past 20MB and write a byte to create a sparse file
	if _, err := f.Seek(maxImageSize+1, 0); err != nil {
		f.Close()
		t.Fatal(err)
	}
	if _, err := f.Write([]byte{0}); err != nil {
		f.Close()
		t.Fatal(err)
	}
	f.Close()

	svc := New(nil)
	result, err := svc.Validate(tmpFile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Valid {
		t.Error("expected invalid for oversized image")
	}
	if result.FileType != "image" {
		t.Errorf("expected file type 'image', got %q", result.FileType)
	}
	if !strings.Contains(result.Error, "file too large") {
		t.Errorf("expected 'file too large' error, got: %s", result.Error)
	}
}

func TestValidate_NonExistentFile(t *testing.T) {
	svc := New(nil)
	_, err := svc.Validate("/nonexistent/path/file.png")
	if err == nil {
		t.Error("expected error for non-existent file")
	}
}

// --- TestBuildFilename ---

func TestBuildFilename_NoIndex(t *testing.T) {
	svc := New(nil)
	name := svc.BuildFilename("vendor/model-name", "https://cdn.example.com/output/result.png?token=abc", 0)

	// Should match pattern: <last-segment>_<timestamp>.<ext>
	pattern := `^model-name_\d+\.png$`
	matched, err := regexp.MatchString(pattern, name)
	if err != nil {
		t.Fatal(err)
	}
	if !matched {
		t.Errorf("filename %q does not match pattern %s", name, pattern)
	}
}

func TestBuildFilename_WithIndex(t *testing.T) {
	svc := New(nil)
	name := svc.BuildFilename("vendor/model-name", "https://cdn.example.com/output/video.mp4", 3)

	// Should match pattern: <last-segment>_<timestamp>_<index>.<ext>
	pattern := `^model-name_\d+_3\.mp4$`
	matched, err := regexp.MatchString(pattern, name)
	if err != nil {
		t.Fatal(err)
	}
	if !matched {
		t.Errorf("filename %q does not match pattern %s", name, pattern)
	}
}

func TestBuildFilename_ExtractExt(t *testing.T) {
	svc := New(nil)

	tests := []struct {
		url     string
		wantExt string
	}{
		{"https://cdn.example.com/file.webm?v=1", ".webm"},
		{"https://cdn.example.com/file.jpg", ".jpg"},
		{"https://cdn.example.com/file", ".bin"},
	}

	for _, tt := range tests {
		name := svc.BuildFilename("test/slug", tt.url, 0)
		if !strings.HasSuffix(name, tt.wantExt) {
			t.Errorf("BuildFilename with URL %q: got %q, want suffix %q", tt.url, name, tt.wantExt)
		}
	}
}

func TestBuildFilename_DifferentIndicesProduceDifferentNames(t *testing.T) {
	svc := New(nil)
	name1 := svc.BuildFilename("test/model", "https://cdn.example.com/out.png", 1)
	name2 := svc.BuildFilename("test/model", "https://cdn.example.com/out.png", 2)
	if name1 == name2 {
		t.Errorf("expected different names for different indices, got both %q", name1)
	}
}

// --- TestUpload (with mock server) ---

func TestUpload_Success(t *testing.T) {
	tmp := t.TempDir()
	tmpFile := filepath.Join(tmp, "upload.png")
	if err := os.WriteFile(tmpFile, make([]byte, 512), 0644); err != nil {
		t.Fatal(err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/v1/upload" {
			t.Errorf("expected /v1/upload, got %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(client.UploadResult{URL: "https://cdn.example.com/uploaded.png"})
	}))
	defer server.Close()

	svc := newTestService(server)
	result, err := svc.Upload(context.Background(), tmpFile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.URL != "https://cdn.example.com/uploaded.png" {
		t.Errorf("expected URL https://cdn.example.com/uploaded.png, got %s", result.URL)
	}
}

func TestUpload_InvalidFile(t *testing.T) {
	tmp := t.TempDir()
	tmpFile := filepath.Join(tmp, "doc.pdf")
	if err := os.WriteFile(tmpFile, []byte("pdf content"), 0644); err != nil {
		t.Fatal(err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("server should not be called for invalid file")
	}))
	defer server.Close()

	svc := newTestService(server)
	_, err := svc.Upload(context.Background(), tmpFile)
	if err == nil {
		t.Fatal("expected error for invalid file type")
	}
}

// --- TestDownload (with mock server) ---

func TestDownload_Success(t *testing.T) {
	content := "fake image data bytes"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, content)
	}))
	defer server.Close()

	tmp := t.TempDir()
	svc := newTestService(server)

	err := svc.Download(context.Background(), server.URL+"/file.png", tmp, "output.png")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify file was written
	data, err := os.ReadFile(filepath.Join(tmp, "output.png"))
	if err != nil {
		t.Fatalf("failed to read downloaded file: %v", err)
	}
	if string(data) != content {
		t.Errorf("expected content %q, got %q", content, string(data))
	}
}
