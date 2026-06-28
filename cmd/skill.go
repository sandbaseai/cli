package cmd

import (
	"archive/zip"
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/sandbaseai/cli/internal/client"
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
		newSkillGetCmd(app),
		newSkillUpdateCmd(app),
		newSkillDeleteCmd(app),
	)

	return skillCmd
}

func newSkillCreateCmd(app *App) *cobra.Command {
	var name string
	var description string
	var categories []string
	var filePath string
	var skillFileURL string
	var gitURL string

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new skill",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}

			sources := 0
			for _, value := range []string{filePath, skillFileURL, gitURL} {
				if strings.TrimSpace(value) != "" {
					sources++
				}
			}
			if sources != 1 {
				return fmt.Errorf("provide exactly one of --file, --skill-file-url, or --git-url")
			}

			if filePath != "" {
				filename, reader, err := prepareSkillUpload(filePath)
				if err != nil {
					return err
				}

				var uploadResult client.UploadResult
				if err := app.Client.PostMultipart(cmd.Context(), "/v1/skills/files", "file", filename, reader, &uploadResult); err != nil {
					return err
				}
				skillFileURL = uploadResult.URL
			}

			body := map[string]any{"name": name}
			if description != "" {
				body["description"] = description
			}
			if len(categories) > 0 {
				body["categories"] = categories
			}
			if skillFileURL != "" {
				body["skill_file_url"] = skillFileURL
			}
			if gitURL != "" {
				body["git_url"] = gitURL
			}

			result, err := app.Resource.Create(cmd.Context(), "skills", body)
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatSkillKeyValue(result)
			})
			return nil
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "Skill name (required)")
	cmd.Flags().StringVar(&description, "description", "", "Skill description")
	cmd.Flags().StringArrayVar(&categories, "category", nil, "Skill category tag (repeatable)")
	cmd.Flags().StringVar(&filePath, "file", "", "Local skill file or bundle to upload")
	cmd.Flags().StringVar(&skillFileURL, "skill-file-url", "", "Existing uploaded skill file URL")
	cmd.Flags().StringVar(&gitURL, "git-url", "", "Public Git repository URL for the skill")
	cmd.MarkFlagRequired("name")
	return cmd
}

func prepareSkillUpload(filePath string) (string, *bytes.Reader, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", nil, fmt.Errorf("read skill file: %w", err)
	}

	base := filepath.Base(filePath)
	ext := strings.ToLower(filepath.Ext(base))
	switch ext {
	case ".zip", ".gz", ".tgz", ".tar", ".bundle":
		return base, bytes.NewReader(data), nil
	}

	var buf bytes.Buffer
	writer := zip.NewWriter(&buf)
	part, err := writer.Create(base)
	if err != nil {
		return "", nil, fmt.Errorf("create skill bundle: %w", err)
	}
	if _, err := part.Write(data); err != nil {
		return "", nil, fmt.Errorf("write skill bundle: %w", err)
	}
	if err := writer.Close(); err != nil {
		return "", nil, fmt.Errorf("close skill bundle: %w", err)
	}

	bundleName := strings.TrimSuffix(base, ext) + ".zip"
	return bundleName, bytes.NewReader(buf.Bytes()), nil
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
				return formatSkillKeyValue(result)
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
				return formatSkillKeyValue(result)
			})
			return nil
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "New skill name")
	return cmd
}

func formatSkillKeyValue(m map[string]any) string {
	keys := []string{"name", "id", "display_name", "vendor_slug", "plugin_slug", "description", "skill_file_url", "git_url", "created_at", "updated_at"}
	seen := map[string]bool{}
	var sb strings.Builder
	for _, key := range keys {
		if value, ok := m[key]; ok && value != nil && value != "" {
			sb.WriteString(fmt.Sprintf("%-15s %v\n", key+":", value))
			seen[key] = true
		}
	}
	for key, value := range m {
		if seen[key] {
			continue
		}
		sb.WriteString(fmt.Sprintf("%-15s %v\n", key+":", value))
	}
	return strings.TrimSpace(sb.String())
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
