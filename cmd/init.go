package cmd

import (
	"fmt"
	"os"

	clierrors "github.com/sandbaseai/cli/internal/errors"
	"github.com/spf13/cobra"
)

const sandbaseJSONTemplate = `{
  "$schema": "",
  "defaultChatModel": "",
  "aliases": {},
  "defaults": {}
}
`

func newInitCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "init",
		Short: "Create a sandbase.json project configuration template",
		RunE: func(cmd *cobra.Command, args []string) error {
			const filename = "sandbase.json"

			// Check if file already exists
			if _, err := os.Stat(filename); err == nil {
				return &clierrors.CliError{
					Code:     "FILE_EXISTS",
					Message:  fmt.Sprintf("%s already exists in the current directory", filename),
					ExitCode: 1,
				}
			}

			if err := os.WriteFile(filename, []byte(sandbaseJSONTemplate), 0644); err != nil {
				return &clierrors.CliError{
					Code:     "WRITE_ERROR",
					Message:  fmt.Sprintf("failed to write %s: %v", filename, err),
					ExitCode: 1,
				}
			}

			app.Output.Data(
				map[string]any{"file": filename, "created": true},
				func(payload any) string {
					return fmt.Sprintf("Created %s", filename)
				},
			)
			return nil
		},
	}
}
