package auth

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"testing/quick"
)

// Feature: sandbase-cli, Property 1: 认证解析优先级 — For any combination of presence/absence of 3 sources (env, project, stored) and any key values, Resolve() returns the key from the highest-priority present source (env > project > stored); returns SourceNone when all absent.
func TestProperty1_AuthResolutionPriority(t *testing.T) {
	// A source only "counts" if it is present AND carries a non-empty key,
	// because Resolve treats empty keys as absent.
	prop := func(envPresent, projPresent, storedPresent bool, envKey, projKey, storedKey string) bool {
		credDir := "/cred-dir"
		credPath := filepath.Join(credDir, "credentials.json")
		const projPath = "/project/sandbase.json"

		r := &Resolver{
			CredentialDir: credDir,
			EnvReader: func(key string) string {
				if key == "SANDBASE_API_KEY" && envPresent {
					return envKey
				}
				return ""
			},
			ConfigFinder: func(cwd string) string {
				if projPresent {
					return projPath
				}
				return ""
			},
			FileReader: func(path string) ([]byte, error) {
				switch path {
				case projPath:
					if projPresent {
						b, _ := json.Marshal(map[string]string{"apiKey": projKey})
						return b, nil
					}
				case credPath:
					if storedPresent {
						b, _ := json.Marshal(map[string]string{"apiKey": storedKey})
						return b, nil
					}
				}
				return nil, os.ErrNotExist
			},
		}

		got := r.Resolve("/some/cwd")

		// Compute the expected result mirroring the priority rules.
		var wantKey string
		var wantSource AuthSource
		switch {
		case envPresent && envKey != "":
			wantKey, wantSource = envKey, SourceEnv
		case projPresent && projKey != "":
			wantKey, wantSource = projKey, SourceProject
		case storedPresent && storedKey != "":
			wantKey, wantSource = storedKey, SourceStored
		default:
			wantKey, wantSource = "", SourceNone
		}

		return got.Source == wantSource && got.APIKey == wantKey
	}

	if err := quick.Check(prop, &quick.Config{MaxCount: 200}); err != nil {
		t.Fatalf("Property 1 failed: %v", err)
	}
}

// Feature: sandbase-cli, Property 2: 凭证存储往返 — For any API key, with env and project empty, Store(key) then Resolve() returns that key with source=stored; Clear() then Resolve() returns SourceNone.
func TestProperty2_CredentialStoreRoundTrip(t *testing.T) {
	prop := func(rawKey string) bool {
		// Store treats empty keys as "absent" on resolve, so the round-trip
		// property is defined for non-empty keys.
		key := rawKey
		if key == "" {
			key = "x"
		}

		dir := t.TempDir()
		r := &Resolver{
			CredentialDir: dir,
			EnvReader:     func(string) string { return "" },
			ConfigFinder:  func(string) string { return "" },
			FileReader:    os.ReadFile,
		}

		if err := r.Store(key); err != nil {
			t.Logf("Store failed: %v", err)
			return false
		}
		afterStore := r.Resolve("/irrelevant")
		if afterStore.Source != SourceStored || afterStore.APIKey != key {
			t.Logf("after Store: got source=%q key=%q want source=stored key=%q", afterStore.Source, afterStore.APIKey, key)
			return false
		}

		if err := r.Clear(); err != nil {
			t.Logf("Clear failed: %v", err)
			return false
		}
		afterClear := r.Resolve("/irrelevant")
		return afterClear.Source == SourceNone
	}

	if err := quick.Check(prop, &quick.Config{MaxCount: 100}); err != nil {
		t.Fatalf("Property 2 failed: %v", err)
	}
}
