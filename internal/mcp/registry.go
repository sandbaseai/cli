package mcp

import (
	"context"
	"fmt"
	"sync"
)

// Registry manages MCP tool registration, filtering, and dispatch.
type Registry struct {
	mu       sync.RWMutex
	tools    map[string]ToolDef
	order    []string // insertion order for stable listing
	toolsets map[Toolset]bool
	readOnly bool
}

// NewRegistry creates a Registry with the specified enabled toolsets and read-only mode.
// If enabledToolsets is nil or empty, all toolsets are enabled.
func NewRegistry(enabledToolsets []Toolset, readOnly bool) *Registry {
	ts := make(map[Toolset]bool)
	if len(enabledToolsets) == 0 {
		for _, t := range AllToolsets {
			ts[t] = true
		}
	} else {
		for _, t := range enabledToolsets {
			ts[t] = true
		}
	}
	return &Registry{
		tools:    make(map[string]ToolDef),
		toolsets: ts,
		readOnly: readOnly,
	}
}

// Register adds a tool definition to the registry.
// If a tool with the same name already exists, it is overwritten.
func (r *Registry) Register(def ToolDef) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.tools[def.Name]; !exists {
		r.order = append(r.order, def.Name)
	}
	r.tools[def.Name] = def
}

// IsEnabled checks whether a tool should be exposed based on toolset and read-only filters.
func (r *Registry) IsEnabled(def ToolDef) bool {
	if !r.toolsets[def.Toolset] {
		return false
	}
	if r.readOnly && !def.ReadOnly {
		return false
	}
	return true
}

// ListTools returns all registered tools that pass the current filters.
func (r *Registry) ListTools() []ToolDef {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []ToolDef
	for _, name := range r.order {
		def := r.tools[name]
		if r.IsEnabled(def) {
			result = append(result, def)
		}
	}
	return result
}

// Dispatch routes a tool call to the appropriate handler.
// Returns an error if the tool is not found or not enabled.
func (r *Registry) Dispatch(ctx context.Context, name string, params map[string]any) (*ToolResult, error) {
	r.mu.RLock()
	def, exists := r.tools[name]
	r.mu.RUnlock()

	if !exists || !r.IsEnabled(def) {
		return nil, fmt.Errorf("tool not found: %s", name)
	}

	result, err := def.Handler(ctx, params)
	if err != nil {
		// Convert Go errors to ToolResult{IsError: true} per design spec
		return &ToolResult{
			Content: []ContentBlock{{Type: "text", Text: err.Error()}},
			IsError: true,
		}, nil
	}
	return result, nil
}
