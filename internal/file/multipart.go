package file

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
)

// UploadMultipart performs a multipart POST request with text fields and file fields.
func (f *FileService) UploadMultipart(ctx context.Context, path string, fields map[string]string, files map[string]string) (map[string]any, error) {
	return f.doMultipart(ctx, http.MethodPost, path, fields, files)
}

// UploadMultipartPut performs a multipart PUT request with text fields and file fields.
func (f *FileService) UploadMultipartPut(ctx context.Context, path string, fields map[string]string, files map[string]string) (map[string]any, error) {
	return f.doMultipart(ctx, http.MethodPut, path, fields, files)
}

// doMultipart builds and sends a multipart/form-data request.
func (f *FileService) doMultipart(ctx context.Context, method, path string, fields map[string]string, files map[string]string) (map[string]any, error) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	// Write text fields
	for key, val := range fields {
		if err := writer.WriteField(key, val); err != nil {
			return nil, fmt.Errorf("write field %s: %w", key, err)
		}
	}

	// Write file fields
	for fieldName, filePath := range files {
		file, err := os.Open(filePath)
		if err != nil {
			return nil, fmt.Errorf("open %s: %w", filePath, err)
		}
		part, err := writer.CreateFormFile(fieldName, filepath.Base(filePath))
		if err != nil {
			file.Close()
			return nil, fmt.Errorf("create form file %s: %w", fieldName, err)
		}
		if _, err := io.Copy(part, file); err != nil {
			file.Close()
			return nil, fmt.Errorf("copy %s: %w", filePath, err)
		}
		file.Close()
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("close multipart writer: %w", err)
	}

	// Build and send request
	url := f.Client.BaseURL + path
	req, err := http.NewRequestWithContext(ctx, method, url, &buf)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+f.Client.APIKey)
	req.Header.Set("User-Agent", "sandbase-cli")

	resp, err := f.Client.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	var result map[string]any
	if len(respBody) > 0 {
		if err := json.Unmarshal(respBody, &result); err != nil {
			return nil, fmt.Errorf("decode response: %w", err)
		}
	}
	return result, nil
}
