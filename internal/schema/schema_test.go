package schema

import (
	"strings"
	"testing"

	"github.com/sandbaseai/cli/internal/client"
)

func newTestService() *SchemaService {
	c := client.New("http://localhost", "test-key", 30, false)
	return New(c)
}

func testSchema() *UnifiedSchema {
	return &UnifiedSchema{
		Slug: "test-vendor/test-model",
		Kind: KindImage,
		Parameters: []SchemaParam{
			{
				Name:        "prompt",
				Type:        "string",
				Required:    true,
				Description: "The text prompt for generation",
			},
			{
				Name:        "width",
				Type:        "integer",
				Required:    false,
				Description: "Image width in pixels",
				Default:     1024,
			},
			{
				Name:        "style",
				Type:        "enum",
				Required:    false,
				Description: "Style preset",
				Default:     "natural",
				Enum:        []string{"natural", "vivid", "anime"},
			},
		},
	}
}

func TestValidate_AllRequiredPresent(t *testing.T) {
	svc := newTestService()
	schema := testSchema()

	params := map[string]any{
		"prompt": "a cat",
		"width":  512,
	}

	result := svc.Validate(schema, params)
	if !result.Valid {
		t.Errorf("expected Valid=true, got false; missing=%v", result.Missing)
	}
	if len(result.Missing) != 0 {
		t.Errorf("expected no missing params, got %v", result.Missing)
	}
}

func TestValidate_MissingRequired(t *testing.T) {
	svc := newTestService()
	schema := testSchema()

	// "prompt" is required but not provided
	params := map[string]any{
		"width": 512,
	}

	result := svc.Validate(schema, params)
	if result.Valid {
		t.Error("expected Valid=false, got true")
	}
	if len(result.Missing) != 1 || result.Missing[0] != "prompt" {
		t.Errorf("expected missing=[prompt], got %v", result.Missing)
	}
}

func TestValidate_NoRequiredParams(t *testing.T) {
	svc := newTestService()
	schema := &UnifiedSchema{
		Slug: "vendor/model",
		Kind: KindVideo,
		Parameters: []SchemaParam{
			{Name: "fps", Type: "integer", Required: false},
			{Name: "quality", Type: "string", Required: false},
		},
	}

	// Empty params should still be valid when nothing is required
	result := svc.Validate(schema, map[string]any{})
	if !result.Valid {
		t.Errorf("expected Valid=true, got false; missing=%v", result.Missing)
	}
}

func TestToHelpText_ContainsAllParams(t *testing.T) {
	svc := newTestService()
	schema := testSchema()

	helpText := svc.ToHelpText(schema)

	// Must contain model slug and kind
	if !strings.Contains(helpText, "test-vendor/test-model") {
		t.Error("help text missing model slug")
	}
	if !strings.Contains(helpText, string(KindImage)) {
		t.Error("help text missing model kind")
	}

	// Must contain each parameter's name, type, description
	for _, p := range schema.Parameters {
		if !strings.Contains(helpText, p.Name) {
			t.Errorf("help text missing parameter name: %s", p.Name)
		}
		if !strings.Contains(helpText, p.Type) {
			t.Errorf("help text missing parameter type: %s (param: %s)", p.Type, p.Name)
		}
		if p.Description != "" && !strings.Contains(helpText, p.Description) {
			t.Errorf("help text missing parameter description: %s (param: %s)", p.Description, p.Name)
		}
		if p.Default != nil {
			defStr := "Default:"
			if !strings.Contains(helpText, defStr) {
				t.Errorf("help text missing Default label for param: %s", p.Name)
			}
		}
	}

	// Enum values should appear
	if !strings.Contains(helpText, "natural, vivid, anime") {
		t.Error("help text missing enum values")
	}
}

func TestModelKind(t *testing.T) {
	svc := newTestService()

	tests := []struct {
		kind ModelKind
	}{
		{KindLLM},
		{KindImage},
		{KindVideo},
		{KindAudio},
		{Kind3D},
	}

	for _, tt := range tests {
		schema := &UnifiedSchema{Slug: "x/y", Kind: tt.kind}
		got := svc.ModelKind(schema)
		if got != tt.kind {
			t.Errorf("ModelKind() = %q, want %q", got, tt.kind)
		}
	}
}

func TestToTable(t *testing.T) {
	svc := newTestService()
	schema := testSchema()

	table := svc.ToTable(schema)

	// Must contain header
	if !strings.Contains(table, "NAME") {
		t.Error("table missing NAME header")
	}
	if !strings.Contains(table, "TYPE") {
		t.Error("table missing TYPE header")
	}
	if !strings.Contains(table, "REQUIRED") {
		t.Error("table missing REQUIRED header")
	}

	// Must contain each parameter name
	for _, p := range schema.Parameters {
		if !strings.Contains(table, p.Name) {
			t.Errorf("table missing parameter name: %s", p.Name)
		}
	}

	// Required field: "prompt" should show "yes"
	if !strings.Contains(table, "yes") {
		t.Error("table missing 'yes' for required param")
	}
	// Non-required field: "width" should show "no"
	if !strings.Contains(table, "no") {
		t.Error("table missing 'no' for optional param")
	}
}
