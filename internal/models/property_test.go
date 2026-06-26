package models

import (
	"math/rand"
	"strings"
	"testing"
)

func randStr(rng *rand.Rand, n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rng.Intn(len(letters))]
	}
	return string(b)
}

var typePool = []string{"llm", "image", "video", "audio", "3d"}

func randModelSet(rng *rand.Rand) []Model {
	n := rng.Intn(12) // 0..11
	out := make([]Model, n)
	for i := range out {
		ntags := rng.Intn(3)
		tags := make([]string, ntags)
		for j := range tags {
			tags[j] = randStr(rng, 1+rng.Intn(5))
		}
		out[i] = Model{
			Slug:     randStr(rng, 2+rng.Intn(8)),
			Name:     randStr(rng, 2+rng.Intn(8)),
			Type:     typePool[rng.Intn(len(typePool))],
			Provider: randStr(rng, 2+rng.Intn(6)),
			Tags:     tags,
		}
	}
	return out
}

// Feature: sandbase-cli, Property 18: 模型发现过滤 — For any model set and type filter, all returned models have that type; for any query, all returned models match name/slug/provider/tag.
func TestProperty18_ModelDiscoveryFilter(t *testing.T) {
	rng := rand.New(rand.NewSource(18))

	for iter := 0; iter < 200; iter++ {
		set := randModelSet(rng)

		// --- Type filtering ---
		var typeFilter string
		if rng.Intn(4) != 0 {
			typeFilter = typePool[rng.Intn(len(typePool))]
		} // else empty -> all returned

		byType := FilterByType(set, typeFilter)
		if typeFilter == "" {
			if len(byType) != len(set) {
				t.Fatalf("Property 18 failed: empty type filter changed set size %d -> %d", len(set), len(byType))
			}
		} else {
			for _, m := range byType {
				if m.Type != typeFilter {
					t.Fatalf("Property 18 failed: FilterByType(%q) returned type %q", typeFilter, m.Type)
				}
			}
			// Completeness: every matching model in the set must be present.
			want := 0
			for _, m := range set {
				if m.Type == typeFilter {
					want++
				}
			}
			if len(byType) != want {
				t.Fatalf("Property 18 failed: FilterByType(%q) returned %d want %d", typeFilter, len(byType), want)
			}
		}

		// --- Search ---
		var query string
		switch rng.Intn(3) {
		case 0:
			query = "" // all returned
		case 1:
			// Use a substring likely to match: pick a field from an existing model.
			if len(set) > 0 {
				m := set[rng.Intn(len(set))]
				fields := []string{m.Name, m.Slug, m.Provider}
				if len(m.Tags) > 0 {
					fields = append(fields, m.Tags[rng.Intn(len(m.Tags))])
				}
				f := fields[rng.Intn(len(fields))]
				if len(f) > 0 {
					start := rng.Intn(len(f))
					end := start + 1 + rng.Intn(len(f)-start)
					query = f[start:end]
				}
			}
		default:
			query = randStr(rng, 2+rng.Intn(4)) // arbitrary, may match nothing
		}

		found := Search(set, query)
		if query == "" {
			if len(found) != len(set) {
				t.Fatalf("Property 18 failed: empty query changed set size %d -> %d", len(set), len(found))
			}
		} else {
			q := strings.ToLower(query)
			for _, m := range found {
				if !modelMatchesOracle(m, q) {
					t.Fatalf("Property 18 failed: Search(%q) returned non-matching model %+v", query, m)
				}
			}
			// Completeness: every matching model must be present.
			want := 0
			for _, m := range set {
				if modelMatchesOracle(m, q) {
					want++
				}
			}
			if len(found) != want {
				t.Fatalf("Property 18 failed: Search(%q) returned %d want %d", query, len(found), want)
			}
		}
	}
}

// modelMatchesOracle is an independent re-implementation of the match rule for
// cross-checking the production logic.
func modelMatchesOracle(m Model, q string) bool {
	if strings.Contains(strings.ToLower(m.Name), q) {
		return true
	}
	if strings.Contains(strings.ToLower(m.Slug), q) {
		return true
	}
	if strings.Contains(strings.ToLower(m.Provider), q) {
		return true
	}
	for _, tag := range m.Tags {
		if strings.Contains(strings.ToLower(tag), q) {
			return true
		}
	}
	return false
}
