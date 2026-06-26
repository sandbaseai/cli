package schema

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/sandbaseai/cli/internal/client"
)

// SchemaService handles model schema operations.
type SchemaService struct {
	Client *client.ApiClient
}

// New creates a SchemaService.
func New(c *client.ApiClient) *SchemaService {
	return &SchemaService{Client: c}
}

// Fetch retrieves the unified schema for a model by slug.
func (s *SchemaService) Fetch(ctx context.Context, slug string) (*UnifiedSchema, error) {
	var schema UnifiedSchema
	path := fmt.Sprintf("/v1/models/%s/schema", slug)
	err := s.Client.Request(ctx, http.MethodGet, path, nil, &schema)
	if err != nil {
		return nil, err
	}
	return &schema, nil
}

// ModelKind returns the kind of model from its schema.
func (s *SchemaService) ModelKind(schema *UnifiedSchema) ModelKind {
	return schema.Kind
}

// IsLLM reports whether the given kind is an LLM model.
func IsLLM(k ModelKind) bool { return k == KindLLM }

// IsRunnable reports whether the `run` command accepts a model of this kind.
// `run` is for multimodal generation models (non-LLM).
func IsRunnable(k ModelKind) bool { return !IsLLM(k) }

// IsChattable reports whether the `chat` command accepts a model of this kind.
// `chat` is for LLM models only.
func IsChattable(k ModelKind) bool { return IsLLM(k) }

// Validate checks user parameters against the schema.
// Returns which required params are missing.
func (s *SchemaService) Validate(schema *UnifiedSchema, params map[string]any) *ValidationResult {
	result := &ValidationResult{Valid: true}

	for _, p := range schema.Parameters {
		if p.Required {
			if _, ok := params[p.Name]; !ok {
				result.Missing = append(result.Missing, p.Name)
				result.Valid = false
			}
		}
	}

	return result
}

// ToHelpText generates a help text string from the schema for `run <slug> --help`.
func (s *SchemaService) ToHelpText(schema *UnifiedSchema) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Model: %s (%s)\n\n", schema.Slug, schema.Kind))
	sb.WriteString("Parameters:\n")

	for _, p := range schema.Parameters {
		required := ""
		if p.Required {
			required = " (required)"
		}
		sb.WriteString(fmt.Sprintf("  --%s %s%s\n", p.Name, p.Type, required))
		if p.Description != "" {
			sb.WriteString(fmt.Sprintf("      %s\n", p.Description))
		}
		if p.Default != nil {
			sb.WriteString(fmt.Sprintf("      Default: %v\n", p.Default))
		}
		if len(p.Enum) > 0 {
			sb.WriteString(fmt.Sprintf("      Allowed: %s\n", strings.Join(p.Enum, ", ")))
		}
	}

	return sb.String()
}

// ToTable generates a formatted table string of parameters.
func (s *SchemaService) ToTable(schema *UnifiedSchema) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("%-20s %-10s %-10s %-40s %s\n", "NAME", "TYPE", "REQUIRED", "DESCRIPTION", "DEFAULT"))
	sb.WriteString(strings.Repeat("-", 100) + "\n")

	for _, p := range schema.Parameters {
		req := "no"
		if p.Required {
			req = "yes"
		}
		desc := p.Description
		if len(desc) > 40 {
			desc = desc[:37] + "..."
		}
		def := ""
		if p.Default != nil {
			def = fmt.Sprintf("%v", p.Default)
		}
		sb.WriteString(fmt.Sprintf("%-20s %-10s %-10s %-40s %s\n", p.Name, p.Type, req, desc, def))
	}

	return sb.String()
}
