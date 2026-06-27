package auth

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestResolve_EnvKey(t *testing.T) {
	r := &Resolver{
		EnvReader:     func(key string) string { return "sk-env-key-1234" },
		FileReader:    func(path string) ([]byte, error) { return nil, os.ErrNotExist },
		ConfigFinder:  func(cwd string) string { return "" },
		CredentialDir: t.TempDir(),
	}

	result := r.Resolve("/some/dir")
	if result.Source != SourceEnv {
		t.Errorf("expected source %q, got %q", SourceEnv, result.Source)
	}
	if result.APIKey != "sk-env-key-1234" {
		t.Errorf("expected key %q, got %q", "sk-env-key-1234", result.APIKey)
	}
}

func TestResolve_ProjectKey(t *testing.T) {
	projectConfig := `{"apiKey": "sk-project-key-5678"}`

	r := &Resolver{
		EnvReader: func(key string) string { return "" },
		FileReader: func(path string) ([]byte, error) {
			if filepath.Base(path) == "sandbase.json" {
				return []byte(projectConfig), nil
			}
			return nil, os.ErrNotExist
		},
		ConfigFinder:  func(cwd string) string { return filepath.Join(cwd, "sandbase.json") },
		CredentialDir: t.TempDir(),
	}

	result := r.Resolve("/project")
	if result.Source != SourceProject {
		t.Errorf("expected source %q, got %q", SourceProject, result.Source)
	}
	if result.APIKey != "sk-project-key-5678" {
		t.Errorf("expected key %q, got %q", "sk-project-key-5678", result.APIKey)
	}
}

func TestResolve_StoredKey(t *testing.T) {
	tmpDir := t.TempDir()
	credData, _ := json.Marshal(struct {
		APIKey string `json:"apiKey"`
	}{APIKey: "sk-stored-key-9012"})
	os.WriteFile(filepath.Join(tmpDir, "credentials.json"), credData, 0600)

	r := &Resolver{
		EnvReader:     func(key string) string { return "" },
		FileReader:    os.ReadFile,
		ConfigFinder:  func(cwd string) string { return "" },
		CredentialDir: tmpDir,
	}

	result := r.Resolve("/some/dir")
	if result.Source != SourceStored {
		t.Errorf("expected source %q, got %q", SourceStored, result.Source)
	}
	if result.APIKey != "sk-stored-key-9012" {
		t.Errorf("expected key %q, got %q", "sk-stored-key-9012", result.APIKey)
	}
}

func TestResolve_NoneWhenAllEmpty(t *testing.T) {
	r := &Resolver{
		EnvReader:     func(key string) string { return "" },
		FileReader:    func(path string) ([]byte, error) { return nil, os.ErrNotExist },
		ConfigFinder:  func(cwd string) string { return "" },
		CredentialDir: t.TempDir(),
	}

	result := r.Resolve("/some/dir")
	if result.Source != SourceNone {
		t.Errorf("expected source %q, got %q", SourceNone, result.Source)
	}
	if result.APIKey != "" {
		t.Errorf("expected empty key, got %q", result.APIKey)
	}
}

func TestResolve_PriorityEnvOverProject(t *testing.T) {
	projectConfig := `{"apiKey": "sk-project-key"}`

	r := &Resolver{
		EnvReader: func(key string) string { return "sk-env-key" },
		FileReader: func(path string) ([]byte, error) {
			if filepath.Base(path) == "sandbase.json" {
				return []byte(projectConfig), nil
			}
			return nil, os.ErrNotExist
		},
		ConfigFinder:  func(cwd string) string { return filepath.Join(cwd, "sandbase.json") },
		CredentialDir: t.TempDir(),
	}

	result := r.Resolve("/project")
	if result.Source != SourceEnv {
		t.Errorf("expected env to take priority, got source %q", result.Source)
	}
}

func TestResolve_PriorityProjectOverStored(t *testing.T) {
	tmpDir := t.TempDir()
	credData, _ := json.Marshal(struct {
		APIKey string `json:"apiKey"`
	}{APIKey: "sk-stored-key"})
	os.WriteFile(filepath.Join(tmpDir, "credentials.json"), credData, 0600)

	projectConfig := `{"apiKey": "sk-project-key"}`

	r := &Resolver{
		EnvReader: func(key string) string { return "" },
		FileReader: func(path string) ([]byte, error) {
			if filepath.Base(path) == "sandbase.json" {
				return []byte(projectConfig), nil
			}
			return os.ReadFile(path)
		},
		ConfigFinder:  func(cwd string) string { return filepath.Join(cwd, "sandbase.json") },
		CredentialDir: tmpDir,
	}

	result := r.Resolve("/project")
	if result.Source != SourceProject {
		t.Errorf("expected project to take priority over stored, got source %q", result.Source)
	}
}

func TestStoreClearRoundtrip(t *testing.T) {
	tmpDir := t.TempDir()
	r := &Resolver{
		EnvReader:     func(key string) string { return "" },
		FileReader:    os.ReadFile,
		ConfigFinder:  func(cwd string) string { return "" },
		CredentialDir: tmpDir,
	}

	// Store
	if err := r.Store("sk-test-roundtrip"); err != nil {
		t.Fatalf("Store failed: %v", err)
	}

	// Verify file permissions
	info, err := os.Stat(filepath.Join(tmpDir, "credentials.json"))
	if err != nil {
		t.Fatalf("credential file not found: %v", err)
	}
	if perm := info.Mode().Perm(); perm != 0600 {
		t.Errorf("expected 0600 permissions, got %o", perm)
	}

	// Resolve should find stored key
	result := r.Resolve("/some/dir")
	if result.Source != SourceStored {
		t.Errorf("expected source %q after Store, got %q", SourceStored, result.Source)
	}
	if result.APIKey != "sk-test-roundtrip" {
		t.Errorf("expected key %q, got %q", "sk-test-roundtrip", result.APIKey)
	}

	// Clear
	if err := r.Clear(); err != nil {
		t.Fatalf("Clear failed: %v", err)
	}

	// Resolve should return SourceNone
	result = r.Resolve("/some/dir")
	if result.Source != SourceNone {
		t.Errorf("expected source %q after Clear, got %q", SourceNone, result.Source)
	}
}

func TestClear_NoopWhenNoFile(t *testing.T) {
	r := &Resolver{
		CredentialDir: t.TempDir(),
	}
	if err := r.Clear(); err != nil {
		t.Errorf("Clear should not error when file doesn't exist, got: %v", err)
	}
}

func TestMaskKey(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"sk-abcdefghijklmnop", "sk-abc****mnop"},
		{"short", "****"},
		{"12345678", "****"},
		{"123456789", "123456****6789"},
		{"sk-xxxxxxxxxxxxxxxxxxxxxxxx", "sk-xxx****xxxx"},
	}

	for _, tt := range tests {
		got := MaskKey(tt.input)
		if got != tt.expected {
			t.Errorf("MaskKey(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestStatus_ReturnsNoneWhenNoKey(t *testing.T) {
	r := &Resolver{
		EnvReader:     func(key string) string { return "" },
		FileReader:    func(path string) ([]byte, error) { return nil, os.ErrNotExist },
		ConfigFinder:  func(cwd string) string { return "" },
		CredentialDir: t.TempDir(),
	}

	masked, source, err := r.Status("/some/dir")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if source != SourceNone {
		t.Errorf("expected SourceNone, got %q", source)
	}
	if masked != "" {
		t.Errorf("expected empty masked key, got %q", masked)
	}
}

func TestStatus_ReturnsMaskedKey(t *testing.T) {
	r := &Resolver{
		EnvReader:     func(key string) string { return "sk-my-secret-key-12345" },
		FileReader:    func(path string) ([]byte, error) { return nil, os.ErrNotExist },
		ConfigFinder:  func(cwd string) string { return "" },
		CredentialDir: t.TempDir(),
	}

	masked, source, err := r.Status("/some/dir")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if source != SourceEnv {
		t.Errorf("expected SourceEnv, got %q", source)
	}
	if masked != "sk-my-****2345" {
		t.Errorf("expected masked key %q, got %q", "sk-my-****2345", masked)
	}
}
