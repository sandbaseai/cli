package config

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"testing"
	"testing/quick"
)

// randString builds a short random alphanumeric string.
func randString(rng *rand.Rand, n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rng.Intn(len(letters))]
	}
	return string(b)
}

// randAliasMap generates a random alias->slug map.
func randAliasMap(rng *rand.Rand) map[string]string {
	m := make(map[string]string)
	n := rng.Intn(6)
	for i := 0; i < n; i++ {
		m[randString(rng, 1+rng.Intn(6))] = randString(rng, 1+rng.Intn(10))
	}
	return m
}

// randParamMap generates a random string->any map.
func randParamMap(rng *rand.Rand) map[string]any {
	m := make(map[string]any)
	n := rng.Intn(6)
	for i := 0; i < n; i++ {
		m[randString(rng, 1+rng.Intn(6))] = randString(rng, 1+rng.Intn(8))
	}
	return m
}

// Feature: sandbase-cli, Property 3: 别名解析 — For any alias map and any name, if name is a key return its mapped slug, else return name unchanged.
func TestProperty3_AliasResolution(t *testing.T) {
	rng := rand.New(rand.NewSource(3))
	m := &Manager{}

	for iter := 0; iter < 200; iter++ {
		aliases := randAliasMap(rng)
		cfg := &ResolvedConfig{Aliases: aliases}

		// Pick a name: sometimes an existing key, sometimes a random (likely-absent) name.
		var name string
		if len(aliases) > 0 && rng.Intn(2) == 0 {
			// choose an existing key
			keys := make([]string, 0, len(aliases))
			for k := range aliases {
				keys = append(keys, k)
			}
			name = keys[rng.Intn(len(keys))]
		} else {
			name = randString(rng, 1+rng.Intn(8))
		}

		got := m.ResolveAlias(cfg, name)

		if slug, ok := aliases[name]; ok {
			if got != slug {
				t.Fatalf("Property 3 failed: name=%q present, got %q want %q", name, got, slug)
			}
		} else {
			if got != name {
				t.Fatalf("Property 3 failed: name=%q absent, got %q want unchanged", name, got)
			}
		}
	}
}

// Feature: sandbase-cli, Property 4: 参数合并优先级 — For any defaults map and any CLI params map, the merged result's key set equals the union, and for each key: CLI value if provided, else default value.
func TestProperty4_ParamMergePriority(t *testing.T) {
	rng := rand.New(rand.NewSource(4))
	m := &Manager{}
	const slug = "vendor/model"

	for iter := 0; iter < 200; iter++ {
		defaults := randParamMap(rng)
		cliParams := randParamMap(rng)

		// Inject some overlapping keys to exercise the precedence rule.
		if len(defaults) > 0 && rng.Intn(2) == 0 {
			for k := range defaults {
				cliParams[k] = "cli-" + randString(rng, 4)
				break
			}
		}

		cfg := &ResolvedConfig{
			Defaults: map[string]map[string]any{slug: defaults},
		}

		got := m.MergeParams(cfg, slug, cliParams)

		// Key set must equal the union.
		union := make(map[string]struct{})
		for k := range defaults {
			union[k] = struct{}{}
		}
		for k := range cliParams {
			union[k] = struct{}{}
		}
		if len(got) != len(union) {
			t.Fatalf("Property 4 failed: result has %d keys, union has %d", len(got), len(union))
		}
		for k := range union {
			if _, ok := got[k]; !ok {
				t.Fatalf("Property 4 failed: key %q missing from result", k)
			}
		}

		// Per-key value: CLI wins if provided, else default.
		for k := range union {
			var want any
			if v, ok := cliParams[k]; ok {
				want = v
			} else {
				want = defaults[k]
			}
			if got[k] != want {
				t.Fatalf("Property 4 failed: key %q got %v want %v", k, got[k], want)
			}
		}
	}
}

// Feature: sandbase-cli, Property 5: 最近祖先配置查找 — For any directory nesting with sandbase.json placed at various ancestor levels, Load/findProjectConfig selects the nearest (deepest) one.
func TestProperty5_NearestAncestorConfig(t *testing.T) {
	prop := func(depth uint8, placement uint32) bool {
		// Build a nested directory chain of length 1..8 under a temp root.
		levels := int(depth%8) + 1
		base := t.TempDir()

		dirs := make([]string, levels) // dirs[0] = shallowest, dirs[levels-1] = deepest (cwd)
		cur := base
		for i := 0; i < levels; i++ {
			cur = filepath.Join(cur, fmt.Sprintf("d%d", i))
			if err := os.MkdirAll(cur, 0700); err != nil {
				t.Logf("mkdir failed: %v", err)
				return false
			}
			dirs[i] = cur
		}

		// Decide which levels get a sandbase.json based on placement bits.
		placed := make([]bool, levels)
		anyPlaced := false
		for i := 0; i < levels; i++ {
			if placement&(1<<uint(i)) != 0 {
				placed[i] = true
				anyPlaced = true
				content := map[string]string{"defaultChatModel": fmt.Sprintf("model-level-%d", i)}
				b, _ := json.Marshal(content)
				if err := os.WriteFile(filepath.Join(dirs[i], projectConfigFile), b, 0600); err != nil {
					t.Logf("write failed: %v", err)
					return false
				}
			}
		}

		cwd := dirs[levels-1]

		// Expected nearest: deepest placed level (largest index).
		expectedIdx := -1
		for i := levels - 1; i >= 0; i-- {
			if placed[i] {
				expectedIdx = i
				break
			}
		}

		// findProjectConfig should return the nearest sandbase.json path.
		gotPath := findProjectConfig(cwd)
		if !anyPlaced {
			return gotPath == ""
		}
		expectedPath := filepath.Join(dirs[expectedIdx], projectConfigFile)
		if gotPath != expectedPath {
			t.Logf("Property 5: findProjectConfig got %q want %q", gotPath, expectedPath)
			return false
		}

		// Load must reflect the nearest config's contents.
		m := &Manager{
			GlobalDir:   filepath.Join(base, "no-such-global"),
			FindProject: findProjectConfig,
			FileReader:  os.ReadFile,
			FileWriter:  os.WriteFile,
			MkdirAll:    os.MkdirAll,
		}
		cfg, err := m.Load(cwd)
		if err != nil {
			t.Logf("Load failed: %v", err)
			return false
		}
		return cfg.DefaultChatModel == fmt.Sprintf("model-level-%d", expectedIdx)
	}

	if err := quick.Check(prop, &quick.Config{MaxCount: 100}); err != nil {
		t.Fatalf("Property 5 failed: %v", err)
	}
}
