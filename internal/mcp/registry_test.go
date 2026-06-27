package mcp

import (
	"context"
	"math/rand"
	"testing"
	"testing/quick"
)

// --- Test helpers ---

// allTestToolDefs returns a deterministic set of tool definitions covering
// all toolsets, with a mix of read-only and write operations.
func allTestToolDefs() []ToolDef {
	defs := []ToolDef{}
	for i, ts := range AllToolsets {
		// Two tools per toolset: one read-only, one write
		defs = append(defs, ToolDef{
			Name:     "sandbase_" + string(ts) + "_read",
			Toolset:  ts,
			ReadOnly: true,
			Handler:  noopHandler,
		})
		// Make some toolsets have only reads (no write tool) to vary
		if i%3 != 2 {
			defs = append(defs, ToolDef{
				Name:     "sandbase_" + string(ts) + "_write",
				Toolset:  ts,
				ReadOnly: false,
				Handler:  noopHandler,
			})
		}
	}
	return defs
}

func noopHandler(_ context.Context, _ map[string]any) (*ToolResult, error) {
	return TextResult("ok"), nil
}

func randomToolsetSubset(rng *rand.Rand) []Toolset {
	n := rng.Intn(len(AllToolsets) + 1) // 0 to len (0 means none selected)
	perm := rng.Perm(len(AllToolsets))
	result := make([]Toolset, n)
	for i := 0; i < n; i++ {
		result[i] = AllToolsets[perm[i]]
	}
	return result
}

// Feature: cli-mcp-server, Property 1: Toolset 过滤完备性
// For any subset S of toolsets and any registered tool T, ListTools() returns T
// iff T.Toolset ∈ S and (readOnly=false or T.ReadOnly=true).
func TestProperty1_ToolsetFiltering(t *testing.T) {
	rng := rand.New(rand.NewSource(1))
	defs := allTestToolDefs()

	for iter := 0; iter < 200; iter++ {
		subset := randomToolsetSubset(rng)
		readOnly := rng.Intn(2) == 1

		r := NewRegistry(subset, readOnly)
		for _, d := range defs {
			r.Register(d)
		}

		enabledSet := make(map[Toolset]bool)
		for _, ts := range subset {
			enabledSet[ts] = true
		}
		// If subset is empty, NewRegistry enables ALL
		if len(subset) == 0 {
			for _, ts := range AllToolsets {
				enabledSet[ts] = true
			}
		}

		listed := r.ListTools()
		listedNames := make(map[string]bool)
		for _, d := range listed {
			listedNames[d.Name] = true
		}

		for _, d := range defs {
			shouldBeEnabled := enabledSet[d.Toolset] && (!readOnly || d.ReadOnly)
			if shouldBeEnabled && !listedNames[d.Name] {
				t.Fatalf("iter %d: tool %q should be listed (toolset=%s, readOnly=%v, toolReadOnly=%v) but wasn't",
					iter, d.Name, d.Toolset, readOnly, d.ReadOnly)
			}
			if !shouldBeEnabled && listedNames[d.Name] {
				t.Fatalf("iter %d: tool %q should NOT be listed but was",
					iter, d.Name)
			}
		}
	}
}

// Feature: cli-mcp-server, Property 2: Read-Only 安全性
// When readOnly=true, ListTools() never contains any tool with ReadOnly=false.
func TestProperty2_ReadOnlySafety(t *testing.T) {
	rng := rand.New(rand.NewSource(2))
	defs := allTestToolDefs()

	for iter := 0; iter < 200; iter++ {
		subset := randomToolsetSubset(rng)
		r := NewRegistry(subset, true) // always read-only
		for _, d := range defs {
			r.Register(d)
		}

		for _, tool := range r.ListTools() {
			if !tool.ReadOnly {
				t.Fatalf("iter %d: read-only registry exposed write tool %q", iter, tool.Name)
			}
		}
	}
}

// Feature: cli-mcp-server, Property 4: Dispatch 封闭性
// Dispatch(N) succeeds iff N is in ListTools() result.
func TestProperty4_DispatchClosedness(t *testing.T) {
	rng := rand.New(rand.NewSource(4))
	defs := allTestToolDefs()

	for iter := 0; iter < 200; iter++ {
		subset := randomToolsetSubset(rng)
		readOnly := rng.Intn(2) == 1
		r := NewRegistry(subset, readOnly)
		for _, d := range defs {
			r.Register(d)
		}

		listed := r.ListTools()
		listedNames := make(map[string]bool)
		for _, d := range listed {
			listedNames[d.Name] = true
		}

		// Test all registered tool names + some random nonexistent ones
		testNames := []string{"nonexistent_tool_xyz", "sandbase_fake"}
		for _, d := range defs {
			testNames = append(testNames, d.Name)
		}

		for _, name := range testNames {
			result, err := r.Dispatch(context.Background(), name, nil)
			if listedNames[name] {
				// Should succeed
				if err != nil {
					t.Fatalf("iter %d: Dispatch(%q) failed but tool is in ListTools: %v", iter, name, err)
				}
				if result == nil {
					t.Fatalf("iter %d: Dispatch(%q) returned nil result", iter, name)
				}
			} else {
				// Should fail
				if err == nil {
					t.Fatalf("iter %d: Dispatch(%q) succeeded but tool is NOT in ListTools", iter, name)
				}
			}
		}
	}
}

// Feature: cli-mcp-server, Property 10: 空 Toolset 默认全部
// When Toolsets is nil or empty, all toolsets are enabled (equivalent to AllToolsets).
func TestProperty10_EmptyToolsetsDefault(t *testing.T) {
	defs := allTestToolDefs()

	prop := func(useNil bool) bool {
		var toolsets []Toolset
		if !useNil {
			toolsets = []Toolset{} // empty slice, not nil
		}
		r := NewRegistry(toolsets, false)
		for _, d := range defs {
			r.Register(d)
		}
		// All tools should be enabled
		listed := r.ListTools()
		return len(listed) == len(defs)
	}

	if err := quick.Check(prop, &quick.Config{MaxCount: 50}); err != nil {
		t.Fatalf("Property 10 failed: %v", err)
	}
}

// Feature: cli-mcp-server, Property 3: Tool 名称唯一性
// Registering a tool with the same name overwrites the previous one.
// ListTools never contains duplicates.
func TestProperty3_ToolNameUniqueness(t *testing.T) {
	r := NewRegistry(nil, false)

	// Register same name twice with different descriptions
	r.Register(ToolDef{Name: "sandbase_test", Toolset: ToolsetModels, ReadOnly: true, Handler: noopHandler, Description: "first"})
	r.Register(ToolDef{Name: "sandbase_test", Toolset: ToolsetModels, ReadOnly: true, Handler: noopHandler, Description: "second"})

	listed := r.ListTools()
	count := 0
	for _, d := range listed {
		if d.Name == "sandbase_test" {
			count++
			if d.Description != "second" {
				t.Fatalf("expected overwritten description 'second', got %q", d.Description)
			}
		}
	}
	if count != 1 {
		t.Fatalf("expected exactly 1 tool named 'sandbase_test', got %d", count)
	}
}

// Feature: cli-mcp-server, Property 5: Tool Handler 错误不泄露
// When a handler returns a Go error, Dispatch converts it to ToolResult{IsError: true},
// not a raw Go error.
func TestProperty5_HandlerErrorConversion(t *testing.T) {
	errHandler := func(_ context.Context, _ map[string]any) (*ToolResult, error) {
		return nil, context.DeadlineExceeded // simulate Go error
	}

	r := NewRegistry(nil, false)
	r.Register(ToolDef{Name: "sandbase_err_test", Toolset: ToolsetModels, ReadOnly: true, Handler: errHandler})

	result, err := r.Dispatch(context.Background(), "sandbase_err_test", nil)
	if err != nil {
		t.Fatalf("Dispatch should not return Go error; got: %v", err)
	}
	if result == nil || !result.IsError {
		t.Fatal("expected IsError=true result")
	}
	if len(result.Content) == 0 || result.Content[0].Text == "" {
		t.Fatal("expected error message in content")
	}
}

// Feature: cli-mcp-server, Property 6: 必填参数校验
// RequireString returns an error result when the key is missing or empty.
func TestProperty6_RequiredParamValidation(t *testing.T) {
	rng := rand.New(rand.NewSource(6))

	// Generate random required keys and random param maps
	keys := []string{"model", "session_id", "agent_id", "env_id", "skill_id", "file_path", "job_id", "prompt"}

	for iter := 0; iter < 100; iter++ {
		key := keys[rng.Intn(len(keys))]
		params := make(map[string]any)

		// Randomly decide: missing, nil, empty string, or present
		choice := rng.Intn(4)
		switch choice {
		case 0: // key missing entirely
		case 1:
			params[key] = nil
		case 2:
			params[key] = ""
		case 3:
			params[key] = "valid-value-" + key
		}

		val, errResult := RequireString(params, key)
		if choice == 3 {
			// Should succeed
			if errResult != nil {
				t.Fatalf("iter %d: RequireString(%q) failed for present key", iter, key)
			}
			if val != "valid-value-"+key {
				t.Fatalf("iter %d: got %q want %q", iter, val, "valid-value-"+key)
			}
		} else {
			// Should fail
			if errResult == nil {
				t.Fatalf("iter %d: RequireString(%q) should have failed (choice=%d)", iter, key, choice)
			}
			if !errResult.IsError {
				t.Fatalf("iter %d: error result should have IsError=true", iter)
			}
		}
	}
}
