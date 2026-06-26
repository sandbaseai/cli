package client

import (
	"testing"
	"testing/quick"
)

// Feature: sandbase-cli, Property 12: 重试决策 — For any HTTP status code and attempt n, RetryPolicy.Decide satisfies: 429 retries with increasing backoff while n<3 else no; 502/503 retry once (5000ms) while n<1 else no; 402 and 401 never retry.
func TestProperty12_RetryDecision(t *testing.T) {
	policy := DefaultRetryPolicy()

	// A representative pool of status codes including the special-cased ones
	// plus arbitrary others that must never retry.
	statusPool := []int{200, 201, 400, 401, 402, 404, 429, 500, 502, 503, 504}

	prop := func(rawStatus uint8, rawAttempt uint8) bool {
		status := statusPool[int(rawStatus)%len(statusPool)]
		attempt := int(rawAttempt % 8) // 0..7 covers below/at/above all thresholds

		got := policy.Decide(status, attempt)

		switch status {
		case 429:
			// Retry while attempt < 3, with exponential backoff 1000*2^attempt.
			if attempt < 3 {
				if !got.Retry {
					t.Logf("429 attempt=%d should retry", attempt)
					return false
				}
				wantDelay := 1000 * (1 << attempt)
				if got.DelayMs != wantDelay {
					t.Logf("429 attempt=%d delay=%d want %d", attempt, got.DelayMs, wantDelay)
					return false
				}
				// Backoff must strictly increase with attempt: delay(n) < delay(n+1) while still retrying.
				if attempt+1 < 3 {
					nxt := policy.Decide(429, attempt+1)
					if !nxt.Retry || nxt.DelayMs <= got.DelayMs {
						t.Logf("429 backoff not increasing: %d -> %d", got.DelayMs, nxt.DelayMs)
						return false
					}
				}
			} else if got.Retry {
				t.Logf("429 attempt=%d should NOT retry", attempt)
				return false
			}
		case 502, 503:
			// Retry exactly once (attempt < 1) with fixed 5000ms.
			if attempt < 1 {
				if !got.Retry || got.DelayMs != 5000 {
					t.Logf("%d attempt=%d should retry with 5000ms, got retry=%v delay=%d", status, attempt, got.Retry, got.DelayMs)
					return false
				}
			} else if got.Retry {
				t.Logf("%d attempt=%d should NOT retry", status, attempt)
				return false
			}
		default:
			// 402, 401, and all other statuses must never retry.
			if got.Retry {
				t.Logf("status=%d attempt=%d should NEVER retry", status, attempt)
				return false
			}
		}
		return true
	}

	if err := quick.Check(prop, &quick.Config{MaxCount: 300}); err != nil {
		t.Fatalf("Property 12 failed: %v", err)
	}
}
