package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const (
	globalConfigFile  = "config.json"
	projectConfigFile = "sandbase.json"
	defaultBaseURL    = "https://api.sandbase.ai"
)

// ResolvedConfig holds the merged configuration from all sources.
type ResolvedConfig struct {
	BaseURL            string
	DefaultChatModel   string
	DefaultDownloadDir string
	Aliases            map[string]string
	Defaults           map[string]map[string]any
	APIKey             string
}

// globalConfig represents the schema of ~/.config/sandbase/config.json.
type globalConfig struct {
	BaseURL            string `json:"baseUrl,omitempty"`
	DefaultChatModel   string `json:"defaultChatModel,omitempty"`
	DefaultDownloadDir string `json:"defaultDownloadDir,omitempty"`
	Telemetry          *bool  `json:"telemetry,omitempty"`
}

// projectConfig represents the schema of sandbase.json.
type projectConfig struct {
	APIKey           string                    `json:"apiKey,omitempty"`
	DefaultChatModel string                    `json:"defaultChatModel,omitempty"`
	Aliases          map[string]string         `json:"aliases,omitempty"`
	Defaults         map[string]map[string]any `json:"defaults,omitempty"`
}

// Manager handles configuration loading, merging, and persistence.
// IO operations are abstracted via function fields for testability.
type Manager struct {
	GlobalDir   string                                        // ~/.config/sandbase
	FindProject func(cwd string) string                      // walks up to find sandbase.json
	FileReader  func(path string) ([]byte, error)            // defaults to os.ReadFile
	FileWriter  func(path string, data []byte, perm os.FileMode) error // defaults to os.WriteFile
	MkdirAll    func(path string, perm os.FileMode) error    // defaults to os.MkdirAll
}

// NewManager creates a Manager with production defaults.
func NewManager() *Manager {
	homeDir, _ := os.UserHomeDir()
	return &Manager{
		GlobalDir:   filepath.Join(homeDir, ".config", "sandbase"),
		FindProject: findProjectConfig,
		FileReader:  os.ReadFile,
		FileWriter:  os.WriteFile,
		MkdirAll:    os.MkdirAll,
	}
}

// Load reads and merges global config + project config for the given working directory.
// Priority (high to low): project config > global config > built-in defaults.
// CLI params are merged later via MergeParams.
func (m *Manager) Load(cwd string) (*ResolvedConfig, error) {
	cfg := &ResolvedConfig{
		BaseURL:  defaultBaseURL,
		Aliases:  make(map[string]string),
		Defaults: make(map[string]map[string]any),
	}

	// Load global config
	globalPath := filepath.Join(m.GlobalDir, globalConfigFile)
	if data, err := m.FileReader(globalPath); err == nil {
		var gc globalConfig
		if json.Unmarshal(data, &gc) == nil {
			if gc.BaseURL != "" {
				cfg.BaseURL = gc.BaseURL
			}
			if gc.DefaultChatModel != "" {
				cfg.DefaultChatModel = gc.DefaultChatModel
			}
			if gc.DefaultDownloadDir != "" {
				cfg.DefaultDownloadDir = gc.DefaultDownloadDir
			}
		}
	}

	// Load project config (overrides global where set)
	if projectPath := m.FindProject(cwd); projectPath != "" {
		if data, err := m.FileReader(projectPath); err == nil {
			var pc projectConfig
			if json.Unmarshal(data, &pc) == nil {
				if pc.APIKey != "" {
					cfg.APIKey = pc.APIKey
				}
				if pc.DefaultChatModel != "" {
					cfg.DefaultChatModel = pc.DefaultChatModel
				}
				if pc.Aliases != nil {
					for k, v := range pc.Aliases {
						cfg.Aliases[k] = v
					}
				}
				if pc.Defaults != nil {
					for k, v := range pc.Defaults {
						cfg.Defaults[k] = v
					}
				}
			}
		}
	}

	// Environment variable overrides for baseUrl
	if envURL := os.Getenv("SANDBASE_BASE_URL"); envURL != "" {
		cfg.BaseURL = envURL
	}

	return cfg, nil
}

// ResolveAlias maps an alias name to its full slug.
// If the name exists as a key in cfg.Aliases, the mapped slug is returned.
// Otherwise the original name is returned unchanged.
func (m *Manager) ResolveAlias(cfg *ResolvedConfig, name string) string {
	if cfg.Aliases == nil {
		return name
	}
	if slug, ok := cfg.Aliases[name]; ok {
		return slug
	}
	return name
}

// MergeParams merges parameters with priority: cliParams > project defaults > (future: global defaults).
// The result contains all keys from both sources, with CLI params taking precedence.
func (m *Manager) MergeParams(cfg *ResolvedConfig, slug string, cliParams map[string]any) map[string]any {
	result := make(map[string]any)

	// Start with project defaults for this slug
	if cfg.Defaults != nil {
		if defaults, ok := cfg.Defaults[slug]; ok {
			for k, v := range defaults {
				result[k] = v
			}
		}
	}

	// CLI params override defaults
	if cliParams != nil {
		for k, v := range cliParams {
			result[k] = v
		}
	}

	return result
}

// SetGlobal writes a key-value pair to the global config file.
func (m *Manager) SetGlobal(key, value string) error {
	globalPath := filepath.Join(m.GlobalDir, globalConfigFile)

	// Read existing config
	raw := make(map[string]any)
	if data, err := m.FileReader(globalPath); err == nil {
		_ = json.Unmarshal(data, &raw)
	}

	// Set value (handle booleans stored as strings)
	switch value {
	case "true":
		raw[key] = true
	case "false":
		raw[key] = false
	default:
		raw[key] = value
	}

	data, err := json.MarshalIndent(raw, "", "  ")
	if err != nil {
		return err
	}

	if err := m.MkdirAll(m.GlobalDir, 0700); err != nil {
		return err
	}

	return m.FileWriter(globalPath, data, 0644)
}

// GetGlobal reads a key from the global config file.
// Returns empty string and nil error if the key doesn't exist.
func (m *Manager) GetGlobal(key string) (string, error) {
	globalPath := filepath.Join(m.GlobalDir, globalConfigFile)

	data, err := m.FileReader(globalPath)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}

	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		return "", err
	}

	val, ok := raw[key]
	if !ok {
		return "", nil
	}

	// Convert value to string representation
	switch v := val.(type) {
	case string:
		return v, nil
	case bool:
		if v {
			return "true", nil
		}
		return "false", nil
	case float64:
		return json.Number(json.Number(formatFloat(v))).String(), nil
	default:
		b, _ := json.Marshal(v)
		return string(b), nil
	}
}

// findProjectConfig walks up from cwd looking for sandbase.json.
func findProjectConfig(cwd string) string {
	dir := cwd
	for {
		candidate := filepath.Join(dir, projectConfigFile)
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return ""
}

// formatFloat formats a float64 without trailing zeros.
func formatFloat(f float64) string {
	// If it's a whole number, format without decimal
	if f == float64(int64(f)) {
		return fmt.Sprintf("%d", int64(f))
	}
	return fmt.Sprintf("%g", f)
}
