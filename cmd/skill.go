package cmd

import (
	"fmt"
	"net/url"

	"github.com/spf13/cobra"
)

func newSkillCmd(app *App) *cobra.Command {
	skillCmd := &cobra.Command{
		Use:   "skill",
		Short: "Manage skills",
	}

	skillCmd.AddCommand(
		newSkillListCmd(app),
		newSkillGetCmd(app),
		newSkillMineCmd(app),
		newSkillRunCmd(app),
		newSkillRunStatusCmd(app),
		newSkillFavoriteCmd(app),
		newSkillUnfavoriteCmd(app),
	)

	return skillCmd
}

func newSkillListCmd(app *App) *cobra.Command {
	var (
		query    string
		category string
		page     int
		pageSize int
	)

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List skills (public marketplace)",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			params := url.Values{}
			if query != "" {
				params.Set("q", query)
			}
			if category != "" {
				params.Set("category", category)
			}
			if page > 0 {
				params.Set("page", fmt.Sprintf("%d", page))
			}
			if pageSize > 0 {
				params.Set("pageSize", fmt.Sprintf("%d", pageSize))
			}
			result, err := app.Resource.List(cmd.Context(), "skills", params)
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatGenericList(result, "skills")
			})
			return nil
		},
	}
	cmd.Flags().StringVarP(&query, "query", "q", "", "Search query")
	cmd.Flags().StringVar(&category, "category", "", "Filter by category")
	cmd.Flags().IntVar(&page, "page", 0, "Page number")
	cmd.Flags().IntVar(&pageSize, "page-size", 0, "Page size")
	return cmd
}

func newSkillGetCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "get <vendor/slug>",
		Short: "Get skill details",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			// The public detail endpoint uses vendor/slug path
			result, err := app.Resource.Get(cmd.Context(), "skills", args[0])
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

func newSkillMineCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "mine",
		Short: "List my uploaded skills",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			result, err := app.Resource.List(cmd.Context(), "skills/mine", nil)
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatGenericList(result, "skills")
			})
			return nil
		},
	}
}

func newSkillRunCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "run <vendor/slug>",
		Short: "Run a skill (submit execution)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			// POST /api/skills/:vendor/:slug/runs
			path := fmt.Sprintf("skills/%s/runs", args[0])
			result, err := app.Resource.Create(cmd.Context(), path, nil)
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

func newSkillRunStatusCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "run-status <run_id>",
		Short: "Get skill run status",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			result, err := app.Resource.Get(cmd.Context(), "skills/runs", args[0])
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

func newSkillFavoriteCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "favorite <id>",
		Short: "Favorite a skill",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			_, err := app.Resource.Action(cmd.Context(), "skills", args[0], "favorite", nil)
			if err != nil {
				return err
			}
			app.Output.Data(
				map[string]any{"id": args[0], "favorited": true},
				func(payload any) string {
					return fmt.Sprintf("Skill %s favorited.", args[0])
				},
			)
			return nil
		},
	}
}

func newSkillUnfavoriteCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "unfavorite <id>",
		Short: "Unfavorite a skill",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			// DELETE /default/v1/skills/:id/favorite — use Delete on subpath
			if err := app.Resource.Delete(cmd.Context(), "skills/"+args[0], "favorite"); err != nil {
				return err
			}
			app.Output.Data(
				map[string]any{"id": args[0], "favorited": false},
				func(payload any) string {
					return fmt.Sprintf("Skill %s unfavorited.", args[0])
				},
			)
			return nil
		},
	}
}
