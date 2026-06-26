package models

import "strings"

// Model represents a model entry for client-side discovery filtering.
type Model struct {
	Slug     string
	Name     string
	Type     string
	Provider string
	Tags     []string
}

// FilterByType returns models whose Type equals typeFilter.
// When typeFilter is empty, all models are returned unchanged.
func FilterByType(models []Model, typeFilter string) []Model {
	if typeFilter == "" {
		return models
	}
	out := make([]Model, 0, len(models))
	for _, m := range models {
		if m.Type == typeFilter {
			out = append(out, m)
		}
	}
	return out
}

// Search returns models matching query (case-insensitive substring) in name,
// slug, provider, or any tag. When query is empty, all models are returned.
func Search(models []Model, query string) []Model {
	if query == "" {
		return models
	}
	q := strings.ToLower(query)
	out := make([]Model, 0, len(models))
	for _, m := range models {
		if matches(m, q) {
			out = append(out, m)
		}
	}
	return out
}

// matches reports whether the (already lowercased) query is a substring of any
// searchable field of the model.
func matches(m Model, q string) bool {
	if strings.Contains(strings.ToLower(m.Name), q) ||
		strings.Contains(strings.ToLower(m.Slug), q) ||
		strings.Contains(strings.ToLower(m.Provider), q) {
		return true
	}
	for _, tag := range m.Tags {
		if strings.Contains(strings.ToLower(tag), q) {
			return true
		}
	}
	return false
}
