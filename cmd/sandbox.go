package cmd

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

func newSandboxCmd(app *App) *cobra.Command {
	sandboxCmd := &cobra.Command{
		Use:   "sandbox",
		Short: "Manage cloud sandboxes (E2B compatible)",
	}

	sandboxCmd.AddCommand(
		newSandboxCreateCmd(app),
		newSandboxListCmd(app),
		newSandboxGetCmd(app),
		newSandboxDestroyCmd(app),
		newSandboxPauseCmd(app),
		newSandboxConnectCmd(app),
		newSandboxTimeoutCmd(app),
		newSandboxHealthCmd(app),
		newSandboxMetricsCmd(app),
		newSandboxEnvsCmd(app),
		newSandboxExecCmd(app),
		newSandboxLsCmd(app),
		newSandboxReadCmd(app),
		newSandboxWriteCmd(app),
		newSandboxDeleteFileCmd(app),
		newSandboxUploadCmd(app),
		newSandboxDownloadCmd(app),
		newSandboxStatCmd(app),
		newSandboxMkdirCmd(app),
		newSandboxMoveCmd(app),
	)

	return sandboxCmd
}

// ── Create ──

func newSandboxCreateCmd(app *App) *cobra.Command {
	var templateID string
	var timeoutSec int
	var envVars []string
	var metadata []string

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new sandbox",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			body := map[string]any{}
			if templateID != "" {
				body["templateID"] = templateID
			}
			if timeoutSec > 0 {
				body["timeout"] = timeoutSec
			}
			if len(envVars) > 0 {
				env := map[string]string{}
				for _, e := range envVars {
					parts := strings.SplitN(e, "=", 2)
					if len(parts) == 2 {
						env[parts[0]] = parts[1]
					}
				}
				body["envVars"] = env
			}
			if len(metadata) > 0 {
				meta := map[string]string{}
				for _, m := range metadata {
					parts := strings.SplitN(m, "=", 2)
					if len(parts) == 2 {
						meta[parts[0]] = parts[1]
					}
				}
				body["metadata"] = meta
			}
			var result map[string]any
			if err := app.Client.Request(cmd.Context(), http.MethodPost, "/sandboxes", body, &result); err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatKeyValue(result)
			})
			return nil
		},
	}
	cmd.Flags().StringVar(&templateID, "template", "", "Template ID (required)")
	cmd.Flags().IntVar(&timeoutSec, "timeout", 0, "Sandbox timeout in seconds")
	cmd.Flags().StringSliceVar(&envVars, "env", nil, "Environment variables (KEY=VALUE, repeatable)")
	cmd.Flags().StringSliceVar(&metadata, "metadata", nil, "Metadata (KEY=VALUE, repeatable)")
	return cmd
}

// ── List ──

func newSandboxListCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List sandboxes",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			var result []map[string]any
			if err := app.Client.Request(cmd.Context(), http.MethodGet, "/sandboxes", nil, &result); err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatSandboxList(result)
			})
			return nil
		},
	}
}

// ── Get ──

func newSandboxGetCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "get <id>",
		Short: "Get sandbox details",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			var result map[string]any
			path := fmt.Sprintf("/sandboxes/%s", url.PathEscape(args[0]))
			if err := app.Client.Request(cmd.Context(), http.MethodGet, path, nil, &result); err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatKeyValue(result)
			})
			return nil
		},
	}
}

// ── Destroy ──

func newSandboxDestroyCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "destroy <id>",
		Short: "Destroy a sandbox",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			path := fmt.Sprintf("/sandboxes/%s", url.PathEscape(args[0]))
			if err := app.Client.Request(cmd.Context(), http.MethodDelete, path, nil, nil); err != nil {
				return err
			}
			app.Output.Data(
				map[string]any{"id": args[0], "destroyed": true},
				func(payload any) string {
					return fmt.Sprintf("Sandbox %s destroyed.", args[0])
				},
			)
			return nil
		},
	}
}

// ── Pause ──

func newSandboxPauseCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "pause <id>",
		Short: "Pause a sandbox",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			path := fmt.Sprintf("/sandboxes/%s/pause", url.PathEscape(args[0]))
			var result map[string]any
			if err := app.Client.Request(cmd.Context(), http.MethodPost, path, nil, &result); err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return fmt.Sprintf("Sandbox %s paused.", args[0])
			})
			return nil
		},
	}
}

// ── Connect (Resume) ──

func newSandboxConnectCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "connect <id>",
		Short: "Connect to (resume) a paused sandbox",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			path := fmt.Sprintf("/sandboxes/%s/connect", url.PathEscape(args[0]))
			var result map[string]any
			if err := app.Client.Request(cmd.Context(), http.MethodPost, path, nil, &result); err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatKeyValue(result)
			})
			return nil
		},
	}
}

// ── Set Timeout ──

func newSandboxTimeoutCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "timeout <id> <seconds>",
		Short: "Set sandbox timeout",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			path := fmt.Sprintf("/sandboxes/%s/timeout", url.PathEscape(args[0]))
			body := map[string]any{"timeout": args[1]}
			var result map[string]any
			if err := app.Client.Request(cmd.Context(), http.MethodPost, path, body, &result); err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return fmt.Sprintf("Sandbox %s timeout set to %ss.", args[0], args[1])
			})
			return nil
		},
	}
}

// ── Exec Process ──

func newSandboxExecCmd(app *App) *cobra.Command {
	var workdir string
	var timeoutSec int

	cmd := &cobra.Command{
		Use:   "exec <id> <command...>",
		Short: "Run a command in the sandbox",
		Args:  cobra.MinimumNArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			path := fmt.Sprintf("/sandboxes/%s/processes", url.PathEscape(args[0]))
			body := map[string]any{
				"cmd": args[1],
			}
			if len(args) > 2 {
				body["args"] = args[2:]
			}
			if workdir != "" {
				body["cwd"] = workdir
			}
			if timeoutSec > 0 {
				body["timeout"] = timeoutSec
			}
			var result map[string]any
			if err := app.Client.Request(cmd.Context(), http.MethodPost, path, body, &result); err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatExecResult(result)
			})
			return nil
		},
	}
	cmd.Flags().StringVar(&workdir, "cwd", "", "Working directory (default: /workspace)")
	cmd.Flags().IntVar(&timeoutSec, "timeout", 0, "Command timeout in seconds (default: 60)")
	return cmd
}

// ── Filesystem: List ──

func newSandboxLsCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "ls <id> [path]",
		Short: "List files in sandbox",
		Args:  cobra.RangeArgs(1, 2),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			dirPath := "/"
			if len(args) > 1 {
				dirPath = args[1]
			}
			path := fmt.Sprintf("/sandboxes/%s/filesystem/list?path=%s", url.PathEscape(args[0]), url.QueryEscape(dirPath))
			var result any
			if err := app.Client.Request(cmd.Context(), http.MethodGet, path, nil, &result); err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return fmt.Sprintf("%v", result)
			})
			return nil
		},
	}
}

// ── Filesystem: Read ──

func newSandboxReadCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "read <id> <path>",
		Short: "Read a file from sandbox",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			path := fmt.Sprintf("/sandboxes/%s/filesystem?path=%s", url.PathEscape(args[0]), url.QueryEscape(args[1]))
			var result any
			if err := app.Client.Request(cmd.Context(), http.MethodGet, path, nil, &result); err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				if s, ok := result.(string); ok {
					return s
				}
				return fmt.Sprintf("%v", result)
			})
			return nil
		},
	}
}

// ── Filesystem: Write ──

func newSandboxWriteCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "write <id> <path> <content>",
		Short: "Write content to a file in sandbox (base64 encoded)",
		Args:  cobra.ExactArgs(3),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			reqPath := fmt.Sprintf("/sandboxes/%s/filesystem", url.PathEscape(args[0]))
			// Encode content as base64 (E2B compatible)
			encoded := base64Encode([]byte(args[2]))
			body := map[string]any{
				"path":    args[1],
				"content": encoded,
			}
			if err := app.Client.Request(cmd.Context(), http.MethodPost, reqPath, body, nil); err != nil {
				return err
			}
			app.Output.Data(
				map[string]any{"path": args[1], "written": true},
				func(payload any) string {
					return fmt.Sprintf("Written to %s", args[1])
				},
			)
			return nil
		},
	}
}

// ── Filesystem: Mkdir ──

func newSandboxMkdirCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "mkdir <id> <path>",
		Short: "Create a directory in sandbox",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			reqPath := fmt.Sprintf("/sandboxes/%s/filesystem/mkdir", url.PathEscape(args[0]))
			body := map[string]any{"path": args[1]}
			var result map[string]any
			if err := app.Client.Request(cmd.Context(), http.MethodPost, reqPath, body, &result); err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return fmt.Sprintf("Directory created: %s", args[1])
			})
			return nil
		},
	}
}

// ── Health ──

func newSandboxHealthCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "health <id>",
		Short: "Check sandbox health",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			path := fmt.Sprintf("/sandboxes/%s/health", url.PathEscape(args[0]))
			if err := app.Client.Request(cmd.Context(), http.MethodGet, path, nil, nil); err != nil {
				return err
			}
			app.Output.Data(
				map[string]any{"id": args[0], "healthy": true},
				func(payload any) string {
					return fmt.Sprintf("Sandbox %s is healthy.", args[0])
				},
			)
			return nil
		},
	}
}

// ── Metrics ──

func newSandboxMetricsCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "metrics <id>",
		Short: "Get sandbox resource metrics",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			path := fmt.Sprintf("/sandboxes/%s/metrics", url.PathEscape(args[0]))
			var result map[string]any
			if err := app.Client.Request(cmd.Context(), http.MethodGet, path, nil, &result); err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatKeyValue(result)
			})
			return nil
		},
	}
}

// ── Envs ──

func newSandboxEnvsCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "envs <id>",
		Short: "Get sandbox environment variables",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			path := fmt.Sprintf("/sandboxes/%s/envs", url.PathEscape(args[0]))
			var result map[string]any
			if err := app.Client.Request(cmd.Context(), http.MethodGet, path, nil, &result); err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatKeyValue(result)
			})
			return nil
		},
	}
}

// ── Filesystem: Delete ──

func newSandboxDeleteFileCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "rm <id> <path>",
		Short: "Delete a file in sandbox",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			path := fmt.Sprintf("/sandboxes/%s/filesystem?path=%s", url.PathEscape(args[0]), url.QueryEscape(args[1]))
			if err := app.Client.Request(cmd.Context(), http.MethodDelete, path, nil, nil); err != nil {
				return err
			}
			app.Output.Data(
				map[string]any{"path": args[1], "deleted": true},
				func(payload any) string {
					return fmt.Sprintf("Deleted: %s", args[1])
				},
			)
			return nil
		},
	}
}

// ── Filesystem: Upload ──

func newSandboxUploadCmd(app *App) *cobra.Command {
	var destPath string

	cmd := &cobra.Command{
		Use:   "upload <id> <local-file>",
		Short: "Upload a local file to sandbox",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			if destPath == "" {
				destPath = "/workspace/" + filepath.Base(args[1])
			}
			reqPath := fmt.Sprintf("/sandboxes/%s/filesystem/upload", url.PathEscape(args[0]))
			f, err := os.Open(args[1])
			if err != nil {
				return fmt.Errorf("cannot open file: %w", err)
			}
			defer f.Close()

			// Build multipart body
			var buf bytes.Buffer
			writer := multipart.NewWriter(&buf)
			_ = writer.WriteField("path", destPath)
			part, err := writer.CreateFormFile("file", filepath.Base(args[1]))
			if err != nil {
				return err
			}
			if _, err := io.Copy(part, f); err != nil {
				return err
			}
			writer.Close()

			req, err := http.NewRequestWithContext(cmd.Context(), http.MethodPost, app.Client.BaseURL+reqPath, &buf)
			if err != nil {
				return err
			}
			req.Header.Set("Content-Type", writer.FormDataContentType())
			req.Header.Set("Authorization", "Bearer "+app.Client.APIKey)

			resp, err := app.Client.HTTPClient.Do(req)
			if err != nil {
				return err
			}
			defer resp.Body.Close()
			if resp.StatusCode >= 400 {
				return fmt.Errorf("upload failed: HTTP %d", resp.StatusCode)
			}

			app.Output.Data(
				map[string]any{"path": destPath, "uploaded": true},
				func(payload any) string {
					return fmt.Sprintf("Uploaded to %s", destPath)
				},
			)
			return nil
		},
	}
	cmd.Flags().StringVar(&destPath, "path", "", "Destination path in sandbox (default: /workspace/<filename>)")
	return cmd
}

// ── Filesystem: Download ──

func newSandboxDownloadCmd(app *App) *cobra.Command {
	var output string

	cmd := &cobra.Command{
		Use:   "download <id> <remote-path>",
		Short: "Download a file from sandbox",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			if output == "" {
				output = filepath.Base(args[1])
			}
			reqPath := fmt.Sprintf("/sandboxes/%s/filesystem/download?path=%s", url.PathEscape(args[0]), url.QueryEscape(args[1]))

			req, err := http.NewRequestWithContext(cmd.Context(), http.MethodGet, app.Client.BaseURL+reqPath, nil)
			if err != nil {
				return err
			}
			req.Header.Set("Authorization", "Bearer "+app.Client.APIKey)

			resp, err := app.Client.HTTPClient.Do(req)
			if err != nil {
				return err
			}
			defer resp.Body.Close()
			if resp.StatusCode >= 400 {
				return fmt.Errorf("download failed: HTTP %d", resp.StatusCode)
			}

			outFile, err := os.Create(output)
			if err != nil {
				return fmt.Errorf("cannot create output file: %w", err)
			}
			defer outFile.Close()
			if _, err := io.Copy(outFile, resp.Body); err != nil {
				return err
			}

			app.Output.Data(
				map[string]any{"path": args[1], "saved_to": output},
				func(payload any) string {
					return fmt.Sprintf("Downloaded %s → %s", args[1], output)
				},
			)
			return nil
		},
	}
	cmd.Flags().StringVarP(&output, "output", "o", "", "Local output path (default: filename from remote path)")
	return cmd
}

// ── Filesystem: Stat ──

func newSandboxStatCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "stat <id> <path>",
		Short: "Get file/directory metadata",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			path := fmt.Sprintf("/sandboxes/%s/filesystem/stat?path=%s", url.PathEscape(args[0]), url.QueryEscape(args[1]))
			var result map[string]any
			if err := app.Client.Request(cmd.Context(), http.MethodGet, path, nil, &result); err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatKeyValue(result)
			})
			return nil
		},
	}
}

// ── Filesystem: Move ──

func newSandboxMoveCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "mv <id> <source> <destination>",
		Short: "Move or rename a file/directory in sandbox",
		Args:  cobra.ExactArgs(3),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			reqPath := fmt.Sprintf("/sandboxes/%s/filesystem/move", url.PathEscape(args[0]))
			body := map[string]any{
				"source":      args[1],
				"destination": args[2],
			}
			var result map[string]any
			if err := app.Client.Request(cmd.Context(), http.MethodPost, reqPath, body, &result); err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return fmt.Sprintf("Moved %s → %s", args[1], args[2])
			})
			return nil
		},
	}
}

// ── Helpers ──

func base64Encode(data []byte) string {
	return base64.StdEncoding.EncodeToString(data)
}

// ── Formatters ──

func formatSandboxList(items []map[string]any) string {
	if len(items) == 0 {
		return "No sandboxes found."
	}
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("%-30s %-12s %-20s\n", "ID", "STATUS", "TEMPLATE"))
	sb.WriteString(strings.Repeat("─", 65) + "\n")
	for _, item := range items {
		id, _ := item["sandbox_id"].(string)
		if id == "" {
			id, _ = item["id"].(string)
		}
		status, _ := item["status"].(string)
		tpl, _ := item["template_id"].(string)
		sb.WriteString(fmt.Sprintf("%-30s %-12s %-20s\n", id, status, tpl))
	}
	return strings.TrimSpace(sb.String())
}

func formatExecResult(result map[string]any) string {
	var sb strings.Builder
	if stdout, ok := result["stdout"].(string); ok && stdout != "" {
		sb.WriteString(stdout)
	}
	if stderr, ok := result["stderr"].(string); ok && stderr != "" {
		if sb.Len() > 0 {
			sb.WriteString("\n")
		}
		sb.WriteString("[stderr] " + stderr)
	}
	if exitCode, ok := result["exit_code"].(float64); ok && exitCode != 0 {
		sb.WriteString(fmt.Sprintf("\n[exit code: %d]", int(exitCode)))
	}
	if sb.Len() == 0 {
		return formatKeyValue(result)
	}
	return sb.String()
}
