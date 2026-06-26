package cmd

import (
	"fmt"
	"net/http"
	"os"

	"github.com/spf13/cobra"
)

func newSessionCmd(app *App) *cobra.Command {
	sessionCmd := &cobra.Command{
		Use:   "session",
		Short: "Manage sessions",
	}

	sessionCmd.AddCommand(
		newSessionCreateCmd(app),
		newSessionListCmd(app),
		newSessionGetCmd(app),
		newSessionUpdateCmd(app),
		newSessionStopCmd(app),
		newSessionArchiveCmd(app),
		newSessionDeleteCmd(app),
		newSessionSendCmd(app),
		newSessionEventsCmd(app),
		newSessionStreamCmd(app),
	)

	return sessionCmd
}

func newSessionCreateCmd(app *App) *cobra.Command {
	var agentID string

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new session",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			body := map[string]any{}
			if agentID != "" {
				body["agent_id"] = agentID
			}
			result, err := app.Resource.Create(cmd.Context(), "sessions", body)
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatKeyValue(result)
			})
			return nil
		},
	}
	cmd.Flags().StringVar(&agentID, "agent", "", "Agent ID")
	return cmd
}

func newSessionListCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List sessions",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			result, err := app.Resource.List(cmd.Context(), "sessions", nil)
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatGenericList(result, "sessions")
			})
			return nil
		},
	}
}

func newSessionGetCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "get <id>",
		Short: "Get session details",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			result, err := app.Resource.Get(cmd.Context(), "sessions", args[0])
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

func newSessionUpdateCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "update <id>",
		Short: "Update a session",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			result, err := app.Resource.Update(cmd.Context(), "sessions", args[0], map[string]any{})
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

func newSessionStopCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "stop <id>",
		Short: "Stop a session",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			if _, err := app.Resource.Action(cmd.Context(), "sessions", args[0], "stop", nil); err != nil {
				return err
			}
			app.Output.Data(
				map[string]any{"id": args[0], "stopped": true},
				func(payload any) string {
					return fmt.Sprintf("Session %s stopped.", args[0])
				},
			)
			return nil
		},
	}
}

func newSessionArchiveCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "archive <id>",
		Short: "Archive a session",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			if _, err := app.Resource.Action(cmd.Context(), "sessions", args[0], "archive", nil); err != nil {
				return err
			}
			app.Output.Data(
				map[string]any{"id": args[0], "archived": true},
				func(payload any) string {
					return fmt.Sprintf("Session %s archived.", args[0])
				},
			)
			return nil
		},
	}
}

func newSessionDeleteCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "delete <id>",
		Short: "Delete a session",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			if err := app.Resource.Delete(cmd.Context(), "sessions", args[0]); err != nil {
				return err
			}
			app.Output.Data(
				map[string]any{"id": args[0], "deleted": true},
				func(payload any) string {
					return fmt.Sprintf("Session %s deleted.", args[0])
				},
			)
			return nil
		},
	}
}

func newSessionSendCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "send <id> <text>",
		Short: "Send a message event to a session",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			body := map[string]any{
				"type":    "message",
				"content": args[1],
			}
			result, err := app.Resource.Action(cmd.Context(), "sessions", args[0], "events", body)
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return fmt.Sprintf("Message sent to session %s.", args[0])
			})
			return nil
		},
	}
}

func newSessionEventsCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "events <id>",
		Short: "List session events",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			result, err := app.Resource.SubList(cmd.Context(), "sessions", args[0], "events")
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatGenericList(result, "events")
			})
			return nil
		},
	}
}

func newSessionStreamCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "stream <id>",
		Short: "Stream session events in real-time (SSE)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			// Streaming uses the client's long-lived Stream method directly,
			// then the StreamService renders per output mode.
			path := fmt.Sprintf("/v1/sessions/%s/events/stream", args[0])
			events, err := app.Client.Stream(cmd.Context(), http.MethodGet, path, nil)
			if err != nil {
				return err
			}
			if _, err := app.Stream.Consume(events, app.Output.Mode, os.Stdout); err != nil {
				return err
			}
			return nil
		},
	}
}
