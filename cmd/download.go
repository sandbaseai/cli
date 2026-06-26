package cmd

import (
	"fmt"
	"path"
	"strings"

	"github.com/spf13/cobra"
)

func newDownloadCmd(app *App) *cobra.Command {
	var outputDir string

	cmd := &cobra.Command{
		Use:   "download <url...>",
		Short: "Download files to local directory",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			ctx := cmd.Context()

			var results []map[string]any
			for i, url := range args {
				filename := filenameFromURL(url, i)
				sp := app.Output.Spinner(fmt.Sprintf("Downloading %s...", filename))
				sp.Start()
				err := app.File.DownloadWithProgress(ctx, url, outputDir, filename, func(written int64) {
					sp.UpdateText(fmt.Sprintf("Downloading %s (%s)...", filename, humanizeBytes(written)))
				})
				sp.Stop()
				if err != nil {
					return err
				}
				results = append(results, map[string]any{
					"url":  url,
					"file": fmt.Sprintf("%s/%s", outputDir, filename),
				})
				app.Output.Info(fmt.Sprintf("Saved: %s/%s", outputDir, filename))
			}

			app.Output.Data(
				map[string]any{"downloads": results},
				func(payload any) string {
					var out string
					for _, r := range results {
						out += fmt.Sprintf("%s → %s\n", r["url"], r["file"])
					}
					return out
				},
			)
			return nil
		},
	}

	cmd.Flags().StringVar(&outputDir, "output", ".", "Output directory")
	return cmd
}

// humanizeBytes formats a byte count as a human-readable string (e.g. 1.5 MB).
func humanizeBytes(n int64) string {
	const unit = 1024
	if n < unit {
		return fmt.Sprintf("%d B", n)
	}
	div, exp := int64(unit), 0
	for x := n / unit; x >= unit; x /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(n)/float64(div), "KMGTPE"[exp])
}

// filenameFromURL extracts a safe filename from a URL, falling back to a
// numbered default. The result is always a bare filename (no directory
// components) to prevent path traversal when joined with the output dir.
func filenameFromURL(url string, index int) string {
	// Strip query params and fragments.
	clean := strings.SplitN(url, "?", 2)[0]
	clean = strings.SplitN(clean, "#", 2)[0]
	base := path.Base(clean)

	// path.Base never returns a path with separators, but reject any residual
	// traversal tokens and empty results defensively.
	if base == "" || base == "." || base == "/" || base == ".." || strings.ContainsAny(base, `/\`) {
		return fmt.Sprintf("download_%d.bin", index)
	}
	return base
}
