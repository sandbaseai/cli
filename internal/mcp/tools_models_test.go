package mcp

import "testing"

func TestModelSlugPathPreservesSlashDelimitedModelID(t *testing.T) {
	got := modelSlugPath("openai/gpt-image-2/edit")
	want := "openai/gpt-image-2/edit"
	if got != want {
		t.Fatalf("modelSlugPath() = %q, want %q", got, want)
	}
}
