package file

import (
	"context"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/sandbaseai/cli/internal/client"
	clierrors "github.com/sandbaseai/cli/internal/errors"
)

const (
	maxImageSize = 20 * 1024 * 1024  // 20 MB
	maxVideoSize = 500 * 1024 * 1024 // 500 MB
)

var allowedImageExts = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true,
}

var allowedVideoExts = map[string]bool{
	".mp4": true, ".mov": true, ".webm": true,
}

// FileValidation holds the result of file validation.
type FileValidation struct {
	Valid    bool
	FileType string // "image" or "video"
	Size     int64
	Error    string
}

// FileService owns all file business logic: validation, naming, read/write to filesystem.
// Actual HTTP transport is delegated to ApiClient's PostMultipart/GetStream.
type FileService struct {
	Client *client.ApiClient
}

// New creates a new FileService with the given API client.
func New(c *client.ApiClient) *FileService {
	return &FileService{Client: c}
}

// IsLocalPath determines if a value appears to be a local file path (not a URL).
// Returns true if value starts with `.`, `/`, `~`, or contains a path separator and the file exists.
func (f *FileService) IsLocalPath(value string) bool {
	if strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") {
		return false
	}
	if strings.HasPrefix(value, "./") || strings.HasPrefix(value, "/") || strings.HasPrefix(value, "../") || strings.HasPrefix(value, "~") {
		return true
	}
	// Contains path separator — check if file exists
	if strings.Contains(value, string(filepath.Separator)) {
		_, err := os.Stat(value)
		return err == nil
	}
	// Plain filename — check if file exists
	_, err := os.Stat(value)
	return err == nil
}

// Validate checks file extension and size against allowed types and limits.
func (f *FileService) Validate(filePath string) (*FileValidation, error) {
	ext := strings.ToLower(filepath.Ext(filePath))

	info, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("cannot access file: %w", err)
	}

	var fileType string
	var maxSize int64

	if allowedImageExts[ext] {
		fileType = "image"
		maxSize = maxImageSize
	} else if allowedVideoExts[ext] {
		fileType = "video"
		maxSize = maxVideoSize
	} else {
		return &FileValidation{
			Valid: false,
			Error: fmt.Sprintf("unsupported file extension: %s (allowed: jpg, jpeg, png, webp, gif, mp4, mov, webm)", ext),
		}, nil
	}

	if info.Size() > maxSize {
		return &FileValidation{
			Valid:    false,
			FileType: fileType,
			Size:     info.Size(),
			Error:    fmt.Sprintf("file too large: %d bytes (max for %s: %d bytes)", info.Size(), fileType, maxSize),
		}, nil
	}

	return &FileValidation{
		Valid:    true,
		FileType: fileType,
		Size:     info.Size(),
	}, nil
}

// progressReader wraps an io.Reader and invokes onProgress with the cumulative
// number of bytes read so callers can render a progress indicator.
type progressReader struct {
	r          io.Reader
	total      int64
	onProgress func(read int64)
}

func (pr *progressReader) Read(p []byte) (int, error) {
	n, err := pr.r.Read(p)
	if n > 0 {
		pr.total += int64(n)
		if pr.onProgress != nil {
			pr.onProgress(pr.total)
		}
	}
	return n, err
}

// Upload validates then uploads a file via PostMultipart.
func (f *FileService) Upload(ctx context.Context, filePath string) (*client.UploadResult, error) {
	return f.UploadWithProgress(ctx, filePath, nil)
}

// UploadWithProgress is Upload with an optional byte-progress callback.
func (f *FileService) UploadWithProgress(ctx context.Context, filePath string, onProgress func(read int64)) (*client.UploadResult, error) {
	validation, err := f.Validate(filePath)
	if err != nil {
		return nil, err
	}
	if !validation.Valid {
		return nil, &clierrors.CliError{
			Code:     "INVALID_FILE",
			Message:  validation.Error,
			ExitCode: 1,
		}
	}

	fh, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("open file: %w", err)
	}
	defer fh.Close()

	var reader io.Reader = fh
	if onProgress != nil {
		reader = &progressReader{r: fh, onProgress: onProgress}
	}

	var result client.UploadResult
	filename := filepath.Base(filePath)
	if err := f.Client.PostMultipart(ctx, "/v1/upload", "file", filename, reader, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// BuildFilename generates a download filename: <slug-last-segment>_<unix-timestamp>(_<index>)?.<ext>
// The extension is extracted from the URL path (before any query string).
func (f *FileService) BuildFilename(slug, url string, index int) string {
	// Use last segment of slug for readability
	parts := strings.Split(slug, "/")
	name := parts[len(parts)-1]

	// Extract extension from URL (strip query params first)
	urlPath := strings.Split(url, "?")[0]
	ext := path.Ext(path.Base(urlPath))
	if ext == "" {
		ext = ".bin"
	}

	ts := time.Now().Unix()
	if index > 0 {
		return fmt.Sprintf("%s_%d_%d%s", name, ts, index, ext)
	}
	return fmt.Sprintf("%s_%d%s", name, ts, ext)
}

// Download fetches a URL and writes it to destDir/filename. The filename is
// reduced to its base component to guard against path traversal even if the
// caller passes something containing separators.
func (f *FileService) Download(ctx context.Context, url, destDir, filename string) error {
	return f.DownloadWithProgress(ctx, url, destDir, filename, nil)
}

// DownloadWithProgress is Download with an optional byte-progress callback.
func (f *FileService) DownloadWithProgress(ctx context.Context, url, destDir, filename string, onProgress func(written int64)) error {
	body, err := f.Client.GetStream(ctx, url)
	if err != nil {
		return err
	}
	defer body.Close()

	safeName := filepath.Base(filepath.Clean("/" + filename))
	if safeName == "/" || safeName == "." {
		return &clierrors.CliError{
			Code:     "INVALID_FILE",
			Message:  fmt.Sprintf("invalid download filename %q", filename),
			ExitCode: 1,
		}
	}

	destPath := filepath.Join(destDir, safeName)
	out, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}
	defer out.Close()

	var src io.Reader = body
	if onProgress != nil {
		src = &progressReader{r: body, onProgress: onProgress}
	}

	if _, err := io.Copy(out, src); err != nil {
		return fmt.Errorf("write file: %w", err)
	}

	return nil
}
