package schema

import (
	"fmt"
	"math/rand"
	"strings"
	"testing"
)

// randString builds a short random alphanumeric identifier.
func randString(rng *rand.Rand, n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rng.Intn(len(letters))]
	}
	return string(b)
}

// randSchema builds a random UnifiedSchema with unique param names.
func randSchema(rng *rand.Rand) *UnifiedSchema {
	kinds := []ModelKind{KindLLM, KindImage, KindVideo, KindAudio, Kind3D}
	types := []string{"string", "number", "boolean", "integer", "file", "enum"}

	nparams := rng.Intn(8) // 0..7
	used := make(map[string]bool)
	params := make([]SchemaParam, 0, nparams)
	for i := 0; i < nparams; i++ {
		name := fmt.Sprintf("p%d_%s", i, randString(rng, 1+rng.Intn(4)))
		if used[name] {
			continue
		}
		used[name] = true
		p := SchemaParam{
			Name:        name,
			Type:        types[rng.Intn(len(types))],
			Required:    rng.Intn(2) == 0,
			Description: "desc-" + randString(rng, 3+rng.Intn(8)),
		}
		// Sometimes attach a default value.
		if rng.Intn(2) == 0 {
			p.Default = randString(rng, 1+rng.Intn(5))
		}
		params = append(params, p)
	}

	return &UnifiedSchema{
		Slug:       "vendor/" + randString(rng, 5),
		Kind:       kinds[rng.Intn(len(kinds))],
		Parameters: params,
	}
}

// Feature: sandbase-cli, Property 15: Schema 参数校验 — For any schema and any subset of user params, Validate's reported missing set equals exactly {required params not provided}.
func TestProperty15_SchemaValidation(t *testing.T) {
	rng := rand.New(rand.NewSource(15))
	svc := &SchemaService{}

	for iter := 0; iter < 200; iter++ {
		sch := randSchema(rng)

		// Build a random subset of params the user provides.
		provided := make(map[string]any)
		for _, p := range sch.Parameters {
			if rng.Intn(2) == 0 {
				provided[p.Name] = "value-" + randString(rng, 3)
			}
		}
		// Occasionally include extra params not in the schema (should be ignored).
		for i := 0; i < rng.Intn(3); i++ {
			provided["extra_"+randString(rng, 4)] = 1
		}

		result := svc.Validate(sch, provided)

		// Oracle: required params not present in provided.
		wantMissing := make(map[string]bool)
		for _, p := range sch.Parameters {
			if p.Required {
				if _, ok := provided[p.Name]; !ok {
					wantMissing[p.Name] = true
				}
			}
		}

		gotMissing := make(map[string]bool)
		for _, m := range result.Missing {
			gotMissing[m] = true
		}

		if len(gotMissing) != len(wantMissing) {
			t.Fatalf("Property 15 failed: got missing %v want %v", result.Missing, keys(wantMissing))
		}
		for k := range wantMissing {
			if !gotMissing[k] {
				t.Fatalf("Property 15 failed: missing set lacks %q (got %v)", k, result.Missing)
			}
		}
		// Valid flag must be consistent with the missing set.
		if result.Valid != (len(wantMissing) == 0) {
			t.Fatalf("Property 15 failed: Valid=%v but %d required missing", result.Valid, len(wantMissing))
		}
	}
}

func keys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

// Feature: sandbase-cli, Property 16: 动态帮助完整性 — For any schema, ToHelpText output contains every parameter's name, type, description, and default value.
func TestProperty16_HelpTextCompleteness(t *testing.T) {
	rng := rand.New(rand.NewSource(16))
	svc := &SchemaService{}

	for iter := 0; iter < 200; iter++ {
		sch := randSchema(rng)
		help := svc.ToHelpText(sch)

		for _, p := range sch.Parameters {
			if !strings.Contains(help, p.Name) {
				t.Fatalf("Property 16 failed: help missing param name %q\n%s", p.Name, help)
			}
			if !strings.Contains(help, p.Type) {
				t.Fatalf("Property 16 failed: help missing type %q for %q\n%s", p.Type, p.Name, help)
			}
			if p.Description != "" && !strings.Contains(help, p.Description) {
				t.Fatalf("Property 16 failed: help missing description %q for %q\n%s", p.Description, p.Name, help)
			}
			if p.Default != nil {
				defStr := fmt.Sprintf("%v", p.Default)
				if !strings.Contains(help, defStr) {
					t.Fatalf("Property 16 failed: help missing default %q for %q\n%s", defStr, p.Name, help)
				}
			}
		}
	}
}

// Feature: sandbase-cli, Property 17: 模型类型守卫 — For any schema, the guard accepts `run` iff kind != llm, and `chat` iff kind == llm.
func TestProperty17_ModelTypeGuard(t *testing.T) {
	rng := rand.New(rand.NewSource(17))

	for iter := 0; iter < 200; iter++ {
		sch := randSchema(rng)
		k := sch.Kind

		isLLM := k == KindLLM

		// run is accepted iff kind != llm.
		if IsRunnable(k) != !isLLM {
			t.Fatalf("Property 17 failed: kind=%q IsRunnable=%v want %v", k, IsRunnable(k), !isLLM)
		}
		// chat is accepted iff kind == llm.
		if IsChattable(k) != isLLM {
			t.Fatalf("Property 17 failed: kind=%q IsChattable=%v want %v", k, IsChattable(k), isLLM)
		}
		// IsLLM helper consistency.
		if IsLLM(k) != isLLM {
			t.Fatalf("Property 17 failed: kind=%q IsLLM=%v want %v", k, IsLLM(k), isLLM)
		}
		// A model is never both runnable and chattable, and always exactly one.
		if IsRunnable(k) == IsChattable(k) {
			t.Fatalf("Property 17 failed: kind=%q runnable and chattable must be mutually exclusive", k)
		}
	}
}
