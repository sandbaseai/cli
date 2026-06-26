package cmd

import (
	"github.com/spf13/cobra"
)

func newMcpCmd(app *App) *cobra.Command {
	mcpCmd := &cobra.Command{
		Use:   "mcp",
		Short: "MCP server discovery",
	}

	mcpCmd.AddCommand(newMcpListCmd(app))

	return mcpCmd
}

func newMcpListCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List available MCP servers",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			result, err := app.Resource.List(cmd.Context(), "mcp/servers", nil)
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatGenericList(result, "servers")
			})
			return nil
		},
	}
}
