package mcp

import (
	"encoding/json"
	"fmt"
)

// TextResult creates a successful text content result.
func TextResult(text string) *ToolResult {
	return &ToolResult{
		Content: []ContentBlock{{Type: "text", Text: text}},
	}
}

// JSONResult marshals data to indented JSON and returns as text result.
func JSONResult(data any) *ToolResult {
	b, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return ErrorResult(fmt.Sprintf("failed to marshal result: %v", err))
	}
	return TextResult(string(b))
}

// ErrorResult creates an error result with a descriptive message.
func ErrorResult(msg string) *ToolResult {
	return &ToolResult{
		Content: []ContentBlock{{Type: "text", Text: msg}},
		IsError: true,
	}
}

// ErrorResultf creates a formatted error result.
func ErrorResultf(format string, args ...any) *ToolResult {
	return ErrorResult(fmt.Sprintf(format, args...))
}

// RequireString extracts a required string parameter, returning an error result if missing.
func RequireString(params map[string]any, key string) (string, *ToolResult) {
	v, ok := params[key]
	if !ok || v == nil {
		return "", ErrorResultf("%s is required", key)
	}
	s, ok := v.(string)
	if !ok || s == "" {
		return "", ErrorResultf("%s is required", key)
	}
	return s, nil
}

// OptionalString extracts an optional string parameter.
func OptionalString(params map[string]any, key string) string {
	v, ok := params[key]
	if !ok || v == nil {
		return ""
	}
	s, _ := v.(string)
	return s
}

// OptionalBool extracts an optional boolean parameter with a default value.
func OptionalBool(params map[string]any, key string, defaultVal bool) bool {
	v, ok := params[key]
	if !ok || v == nil {
		return defaultVal
	}
	b, ok := v.(bool)
	if !ok {
		return defaultVal
	}
	return b
}

// Schema helpers for building tool input schemas.

func ObjectSchema(properties map[string]any, required []string) map[string]any {
	s := map[string]any{
		"type":       "object",
		"properties": properties,
	}
	if len(required) > 0 {
		s["required"] = required
	}
	return s
}

func StringProp(description string) map[string]any {
	return map[string]any{"type": "string", "description": description}
}

func BoolProp(description string, defaultVal bool) map[string]any {
	return map[string]any{"type": "boolean", "description": description, "default": defaultVal}
}

func ObjectProp(description string) map[string]any {
	return map[string]any{"type": "object", "description": description, "additionalProperties": true}
}
