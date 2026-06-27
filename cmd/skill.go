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
		newSkillCreateCmd(app),
		newSkillUpdateCmd(app),
		newSkillDeleteCmd(app),
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
		Short: "Browse and search skills",
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
		Use:   "get <id>",
		Short: "Get skill details",
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

// --- Create (two-step: upload file first, then JSON create) ---

func newSkillCreateCmd(app *App) *cobra.Command {
	var (
		name          string
		description   string
		categories    string
		skillFile     string
		gitURL        string
		previewImg    string
		environmentID string
	)

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new skill",
		Long: `Create a new skill. Files are uploaded first, then the skill is created via JSON.

Examples:
  sandbase skill create --name "My Skill" --skill-file ./skill.zip --preview ./preview.png
  sandbase skill create --name "My Skill" --git-url https://github.com/user/repo/tree/main/skill --preview ./img.png`,
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

			// Step 1: Upload files via POST /v1/skills/upload-file
			files := map[string]string{}
			if skillFile != "" {
				files["skill_file"] = skillFile
			}
			files["preview_image"] = previewImg

			uploadResult, err := app.File.UploadMultipart(cmd.Context(), "/v1/skills/upload-file", nil, files)
			if err != nil {
				return fmt.Errorf("upload failed: %w", err)
			}

			skillFileURL, _ := uploadResult["skill_file_url"].(string)
			previewURLs, _ := uploadResult["preview_urls"].([]any)

			// Step 2: Create skill via JSON POST /v1/skills
			body := map[string]any{
				"name":           name,
				"skill_file_url": skillFileURL,
			}
			if len(previewURLs) > 0 {
				body["preview_urls"] = previewURLs
			}
			if description != "" {
				body["description"] = description
			}
			if categories != "" {
				body["categories"] = splitCategories(categories)
			}
			if gitURL != "" {
				body["git_url"] = gitURL
			}
			if environmentID != "" {
				body["environment_id"] = environmentID
			}

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
	cmd.Flags().StringVar(&description, "description", "", "Skill description")
	cmd.Flags().StringVar(&categories, "categories", "", "Comma-separated categories")
	cmd.Flags().StringVar(&skillFile, "skill-file", "", "Path to skill file")
	cmd.Flags().StringVar(&gitURL, "git-url", "", "GitHub directory URL (alternative to --skill-file)")
	cmd.Flags().StringVar(&previewImg, "preview", "", "Path to preview image (required)")
	cmd.Flags().StringVar(&environmentID, "environment-id", "", "Environment ID")
	return cmd
}

// --- Update ---

func newSkillUpdateCmd(app *App) *cobra.Command {
	var (
		name          string
		description   string
		categories    string
		skillFile     string
		previewImg    string
		environmentID string
	)

	cmd := &cobra.Command{
		Use:   "update <id>",
		Short: "Update a skill",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			if name == "" {
				return fmt.Errorf("--name is required")
			}

			body := map[string]any{
				"name": name,
			}
			if description != "" {
				body["description"] = description
			}
			if categories != "" {
				body["categories"] = splitCategories(categories)
			}
			if environmentID != "" {
				body["environment_id"] = environmentID
			}

			// If files provided, upload them first
			if skillFile != "" || previewImg != "" {
				files := map[string]string{}
				if skillFile != "" {
					files["skill_file"] = skillFile
				}
				if previewImg != "" {
					files["preview_image"] = previewImg
				}
				uploadResult, err := app.File.UploadMultipart(cmd.Context(), "/v1/skills/upload-file", nil, files)
				if err != nil {
					return fmt.Errorf("upload failed: %w", err)
				}
				if u, ok := uploadResult["skill_file_url"].(string); ok && u != "" {
					body["skill_file_url"] = u
				}
				if urls, ok := uploadResult["preview_urls"].([]any); ok && len(urls) > 0 {
					body["preview_urls"] = urls
				}
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
	cmd.Flags().StringVar(&name, "name", "", "Skill name (required)")
	cmd.Flags().StringVar(&description, "description", "", "Skill description")
	cmd.Flags().StringVar(&categories, "categories", "", "Comma-separated categories")
	cmd.Flags().StringVar(&skillFile, "skill-file", "", "Path to new skill file (optional)")
	cmd.Flags().StringVar(&previewImg, "preview", "", "Path to new preview image (optional)")
	cmd.Flags().StringVar(&environmentID, "environment-id", "", "Environment ID")
	return cmd
}

// --- Delete ---

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

// splitCategories splits a comma-separated string into a string slice.
func splitCategories(s string) []string {
	var result []string
	for _, part := range splitAndTrim(s, ",") {
		if part != "" {
			result = append(result, part)
		}
	}
	return result
}

func splitAndTrim(s, sep string) []string {
	parts := make([]string, 0)
	for _, p := range splitRaw(s, sep) {
		p = trimSpace(p)
		if p != "" {
			parts = append(parts, p)
		}
	}
	return parts
}

func splitRaw(s, sep string) []string {
	if s == "" {
		return nil
	}
	result := []string{}
	for s != "" {
		idx := indexOf(s, sep)
		if idx < 0 {
			result = append(result, s)
			break
		}
		result = append(result, s[:idx])
		s = s[idx+len(sep):]
	}
	return result
}

func indexOf(s, sub string) int {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func trimSpace(s string) string {
	for len(s) > 0 && (s[0] == ' ' || s[0] == '\t') {
		s = s[1:]
	}
	for len(s) > 0 && (s[len(s)-1] == ' ' || s[len(s)-1] == '\t') {
		s = s[:len(s)-1]
	}
	return s
}
