package auth

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// AuthSource identifies where an API key was resolved from.
type AuthSource string

const (
	SourceEnv     AuthSource = "env"
	SourceProject AuthSource = "project"
	SourceStored  AuthSource = "stored"
	SourceNone    AuthSource = "none"
)

// ResolvedAuth holds a resolved API key and its source.
type ResolvedAuth struct {
	APIKey string
	Source AuthSource
}

// Resolver resolves authentication credentials from multiple sources.
// IO operations are abstracted via function fields for testability.
type Resolver struct {
	EnvReader     func(key string) string            // defaults to os.Getenv
	FileReader    func(path string) ([]byte, error)  // defaults to os.ReadFile
	ConfigFinder  func(cwd string) string            // finds nearest sandbase.json
	CredentialDir string                             // defaults to ~/.config/sandbase
}

// NewResolver creates a Resolver with production defaults.
func NewResolver() *Resolver {
	homeDir, _ := os.UserHomeDir()
	return &Resolver{
		EnvReader:     os.Getenv,
		FileReader:    os.ReadFile,
		ConfigFinder:  findProjectConfig,
		CredentialDir: filepath.Join(homeDir, ".config", "sandbase"),
	}
}

// Resolve returns the API key from the highest-priority available source.
// Priority: env var (SANDBASE_API_KEY) > project config (sandbase.json apiKey) > stored credentials.
func (r *Resolver) Resolve(cwd string) ResolvedAuth {
	// 1. Environment variable
	if key := r.EnvReader("SANDBASE_API_KEY"); key != "" {
		return ResolvedAuth{APIKey: key, Source: SourceEnv}
	}

	// 2. Project config (sandbase.json)
	if configPath := r.ConfigFinder(cwd); configPath != "" {
		if data, err := r.FileReader(configPath); err == nil {
			var cfg struct {
				APIKey string `json:"apiKey"`
			}
			if json.Unmarshal(data, &cfg) == nil && cfg.APIKey != "" {
				return ResolvedAuth{APIKey: cfg.APIKey, Source: SourceProject}
			}
		}
	}

	// 3. Stored credentials
	credPath := filepath.Join(r.CredentialDir, "credentials.json")
	if data, err := r.FileReader(credPath); err == nil {
		var cred struct {
			APIKey string `json:"apiKey"`
		}
		if json.Unmarshal(data, &cred) == nil && cred.APIKey != "" {
			return ResolvedAuth{APIKey: cred.APIKey, Source: SourceStored}
		}
	}

	return ResolvedAuth{Source: SourceNone}
}

// Store saves the API key to ~/.config/sandbase/credentials.json with 0600 permissions.
func (r *Resolver) Store(apiKey string) error {
	if err := os.MkdirAll(r.CredentialDir, 0700); err != nil {
		return err
	}
	cred := struct {
		APIKey   string `json:"apiKey"`
		StoredAt string `json:"storedAt"`
	}{
		APIKey:   apiKey,
		StoredAt: time.Now().UTC().Format(time.RFC3339),
	}
	data, err := json.MarshalIndent(cred, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(r.CredentialDir, "credentials.json"), data, 0600)
}

// Clear removes stored credentials.
func (r *Resolver) Clear() error {
	path := filepath.Join(r.CredentialDir, "credentials.json")
	err := os.Remove(path)
	if os.IsNotExist(err) {
		return nil // already cleared
	}
	return err
}

// Status checks whether the current resolved key is valid.
// This is a placeholder that returns basic info since ApiClient isn't built yet.
func (r *Resolver) Status(cwd string) (string, AuthSource, error) {
	resolved := r.Resolve(cwd)
	if resolved.Source == SourceNone {
		return "", SourceNone, nil
	}
	return MaskKey(resolved.APIKey), resolved.Source, nil
}

// MaskKey returns a masked version of the API key for display (e.g., "sk-****abcd").
func MaskKey(key string) string {
	if len(key) <= 8 {
		return "****"
	}
	return key[:6] + "****" + key[len(key)-4:]
}

// findProjectConfig walks up from cwd looking for sandbase.json.
func findProjectConfig(cwd string) string {
	dir := cwd
	for {
		candidate := filepath.Join(dir, "sandbase.json")
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
