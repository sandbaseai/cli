package mcp

import (
	"context"
	"fmt"
)

// UploadHandler uploads a local file to SandBase CDN.
func UploadHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		filePath, errResult := RequireString(params, "file_path")
		if errResult != nil {
			return errResult, nil
		}
		result, err := svc.File.Upload(ctx, filePath)
		if err != nil {
			return ErrorResultf("upload failed: %v", err), nil
		}
		return TextResult(fmt.Sprintf("Uploaded: %s", result.URL)), nil
	}
}
