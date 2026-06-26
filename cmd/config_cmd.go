package cmd

import (
	"fmt"

	clierrors "github.com/sandbaseai/cli/internal/errors"
	"github.com/spf13/cobra"
)

func newConfigCmd(app *App) *cobra.Command {
	configCmd := &cobra.Command{
		Use:   "config",
		Short: "Manage global configuration",
	}

	configCmd.AddCommand(
		newConfigSetCmd(app),
		newConfigGetCmd(app),
	)

	return configCmd
}

func newConfigSetCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "set <key> <value>",
		Short: "Set a global configuration value",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			key := args[0]
			value := args[1]
			if err := app.Config.SetGlobal(key, value); err != nil {
				return &clierrors.CliError{
					Code:     "CONFIG_ERROR",
					Message:  fmt.Sprintf("failed to set config: %v", err),
					ExitCode: 1,
				}
			}
			app.Output.Data(
				map[string]any{"key": key, "value": value},
				func(payload any) string {
					return fmt.Sprintf("Set %s = %s", key, value)
				},
			)
			return nil
		},
	}
}

func newConfigGetCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "get <key>",
		Short: "Get a global configuration value",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			key := args[0]
			value, err := app.Config.GetGlobal(key)
			if err != nil {
				return &clierrors.CliError{
					Code:     "CONFIG_ERROR",
					Message:  fmt.Sprintf("failed to get config: %v", err),
					ExitCode: 1,
				}
			}
			app.Output.Data(
				map[string]any{"key": key, "value": value},
				func(payload any) string {
					return value
				},
			)
			return nil
		},
	}
}
