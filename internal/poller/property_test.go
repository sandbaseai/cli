package poller

import (
	"context"
	"encoding/json"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"testing/quick"
	"time"

	"github.com/sandbaseai/cli/internal/client"
)

// Feature: sandbase-cli, Property 10: 指数退避边界 — For any attempt n>=0, BackoffDelay(n) == min(1000*2^n, 10000) ms, always within [1000,10000], and monotonically non-decreasing in n.
func TestProperty10_BackoffBounds(t *testing.T) {
	const (
		minDelay = 1000 * time.Millisecond
		maxDelay = 10000 * time.Millisecond
	)

	// quick.Check generates arbitrary attempt values; constrain to n>=0.
	prop := func(raw uint16) bool {
		// Cap to a sane range; uint16 keeps shift safe and covers the cap plateau.
		n := int(raw % 64)

		got := BackoffDelay(n)

		// Exact formula: min(1000 * 2^n, 10000) ms, computed overflow-safely.
		want := maxDelay
		if n < 4 {
			want = time.Duration(1000*(1<<uint(n))) * time.Millisecond
			if want > maxDelay {
				want = maxDelay
			}
		}
		if got != want {
			t.Logf("BackoffDelay(%d) = %v, want %v", n, got, want)
			return false
		}

		// Bounds invariant.
		if got < minDelay || got > maxDelay {
			t.Logf("BackoffDelay(%d) = %v out of [%v,%v]", n, got, minDelay, maxDelay)
			return false
		}

		// Monotonic non-decreasing: BackoffDelay(n) <= BackoffDelay(n+1).
		next := BackoffDelay(n + 1)
		if next < got {
			t.Logf("monotonicity broken: BackoffDelay(%d)=%v > BackoffDelay(%d)=%v", n, got, n+1, next)
			return false
		}
		return true
	}

	if err := quick.Check(prop, &quick.Config{MaxCount: 200}); err != nil {
		t.Fatalf("Property 10 failed: %v", err)
	}
}

// randStatusSequence builds a status sequence that ends in a terminal state.
// The prefix consists of non-terminal statuses; the final element is terminal.
func randStatusSequence(rng *rand.Rand) []string {
	nonTerminal := []string{"queued", "processing"}
	terminal := []string{"completed", "failed"}

	prefixLen := rng.Intn(6) // 0..5 non-terminal statuses
	seq := make([]string, 0, prefixLen+1)
	for i := 0; i < prefixLen; i++ {
		seq = append(seq, nonTerminal[rng.Intn(len(nonTerminal))])
	}
	seq = append(seq, terminal[rng.Intn(len(terminal))])
	return seq
}

// Feature: sandbase-cli, Property 11: 轮询至终态 — For any status sequence ending in a terminal state, Poll stops at the first terminal state, returns it, and makes no further requests.
func TestProperty11_PollStopsAtFirstTerminal(t *testing.T) {
	rng := rand.New(rand.NewSource(11))

	for iter := 0; iter < 100; iter++ {
		seq := randStatusSequence(rng)

		// firstTerminalIdx is the index of the first terminal status in the sequence.
		firstTerminalIdx := -1
		for i, s := range seq {
			if IsTerminal(s) {
				firstTerminalIdx = i
				break
			}
		}
		// By construction the last element is terminal, so this is always set.
		expectedRequests := int32(firstTerminalIdx + 1)
		expectedStatus := seq[firstTerminalIdx]

		var requestCount int32
		var idx int32 = -1
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			atomic.AddInt32(&requestCount, 1)
			i := atomic.AddInt32(&idx, 1)
			// Serve the generated status for this request index, clamped to last.
			si := int(i)
			if si >= len(seq) {
				si = len(seq) - 1
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(JobResult{ID: "job-prop11", Status: seq[si]})
		}))

		apiClient := client.New(server.URL, "test-key", 30, false)
		p := New(apiClient)
		// Zero delay keeps 100 iterations fast.
		p.Delay = func(attempt int) time.Duration { return 0 }

		result, err := p.Poll(context.Background(), "job-prop11", nil)
		server.Close()

		if err != nil {
			t.Fatalf("Property 11 failed: unexpected error: %v (seq=%v)", err, seq)
		}
		if result.Status != expectedStatus {
			t.Fatalf("Property 11 failed: got status %q want %q (seq=%v)", result.Status, expectedStatus, seq)
		}
		if got := atomic.LoadInt32(&requestCount); got != expectedRequests {
			t.Fatalf("Property 11 failed: made %d requests want %d (seq=%v)", got, expectedRequests, seq)
		}
	}
}
