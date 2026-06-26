package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

func newSkillCmd(app *App) *cobra.Command {
	skillCmd := &cobra.Command{
		Use:   "skill",
		Short: "Manage skills",
	}

	skillCmd.AddCommand(
		newSkillCreateCmd(app),
		newSkillListCmd(app),
		newSkillUpdateCmd(app),
		newSkillDeleteCmd(app),
	)

	return skillCmd
}

func newSkillCreateCmd(app *App) *cobra.Command {
	var name string

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new skill",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			body := map[string]any{"name": name}
			result, err := app.Resource.Create(cmd.Context(), "skills", body)
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatKeyValue(result)
			})
			return nil
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "Skill name (required)")
	cmd.MarkFlagRequired("name")
	return cmd
}

func newSkillListCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List skills",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			result, err := app.Resource.List(cmd.Context(), "skills", nil)
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

func newSkillUpdateCmd(app *App) *cobra.Command {
	var name string

	cmd := &cobra.Command{
		Use:   "update <id>",
		Short: "Update a skill",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			body := map[string]any{}
			if name != "" {
				body["name"] = name
			}
			result, err := app.Resource.Update(cmd.Context(), "skills", args[0], body)
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatKeyValue(result)
			})
			return nil
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "New skill name")
	return cmd
}

func newSkillDeleteCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "delete <id>",
		Short: "Delete a skill",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			if err := app.Resource.Delete(cmd.Context(), "skills", args[0]); err != nil {
				return err
			}
			app.Output.Data(
				map[string]any{"id": args[0], "deleted": true},
				func(payload any) string {
					return fmt.Sprintf("Skill %s deleted.", args[0])
				},
			)
			return nil
		},
	}
}
