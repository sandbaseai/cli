package cmd

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

func newAgentCmd(app *App) *cobra.Command {
	agentCmd := &cobra.Command{
		Use:   "agent",
		Short: "Manage agents",
	}

	agentCmd.AddCommand(
		newAgentCreateCmd(app),
		newAgentListCmd(app),
		newAgentGetCmd(app),
		newAgentUpdateCmd(app),
		newAgentArchiveCmd(app),
		newAgentVersionsCmd(app),
	)

	return agentCmd
}

func newAgentCreateCmd(app *App) *cobra.Command {
	var name string
	var environment string

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new agent",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			body := map[string]any{"name": name}
			if environment != "" {
				body["environment_id"] = environment
			}
			result, err := app.Resource.Create(cmd.Context(), "agents", body)
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatKeyValue(result)
			})
			return nil
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "Agent name (required)")
	cmd.Flags().StringVar(&environment, "environment", "", "Environment ID")
	cmd.MarkFlagRequired("name")
	return cmd
}

func newAgentListCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List agents",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			result, err := app.Resource.List(cmd.Context(), "agents", nil)
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatGenericList(result, "agents")
			})
			return nil
		},
	}
}

func newAgentGetCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "get <id>",
		Short: "Get agent details",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			result, err := app.Resource.Get(cmd.Context(), "agents", args[0])
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatKeyValue(result)
			})
			return nil
		},
	}
}

func newAgentUpdateCmd(app *App) *cobra.Command {
	var name string

	cmd := &cobra.Command{
		Use:   "update <id>",
		Short: "Update an agent",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			body := map[string]any{}
			if name != "" {
				body["name"] = name
			}
			result, err := app.Resource.Update(cmd.Context(), "agents", args[0], body)
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatKeyValue(result)
			})
			return nil
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "New agent name")
	return cmd
}

func newAgentArchiveCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "archive <id>",
		Short: "Archive an agent",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			if _, err := app.Resource.Action(cmd.Context(), "agents", args[0], "archive", nil); err != nil {
				return err
			}
			app.Output.Data(
				map[string]any{"id": args[0], "archived": true},
				func(payload any) string {
					return fmt.Sprintf("Agent %s archived.", args[0])
				},
			)
			return nil
		},
	}
}

func newAgentVersionsCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "versions <id>",
		Short: "List agent versions",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			result, err := app.Resource.SubList(cmd.Context(), "agents", args[0], "versions")
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatGenericList(result, "versions")
			})
			return nil
		},
	}
}

// formatKeyValue formats a map as key-value pairs for TTY output.
func formatKeyValue(m map[string]any) string {
	var sb strings.Builder
	for k, v := range m {
		sb.WriteString(fmt.Sprintf("%-15s %v\n", k+":", v))
	}
	return strings.TrimSpace(sb.String())
}

// formatGenericList formats an array field from a map as a simple table.
func formatGenericList(m map[string]any, field string) string {
	items, ok := m[field].([]any)
	if !ok {
		return fmt.Sprintf("No %s found.", field)
	}
	if len(items) == 0 {
		return fmt.Sprintf("No %s found.", field)
	}
	var sb strings.Builder
	for i, item := range items {
		switch v := item.(type) {
		case map[string]any:
			id, _ := v["id"].(string)
			name, _ := v["name"].(string)
			if id != "" {
				sb.WriteString(fmt.Sprintf("%d. %s", i+1, id))
				if name != "" {
					sb.WriteString(fmt.Sprintf("  (%s)", name))
				}
				sb.WriteString("\n")
			} else {
				sb.WriteString(fmt.Sprintf("%d. %v\n", i+1, v))
			}
		default:
			sb.WriteString(fmt.Sprintf("%d. %v\n", i+1, v))
		}
	}
	return strings.TrimSpace(sb.String())
}
