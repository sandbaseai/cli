package cmd

import (
	"encoding/json"
	"testing"
)

func TestModelsListResponseAcceptsDataEnvelope(t *testing.T) {
	raw := []byte(`{
		"data": [{
			"name": "openai/gpt-image-2",
			"display_name": "GPT Image 2",
			"type": "image",
			"vendor": "OpenAI"
		}]
	}`)

	var response ModelsListResponse
	if err := json.Unmarshal(raw, &response); err != nil {
		t.Fatal(err)
	}

	models := response.normalizedModels()
	if len(models) != 1 {
		t.Fatalf("len(models) = %d, want 1", len(models))
	}
	if got, want := models[0].Slug, "openai/gpt-image-2"; got != want {
		t.Fatalf("Slug = %q, want %q", got, want)
	}
	if got, want := models[0].Name, "GPT Image 2"; got != want {
		t.Fatalf("Name = %q, want %q", got, want)
	}
	if got, want := models[0].Provider, "OpenAI"; got != want {
		t.Fatalf("Provider = %q, want %q", got, want)
	}
}

func TestModelSlugPathPreservesModelSegments(t *testing.T) {
	got := modelSlugPath("bytedance/seedance/2.0/text-to-video")
	want := "bytedance/seedance/2.0/text-to-video"
	if got != want {
		t.Fatalf("modelSlugPath() = %q, want %q", got, want)
	}
}

func TestModelDetailPrefersModelNameOverInternalID(t *testing.T) {
	raw := []byte(`{
		"id": "23646436-c8c7-43f0-a404-c0dc729e1868",
		"name": "openai/gpt-image-2",
		"display_name": "GPT Image 2",
		"type": "image",
		"vendor": "OpenAI"
	}`)

	var detail ModelDetail
	if err := json.Unmarshal(raw, &detail); err != nil {
		t.Fatal(err)
	}

	if got, want := detail.Slug, "openai/gpt-image-2"; got != want {
		t.Fatalf("Slug = %q, want %q", got, want)
	}
}
