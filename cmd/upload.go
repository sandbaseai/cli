package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

func newUploadCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "upload <file...>",
		Short: "Upload files to the platform",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			ctx := cmd.Context()

			var results []map[string]any
			for _, filePath := range args {
				sp := app.Output.Spinner(fmt.Sprintf("Uploading %s...", filePath))
				sp.Start()
				uploadResult, err := app.File.UploadWithProgress(ctx, filePath, func(read int64) {
					sp.UpdateText(fmt.Sprintf("Uploading %s (%s)...", filePath, humanizeBytes(read)))
				})
				sp.Stop()
				if err != nil {
					return err
				}
				results = append(results, map[string]any{
					"file": filePath,
					"url":  uploadResult.URL,
				})
				app.Output.Info(fmt.Sprintf("Uploaded: %s → %s", filePath, uploadResult.URL))
			}

			app.Output.Data(
				map[string]any{"uploads": results},
				func(payload any) string {
					var out string
					for _, r := range results {
						out += fmt.Sprintf("%s → %s\n", r["file"], r["url"])
					}
					return out
				},
			)
			return nil
		},
	}
}
