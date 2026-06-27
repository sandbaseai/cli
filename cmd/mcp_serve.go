package cmd

import (
	"os"
	"strings"

	"github.com/sandbaseai/cli/internal/mcp"
	"github.com/spf13/cobra"
)

func newMcpServeCmd(app *App) *cobra.Command {
	var (
		transport string
		toolsets  []string
		readOnly  bool
	)

	cmd := &cobra.Command{
		Use:   "serve",
		Short: "Start MCP server (stdio)",
		Long: `Start an MCP server that exposes SandBase platform capabilities as MCP tools.
IDE/Agent clients spawn this as a subprocess and communicate via JSON-RPC over stdio.

Examples:
  sandbase mcp serve                         # All tools, stdio transport
  sandbase mcp serve --toolsets models,run   # Only model and run tools
  sandbase mcp serve --read-only             # Only read-only tools`,
		SilenceUsage: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}

			resolvedToolsets := resolveToolsets(toolsets)
			resolvedReadOnly := readOnly
			if !readOnly && os.Getenv("SANDBASE_MCP_READ_ONLY") == "true" {
				resolvedReadOnly = true
			}

			cfg := mcp.ServerConfig{
				Name:      "sandbase",
				Version:   Version,
				Transport: transport,
				Toolsets:  resolvedToolsets,
				ReadOnly:  resolvedReadOnly,
			}

			services := &mcp.AppServices{
				Client:   app.Client,
				Schema:   app.Schema,
				Poller:   app.Poller,
				File:     app.File,
				Resource: app.Resource,
			}

			server := mcp.NewServer(cfg)
			mcp.RegisterAllTools(server.Registry(), services)
			return server.Run(cmd.Context())
		},
	}

	cmd.Flags().StringVar(&transport, "transport", "stdio", "Transport protocol (stdio, http)")
	cmd.Flags().StringSliceVar(&toolsets, "toolsets", nil, "Enabled toolsets, comma-separated (default: all)")
	cmd.Flags().BoolVar(&readOnly, "read-only", false, "Only expose read-only tools")

	return cmd
}

func resolveToolsets(flagValue []string) []mcp.Toolset {
	if len(flagValue) > 0 {
		return parseToolsets(flagValue)
	}
	if env := os.Getenv("SANDBASE_MCP_TOOLSETS"); env != "" {
		return parseToolsets(strings.Split(env, ","))
	}
	return nil
}

func parseToolsets(input []string) []mcp.Toolset {
	if len(input) == 0 {
		return nil
	}
	result := make([]mcp.Toolset, 0, len(input))
	for _, s := range input {
		s = strings.TrimSpace(s)
		if s != "" {
			result = append(result, mcp.Toolset(s))
		}
	}
	return result
}
