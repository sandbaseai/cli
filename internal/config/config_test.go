package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// helper to create a Manager with in-memory file system
func testManager(globalDir string, files map[string][]byte, projectPath string) *Manager {
	return &Manager{
		GlobalDir: globalDir,
		FindProject: func(cwd string) string {
			return projectPath
		},
		FileReader: func(path string) ([]byte, error) {
			if data, ok := files[path]; ok {
				return data, nil
			}
			return nil, os.ErrNotExist
		},
		FileWriter: func(path string, data []byte, perm os.FileMode) error {
			files[path] = data
			return nil
		},
		MkdirAll: func(path string, perm os.FileMode) error {
			return nil
		},
	}
}

func TestLoad_DefaultsWhenNoFiles(t *testing.T) {
	files := map[string][]byte{}
	m := testManager("/home/.config/sandbase", files, "")

	cfg, err := m.Load("/project")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.BaseURL != defaultBaseURL {
		t.Errorf("expected baseURL %q, got %q", defaultBaseURL, cfg.BaseURL)
	}
	if cfg.DefaultChatModel != "" {
		t.Errorf("expected empty defaultChatModel, got %q", cfg.DefaultChatModel)
	}
	if cfg.APIKey != "" {
		t.Errorf("expected empty APIKey, got %q", cfg.APIKey)
	}
	if len(cfg.Aliases) != 0 {
		t.Errorf("expected empty aliases, got %v", cfg.Aliases)
	}
	if len(cfg.Defaults) != 0 {
		t.Errorf("expected empty defaults, got %v", cfg.Defaults)
	}
}

func TestLoad_GlobalConfigOnly(t *testing.T) {
	globalData, _ := json.Marshal(globalConfig{
		BaseURL:            "https://custom.api.com",
		DefaultChatModel:   "openai/gpt-4",
		DefaultDownloadDir: "/tmp/downloads",
	})

	files := map[string][]byte{
		"/home/.config/sandbase/config.json": globalData,
	}
	m := testManager("/home/.config/sandbase", files, "")

	cfg, err := m.Load("/project")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.BaseURL != "https://custom.api.com" {
		t.Errorf("expected baseURL %q, got %q", "https://custom.api.com", cfg.BaseURL)
	}
	if cfg.DefaultChatModel != "openai/gpt-4" {
		t.Errorf("expected defaultChatModel %q, got %q", "openai/gpt-4", cfg.DefaultChatModel)
	}
	if cfg.DefaultDownloadDir != "/tmp/downloads" {
		t.Errorf("expected defaultDownloadDir %q, got %q", "/tmp/downloads", cfg.DefaultDownloadDir)
	}
}

func TestLoad_ProjectOverridesGlobal(t *testing.T) {
	globalData, _ := json.Marshal(globalConfig{
		BaseURL:          "https://global.api.com",
		DefaultChatModel: "openai/gpt-4",
	})

	projectData, _ := json.Marshal(projectConfig{
		APIKey:           "sk-project123",
		DefaultChatModel: "anthropic/claude-sonnet-4",
		Aliases: map[string]string{
			"flux": "black-forest-labs/flux-1.1-pro",
		},
		Defaults: map[string]map[string]any{
			"black-forest-labs/flux-1.1-pro": {
				"width":  1024,
				"height": 768,
			},
		},
	})

	files := map[string][]byte{
		"/home/.config/sandbase/config.json": globalData,
		"/project/sandbase.json":             projectData,
	}
	m := testManager("/home/.config/sandbase", files, "/project/sandbase.json")

	cfg, err := m.Load("/project")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// BaseURL should stay from global (project doesn't set it)
	if cfg.BaseURL != "https://global.api.com" {
		t.Errorf("expected baseURL %q, got %q", "https://global.api.com", cfg.BaseURL)
	}
	// DefaultChatModel should be overridden by project
	if cfg.DefaultChatModel != "anthropic/claude-sonnet-4" {
		t.Errorf("expected defaultChatModel %q, got %q", "anthropic/claude-sonnet-4", cfg.DefaultChatModel)
	}
	// APIKey from project
	if cfg.APIKey != "sk-project123" {
		t.Errorf("expected APIKey %q, got %q", "sk-project123", cfg.APIKey)
	}
	// Aliases from project
	if cfg.Aliases["flux"] != "black-forest-labs/flux-1.1-pro" {
		t.Errorf("expected alias flux -> black-forest-labs/flux-1.1-pro, got %q", cfg.Aliases["flux"])
	}
	// Defaults from project
	defaults, ok := cfg.Defaults["black-forest-labs/flux-1.1-pro"]
	if !ok {
		t.Fatal("expected defaults for flux model")
	}
	if defaults["width"] != float64(1024) {
		t.Errorf("expected width=1024, got %v", defaults["width"])
	}
}

func TestResolveAlias_KnownAlias(t *testing.T) {
	m := NewManager()
	cfg := &ResolvedConfig{
		Aliases: map[string]string{
			"kling": "kwaivgi/kling-video/3.0/pro/image-to-video",
			"flux":  "black-forest-labs/flux-1.1-pro",
		},
	}

	slug := m.ResolveAlias(cfg, "kling")
	if slug != "kwaivgi/kling-video/3.0/pro/image-to-video" {
		t.Errorf("expected resolved slug, got %q", slug)
	}
}

func TestResolveAlias_UnknownAlias(t *testing.T) {
	m := NewManager()
	cfg := &ResolvedConfig{
		Aliases: map[string]string{
			"kling": "kwaivgi/kling-video/3.0/pro/image-to-video",
		},
	}

	slug := m.ResolveAlias(cfg, "some-full-slug/path")
	if slug != "some-full-slug/path" {
		t.Errorf("expected original name returned, got %q", slug)
	}
}

func TestResolveAlias_NilAliases(t *testing.T) {
	m := NewManager()
	cfg := &ResolvedConfig{Aliases: nil}

	slug := m.ResolveAlias(cfg, "anything")
	if slug != "anything" {
		t.Errorf("expected original name, got %q", slug)
	}
}

func TestMergeParams_CLIOverridesDefaults(t *testing.T) {
	m := NewManager()
	cfg := &ResolvedConfig{
		Defaults: map[string]map[string]any{
			"model/slug": {
				"duration":     5,
				"aspect_ratio": "16:9",
				"quality":      "high",
			},
		},
	}

	cliParams := map[string]any{
		"duration": 10,
		"prompt":   "a cat",
	}

	result := m.MergeParams(cfg, "model/slug", cliParams)

	// CLI param overrides default
	if result["duration"] != 10 {
		t.Errorf("expected duration=10, got %v", result["duration"])
	}
	// Default preserved when CLI doesn't set
	if result["aspect_ratio"] != "16:9" {
		t.Errorf("expected aspect_ratio=16:9, got %v", result["aspect_ratio"])
	}
	if result["quality"] != "high" {
		t.Errorf("expected quality=high, got %v", result["quality"])
	}
	// CLI-only param included
	if result["prompt"] != "a cat" {
		t.Errorf("expected prompt='a cat', got %v", result["prompt"])
	}
}

func TestMergeParams_NoDefaults(t *testing.T) {
	m := NewManager()
	cfg := &ResolvedConfig{
		Defaults: map[string]map[string]any{},
	}

	cliParams := map[string]any{
		"prompt": "hello",
	}

	result := m.MergeParams(cfg, "model/slug", cliParams)
	if result["prompt"] != "hello" {
		t.Errorf("expected prompt=hello, got %v", result["prompt"])
	}
	if len(result) != 1 {
		t.Errorf("expected 1 key, got %d", len(result))
	}
}

func TestMergeParams_NilCLIParams(t *testing.T) {
	m := NewManager()
	cfg := &ResolvedConfig{
		Defaults: map[string]map[string]any{
			"model/slug": {
				"quality": "high",
			},
		},
	}

	result := m.MergeParams(cfg, "model/slug", nil)
	if result["quality"] != "high" {
		t.Errorf("expected quality=high, got %v", result["quality"])
	}
}

func TestSetGlobal_GetGlobal_Roundtrip(t *testing.T) {
	files := map[string][]byte{}
	m := testManager("/home/.config/sandbase", files, "")

	// Set a string value
	if err := m.SetGlobal("baseUrl", "https://test.api.com"); err != nil {
		t.Fatalf("SetGlobal error: %v", err)
	}

	val, err := m.GetGlobal("baseUrl")
	if err != nil {
		t.Fatalf("GetGlobal error: %v", err)
	}
	if val != "https://test.api.com" {
		t.Errorf("expected %q, got %q", "https://test.api.com", val)
	}

	// Set a boolean value
	if err := m.SetGlobal("telemetry", "false"); err != nil {
		t.Fatalf("SetGlobal error: %v", err)
	}

	val, err = m.GetGlobal("telemetry")
	if err != nil {
		t.Fatalf("GetGlobal error: %v", err)
	}
	if val != "false" {
		t.Errorf("expected %q, got %q", "false", val)
	}

	// Previous key should still be there
	val, err = m.GetGlobal("baseUrl")
	if err != nil {
		t.Fatalf("GetGlobal error: %v", err)
	}
	if val != "https://test.api.com" {
		t.Errorf("expected previous key preserved, got %q", val)
	}
}

func TestGetGlobal_NonexistentKey(t *testing.T) {
	globalData, _ := json.Marshal(map[string]any{
		"baseUrl": "https://api.com",
	})
	files := map[string][]byte{
		"/home/.config/sandbase/config.json": globalData,
	}
	m := testManager("/home/.config/sandbase", files, "")

	val, err := m.GetGlobal("nonexistent")
	if err != nil {
		t.Fatalf("GetGlobal error: %v", err)
	}
	if val != "" {
		t.Errorf("expected empty string for nonexistent key, got %q", val)
	}
}

func TestGetGlobal_NoConfigFile(t *testing.T) {
	files := map[string][]byte{}
	m := testManager("/home/.config/sandbase", files, "")

	val, err := m.GetGlobal("anykey")
	if err != nil {
		t.Fatalf("GetGlobal error: %v", err)
	}
	if val != "" {
		t.Errorf("expected empty string, got %q", val)
	}
}

func TestFindProjectConfig_WalksUp(t *testing.T) {
	// Create a temp directory structure
	tmpDir := t.TempDir()

	// Create structure: tmpDir/a/b/c/ with sandbase.json at tmpDir/a/
	aDir := filepath.Join(tmpDir, "a")
	bDir := filepath.Join(aDir, "b")
	cDir := filepath.Join(bDir, "c")
	if err := os.MkdirAll(cDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Place sandbase.json at a/
	configPath := filepath.Join(aDir, "sandbase.json")
	if err := os.WriteFile(configPath, []byte(`{"apiKey":"test"}`), 0644); err != nil {
		t.Fatal(err)
	}

	// FindProject from c/ should find at a/
	found := findProjectConfig(cDir)
	if found != configPath {
		t.Errorf("expected %q, got %q", configPath, found)
	}
}

func TestFindProjectConfig_FindsNearest(t *testing.T) {
	// Create a temp directory structure
	tmpDir := t.TempDir()

	// Create structure: tmpDir/a/b/ with sandbase.json at both tmpDir/a/ and tmpDir/a/b/
	aDir := filepath.Join(tmpDir, "a")
	bDir := filepath.Join(aDir, "b")
	if err := os.MkdirAll(bDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Place sandbase.json at both levels
	outerConfig := filepath.Join(aDir, "sandbase.json")
	innerConfig := filepath.Join(bDir, "sandbase.json")
	if err := os.WriteFile(outerConfig, []byte(`{"apiKey":"outer"}`), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(innerConfig, []byte(`{"apiKey":"inner"}`), 0644); err != nil {
		t.Fatal(err)
	}

	// FindProject from b/ should find the nearest (b/sandbase.json)
	found := findProjectConfig(bDir)
	if found != innerConfig {
		t.Errorf("expected nearest %q, got %q", innerConfig, found)
	}

	// FindProject from a/ should find a/sandbase.json
	found = findProjectConfig(aDir)
	if found != outerConfig {
		t.Errorf("expected %q, got %q", outerConfig, found)
	}
}

func TestFindProjectConfig_NotFound(t *testing.T) {
	tmpDir := t.TempDir()
	found := findProjectConfig(tmpDir)
	if found != "" {
		t.Errorf("expected empty string when no config found, got %q", found)
	}
}

func TestSetGlobal_BooleanTrue(t *testing.T) {
	files := map[string][]byte{}
	m := testManager("/home/.config/sandbase", files, "")

	if err := m.SetGlobal("telemetry", "true"); err != nil {
		t.Fatalf("SetGlobal error: %v", err)
	}

	val, err := m.GetGlobal("telemetry")
	if err != nil {
		t.Fatalf("GetGlobal error: %v", err)
	}
	if val != "true" {
		t.Errorf("expected %q, got %q", "true", val)
	}
}
