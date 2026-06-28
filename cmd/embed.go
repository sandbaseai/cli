package cmd

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/spf13/cobra"
)

func newEmbedCmd(app *App) *cobra.Command {
	embedCmd := &cobra.Command{
		Use:   "embed",
		Short: "Manage embeddable chat configs",
	}

	embedCmd.AddCommand(
		newEmbedCreateCmd(app),
		newEmbedListCmd(app),
		newEmbedGetCmd(app),
		newEmbedUpdateCmd(app),
		newEmbedDeleteCmd(app),
		newEmbedUsageCmd(app),
	)

	return embedCmd
}

func newEmbedCreateCmd(app *App) *cobra.Command {
	var name string
	var agentID string
	var environmentID string
	var origins []string
	var title string
	var welcome string
	var themeColor string
	var avatarURL string
	var placeholder string

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create an embed config",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			body := map[string]any{
				"name":           name,
				"agent_id":       agentID,
				"environment_id": environmentID,
			}
			if len(origins) > 0 {
				body["allowed_origins"] = origins
			}
			addString(body, "title", title)
			addString(body, "welcome_message", welcome)
			addString(body, "theme_color", themeColor)
			addString(body, "avatar_url", avatarURL)
			addString(body, "placeholder_text", placeholder)

			result, err := app.Resource.Create(cmd.Context(), "embeds", body)
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatEmbedKeyValue(result)
			})
			return nil
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "Embed config name (required)")
	cmd.Flags().StringVar(&agentID, "agent", "", "Agent ID (required)")
	cmd.Flags().StringVar(&environmentID, "environment", "", "Environment ID (required)")
	cmd.Flags().StringArrayVar(&origins, "origin", nil, "Allowed origin, e.g. https://sandbase.ai (repeatable)")
	cmd.Flags().StringVar(&title, "title", "", "Widget title")
	cmd.Flags().StringVar(&welcome, "welcome", "", "Welcome message")
	cmd.Flags().StringVar(&themeColor, "theme-color", "", "Widget theme color, e.g. #10b981")
	cmd.Flags().StringVar(&avatarURL, "avatar-url", "", "Assistant avatar URL")
	cmd.Flags().StringVar(&placeholder, "placeholder", "", "Input placeholder text")
	cmd.MarkFlagRequired("name")
	cmd.MarkFlagRequired("agent")
	cmd.MarkFlagRequired("environment")
	return cmd
}

func newEmbedListCmd(app *App) *cobra.Command {
	var agentID string

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List embed configs",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			query := url.Values{}
			if agentID != "" {
				query.Set("agent_id", agentID)
			}
			result, err := app.Resource.List(cmd.Context(), "embeds", query)
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatGenericList(result, "data")
			})
			return nil
		},
	}
	cmd.Flags().StringVar(&agentID, "agent", "", "Filter by agent ID")
	return cmd
}

func newEmbedGetCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "get <id>",
		Short: "Get embed config details",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			result, err := app.Resource.Get(cmd.Context(), "embeds", args[0])
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatEmbedKeyValue(result)
			})
			return nil
		},
	}
}

func newEmbedUpdateCmd(app *App) *cobra.Command {
	var name string
	var origins []string
	var title string
	var welcome string
	var themeColor string
	var avatarURL string
	var placeholder string
	var enabled bool

	cmd := &cobra.Command{
		Use:   "update <id>",
		Short: "Update an embed config",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			body := map[string]any{}
			addString(body, "name", name)
			addString(body, "title", title)
			addString(body, "welcome_message", welcome)
			addString(body, "theme_color", themeColor)
			addString(body, "avatar_url", avatarURL)
			addString(body, "placeholder_text", placeholder)
			if cmd.Flags().Changed("origin") {
				body["allowed_origins"] = origins
			}
			if cmd.Flags().Changed("enabled") {
				body["enabled"] = enabled
			}
			result, err := app.Resource.Update(cmd.Context(), "embeds", args[0], body)
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatEmbedKeyValue(result)
			})
			return nil
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "New embed config name")
	cmd.Flags().StringArrayVar(&origins, "origin", nil, "Allowed origin list replacement (repeatable)")
	cmd.Flags().StringVar(&title, "title", "", "Widget title")
	cmd.Flags().StringVar(&welcome, "welcome", "", "Welcome message")
	cmd.Flags().StringVar(&themeColor, "theme-color", "", "Widget theme color")
	cmd.Flags().StringVar(&avatarURL, "avatar-url", "", "Assistant avatar URL")
	cmd.Flags().StringVar(&placeholder, "placeholder", "", "Input placeholder text")
	cmd.Flags().BoolVar(&enabled, "enabled", true, "Enable or disable the embed config")
	return cmd
}

func newEmbedDeleteCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "delete <id>",
		Short: "Delete an embed config",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			if err := app.Resource.Delete(cmd.Context(), "embeds", args[0]); err != nil {
				return err
			}
			app.Output.Data(
				map[string]any{"id": args[0], "deleted": true},
				func(payload any) string {
					return fmt.Sprintf("Embed config %s deleted.", args[0])
				},
			)
			return nil
		},
	}
}

func newEmbedUsageCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "usage <id>",
		Short: "Show embed usage stats",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			result, err := app.Resource.SubList(cmd.Context(), "embeds", args[0], "usage")
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

func addString(body map[string]any, key, value string) {
	if strings.TrimSpace(value) != "" {
		body[key] = value
	}
}

func formatEmbedKeyValue(m map[string]any) string {
	keys := []string{
		"id", "name", "agent_id", "environment_id", "publishable_key", "key_prefix",
		"enabled", "allowed_origins", "title", "welcome_message", "theme_color",
		"placeholder_text", "embed_code", "created_at", "updated_at",
	}
	seen := map[string]bool{}
	var sb strings.Builder
	for _, key := range keys {
		if value, ok := m[key]; ok && value != nil && value != "" {
			sb.WriteString(fmt.Sprintf("%-18s %v\n", key+":", value))
			seen[key] = true
		}
	}
	for key, value := range m {
		if seen[key] {
			continue
		}
		sb.WriteString(fmt.Sprintf("%-18s %v\n", key+":", value))
	}
	return strings.TrimSpace(sb.String())
}
