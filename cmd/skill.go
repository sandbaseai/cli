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
		newSkillManageCmd(app),
		newSkillCreateCmd(app),
		newSkillUpdateCmd(app),
	)

	return skillCmd
}

// --- Read ---

func newSkillListCmd(app *App) *cobra.Command {
	var (
		query    string
		category string
		page     int
		pageSize int
	)

	cmd := &cobra.Command{
		Use:   "list",
		Short: "Browse and search skills marketplace",
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
		Short: "Get skill details (public)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
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

func newSkillManageCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "manage <id>",
		Short: "Get skill editable fields (owner only)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			result, err := app.Resource.SubList(cmd.Context(), "skills", args[0], "manage")
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

// --- Create (multipart upload) ---

func newSkillCreateCmd(app *App) *cobra.Command {
	var (
		name        string
		description string
		categories  string
		skillFile   string
		gitURL      string
		previewImg  string
		createAgent bool
	)

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Upload a new skill (multipart)",
		Long: `Upload a new skill to SandBase. Requires a skill file (local path or git URL)
and at least one preview image.

Examples:
  sandbase skill create --name "My Skill" --skill-file ./skill.zip --preview ./preview.png
  sandbase skill create --name "My Skill" --git-url https://github.com/user/repo/tree/main/skill-dir --preview ./img.png`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			if name == "" {
				return fmt.Errorf("--name is required")
			}
			if skillFile == "" && gitURL == "" {
				return fmt.Errorf("--skill-file or --git-url is required")
			}
			if previewImg == "" {
				return fmt.Errorf("--preview is required")
			}

			// Build multipart form fields
			fields := map[string]string{
				"name": name,
			}
			if description != "" {
				fields["description"] = description
			}
			if categories != "" {
				fields["categories"] = categories
			}
			if gitURL != "" {
				fields["git_url"] = gitURL
			}
			if createAgent {
				fields["create_agent"] = "true"
			}

			// Files to upload
			files := map[string]string{}
			if skillFile != "" {
				files["skill_file"] = skillFile
			}
			if previewImg != "" {
				files["preview_image"] = previewImg
			}

			result, err := app.File.UploadMultipart(cmd.Context(), "/v1/skills", fields, files)
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
	cmd.Flags().StringVar(&description, "description", "", "Skill description")
	cmd.Flags().StringVar(&categories, "categories", "", "Comma-separated categories")
	cmd.Flags().StringVar(&skillFile, "skill-file", "", "Path to skill file (zip/tar)")
	cmd.Flags().StringVar(&gitURL, "git-url", "", "GitHub directory URL (alternative to --skill-file)")
	cmd.Flags().StringVar(&previewImg, "preview", "", "Path to preview image")
	cmd.Flags().BoolVar(&createAgent, "create-agent", false, "Also create an agent for this skill")
	return cmd
}

// --- Update (multipart PUT) ---

func newSkillUpdateCmd(app *App) *cobra.Command {
	var (
		name          string
		description   string
		categories    string
		skillFile     string
		previewImg    string
		environmentID string
		agentModel    string
		agentSystem   string
	)

	cmd := &cobra.Command{
		Use:   "update <id>",
		Short: "Update a skill (owner only, multipart)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			if name == "" {
				return fmt.Errorf("--name is required")
			}

			fields := map[string]string{
				"name": name,
			}
			if description != "" {
				fields["description"] = description
			}
			if categories != "" {
				fields["categories"] = categories
			}
			if environmentID != "" {
				fields["environment_id"] = environmentID
			}
			if agentModel != "" {
				fields["agent_model"] = agentModel
			}
			if agentSystem != "" {
				fields["agent_system"] = agentSystem
			}

			files := map[string]string{}
			if skillFile != "" {
				files["skill_file"] = skillFile
			}
			if previewImg != "" {
				files["preview_image"] = previewImg
			}

			path := fmt.Sprintf("/v1/skills/%s", args[0])
			result, err := app.File.UploadMultipartPut(cmd.Context(), path, fields, files)
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
	cmd.Flags().StringVar(&description, "description", "", "Skill description")
	cmd.Flags().StringVar(&categories, "categories", "", "Comma-separated categories")
	cmd.Flags().StringVar(&skillFile, "skill-file", "", "Path to new skill file (optional)")
	cmd.Flags().StringVar(&previewImg, "preview", "", "Path to new preview image (optional)")
	cmd.Flags().StringVar(&environmentID, "environment-id", "", "Environment ID")
	cmd.Flags().StringVar(&agentModel, "agent-model", "", "Agent LLM model")
	cmd.Flags().StringVar(&agentSystem, "agent-system", "", "Agent system prompt")
	return cmd
}
