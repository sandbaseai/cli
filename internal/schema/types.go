package schema

// ModelKind represents the type/category of a model.
type ModelKind string

const (
	KindLLM   ModelKind = "llm"
	KindImage ModelKind = "image"
	KindVideo ModelKind = "video"
	KindAudio ModelKind = "audio"
	Kind3D    ModelKind = "3d"
)

// UnifiedSchema represents the unified parameter schema for a model.
type UnifiedSchema struct {
	Slug       string        `json:"slug"`
	Kind       ModelKind     `json:"kind"`
	Parameters []SchemaParam `json:"parameters"`
}

// SchemaParam represents a single parameter in a model's schema.
type SchemaParam struct {
	Name        string   `json:"name"`
	Type        string   `json:"type"`
	Required    bool     `json:"required"`
	Description string   `json:"description"`
	Default     any      `json:"default,omitempty"`
	Enum        []string `json:"enum,omitempty"`
	Accepts     string   `json:"accepts,omitempty"`
}

// ValidationResult holds the outcome of validating user parameters against a schema.
type ValidationResult struct {
	Valid   bool
	Missing []string
	Invalid []SchemaParamError
}

// SchemaParamError describes a validation error for a specific parameter.
type SchemaParamError struct {
	Name    string
	Message string
}
