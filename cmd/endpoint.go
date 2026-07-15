package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

func newEndpointCmd(app *App) *cobra.Command {
	endpointCmd := &cobra.Command{
		Use:   "endpoint",
		Short: "Manage agent endpoints",
	}
	endpointCmd.AddCommand(newEndpointCreateCmd(app))
	return endpointCmd
}

func newEndpointCreateCmd(app *App) *cobra.Command {
	var filePath string
	var name string
	var runtime string
	var skills []string

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a declarative agent endpoint",
		Example: `  sandbase endpoint create --name reviewer --runtime hermes
  sandbase endpoint create --name reviewer --runtime hermes --skill vendor/reviewer
  sandbase endpoint create --file endpoint.yaml`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}

			var result map[string]any
			var err error
			if filePath != "" {
				if cmd.Flags().Changed("name") || cmd.Flags().Changed("runtime") || cmd.Flags().Changed("skill") {
					return fmt.Errorf("--file cannot be combined with --name, --runtime, or --skill")
				}
				definition, readErr := os.ReadFile(filePath)
				if readErr != nil {
					return fmt.Errorf("read endpoint definition: %w", readErr)
				}
				if strings.TrimSpace(string(definition)) == "" {
					return fmt.Errorf("endpoint definition file is empty")
				}
				result, err = app.Resource.CreateRaw(cmd.Context(), "endpoints", definition, endpointDefinitionContentType(filePath, definition))
			} else {
				if strings.TrimSpace(name) == "" || strings.TrimSpace(runtime) == "" {
					return fmt.Errorf("--name and --runtime are required unless --file is used")
				}
				body := map[string]any{
					"name":    strings.TrimSpace(name),
					"runtime": strings.TrimSpace(runtime),
					"skills":  skills,
				}
				result, err = app.Resource.Create(cmd.Context(), "endpoints", body)
			}
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string { return formatKeyValue(result) })
			return nil
		},
	}

	cmd.Flags().StringVarP(&filePath, "file", "f", "", "YAML or JSON endpoint definition")
	cmd.Flags().StringVar(&name, "name", "", "Endpoint name")
	cmd.Flags().StringVar(&runtime, "runtime", "", "Agent runtime (for example: hermes)")
	cmd.Flags().StringSliceVar(&skills, "skill", nil, "Full Skill ref vendor_slug/plugin_slug (repeatable)")
	return cmd
}

func endpointDefinitionContentType(path string, body []byte) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".json":
		return "application/json"
	case ".yaml", ".yml":
		return "application/yaml"
	default:
		if strings.HasPrefix(strings.TrimSpace(string(body)), "{") {
			return "application/json"
		}
		return "application/yaml"
	}
}
