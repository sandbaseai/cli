package cmd

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	clierrors "github.com/sandbaseai/cli/internal/errors"
	modelfilter "github.com/sandbaseai/cli/internal/models"
	"github.com/spf13/cobra"
)

// applyLocalFilter applies client-side type filtering and search on the model
// set returned by the server. The server query params are still sent, but
// applying the local filter on the result guarantees verifiable behavior even
// if the server returns a superset.
func applyLocalFilter(models []Model, query, typeFilter string) []Model {
	fm := make([]modelfilter.Model, len(models))
	for i, m := range models {
		fm[i] = modelfilter.Model{
			Slug:     m.Slug,
			Name:     m.Name,
			Type:     m.Type,
			Provider: m.Provider,
			Tags:     m.Tags,
		}
	}
	fm = modelfilter.FilterByType(fm, typeFilter)
	fm = modelfilter.Search(fm, query)

	out := make([]Model, len(fm))
	for i, m := range fm {
		out[i] = Model{
			Slug:     m.Slug,
			Name:     m.Name,
			Type:     m.Type,
			Provider: m.Provider,
			Tags:     m.Tags,
		}
	}
	return out
}

// Model represents a model entry from the API.
type Model struct {
	Slug     string   `json:"slug"`
	Name     string   `json:"name"`
	Type     string   `json:"type"`
	Provider string   `json:"provider"`
	Tags     []string `json:"tags,omitempty"`
}

// ModelDetail represents detailed model info from the API.
type ModelDetail struct {
	Slug        string   `json:"slug"`
	Name        string   `json:"name"`
	Type        string   `json:"type"`
	Provider    string   `json:"provider"`
	Tags        []string `json:"tags,omitempty"`
	Description string   `json:"description,omitempty"`
	Version     string   `json:"version,omitempty"`
}

// ModelsListResponse represents the API response for listing models.
type ModelsListResponse struct {
	Models []Model `json:"models"`
}

func newModelsCmd(app *App) *cobra.Command {
	var typeFilter string

	modelsCmd := &cobra.Command{
		Use:   "models [query]",
		Short: "List and search available models",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			var query string
			if len(args) > 0 {
				query = args[0]
			}
			return modelsListExec(cmd.Context(), app, query, typeFilter)
		},
	}

	modelsCmd.Flags().StringVar(&typeFilter, "type", "", "Filter models by type (e.g., llm, image, video)")

	// Add get subcommand
	modelsCmd.AddCommand(newModelsGetCmd(app))

	return modelsCmd
}

func modelsListExec(ctx context.Context, app *App, query, typeFilter string) error {
	if err := app.EnsureClient(); err != nil {
		return err
	}

	// Build query parameters
	params := url.Values{}
	if query != "" {
		params.Set("query", query)
	}
	if typeFilter != "" {
		params.Set("type", typeFilter)
	}

	path := "/v1/models"
	if len(params) > 0 {
		path += "?" + params.Encode()
	}

	var response ModelsListResponse
	if err := app.Client.Request(ctx, http.MethodGet, path, nil, &response); err != nil {
		return err
	}

	// Apply client-side filter on the returned set so filtering behavior is
	// verifiable regardless of how the server interprets query params.
	response.Models = applyLocalFilter(response.Models, query, typeFilter)

	if len(response.Models) == 0 {
		// Single output path: empty list. TTY shows a friendly message via the
		// formatter; JSON shows an empty array. No separate Info() to avoid
		// double output.
		app.Output.Data(
			map[string]any{"models": []Model{}},
			func(payload any) string { return "No models found." },
		)
		return nil
	}

	app.Output.Data(
		map[string]any{"models": response.Models},
		func(payload any) string {
			return formatModelsTable(response.Models)
		},
	)
	return nil
}

func formatModelsTable(models []Model) string {
	var sb strings.Builder

	// Header
	sb.WriteString(fmt.Sprintf("%-50s %-30s %-10s %s\n", "SLUG", "NAME", "TYPE", "PROVIDER"))
	sb.WriteString(strings.Repeat("─", 100) + "\n")

	for _, m := range models {
		name := m.Name
		if len(name) > 28 {
			name = name[:25] + "..."
		}
		slug := m.Slug
		if len(slug) > 48 {
			slug = slug[:45] + "..."
		}
		sb.WriteString(fmt.Sprintf("%-50s %-30s %-10s %s\n", slug, name, m.Type, m.Provider))
	}

	return strings.TrimSpace(sb.String())
}

func newModelsGetCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "get <slug>",
		Short: "Show details for a specific model",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return modelsGetExec(cmd.Context(), app, args[0])
		},
	}
}

func modelsGetExec(ctx context.Context, app *App, slug string) error {
	if err := app.EnsureClient(); err != nil {
		return err
	}

	path := fmt.Sprintf("/v1/models/%s", url.PathEscape(slug))

	var detail ModelDetail
	if err := app.Client.Request(ctx, http.MethodGet, path, nil, &detail); err != nil {
		return err
	}

	if detail.Slug == "" {
		return &clierrors.CliError{
			Code:     "NOT_FOUND",
			Message:  fmt.Sprintf("model %q not found", slug),
			ExitCode: 1,
		}
	}

	app.Output.Data(
		detail,
		func(payload any) string {
			return formatModelDetail(detail)
		},
	)
	return nil
}

func formatModelDetail(m ModelDetail) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("Model: %s\n", m.Name))
	sb.WriteString(fmt.Sprintf("  Slug:     %s\n", m.Slug))
	sb.WriteString(fmt.Sprintf("  Type:     %s\n", m.Type))
	sb.WriteString(fmt.Sprintf("  Provider: %s\n", m.Provider))
	if m.Version != "" {
		sb.WriteString(fmt.Sprintf("  Version:  %s\n", m.Version))
	}
	if m.Description != "" {
		sb.WriteString(fmt.Sprintf("  Description: %s\n", m.Description))
	}
	if len(m.Tags) > 0 {
		sb.WriteString(fmt.Sprintf("  Tags:     %s\n", strings.Join(m.Tags, ", ")))
	}

	return strings.TrimSpace(sb.String())
}
