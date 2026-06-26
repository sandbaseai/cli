package client

// RetryPolicy defines retry behavior for different HTTP status codes.
// Full implementation is in task 6.2.
type RetryPolicy struct {
	MaxRetries map[int]int // status code -> max attempts
}

// RetryDecision represents the outcome of a retry evaluation.
type RetryDecision struct {
	Retry   bool
	DelayMs int
}

// DefaultRetryPolicy returns the default retry policy:
// 429 -> 3 retries with exponential backoff
// 502/503 -> 1 retry after 5s
func DefaultRetryPolicy() *RetryPolicy {
	return &RetryPolicy{
		MaxRetries: map[int]int{
			429: 3,
			502: 1,
			503: 1,
		},
	}
}

// Decide determines whether to retry a request based on status code and attempt number.
func (p *RetryPolicy) Decide(statusCode, attempt int) RetryDecision {
	if p == nil {
		return RetryDecision{Retry: false}
	}

	maxRetries, ok := p.MaxRetries[statusCode]
	if !ok || attempt >= maxRetries {
		return RetryDecision{Retry: false}
	}

	switch statusCode {
	case 429:
		// Exponential backoff: 1s, 2s, 4s
		delay := 1000 * (1 << attempt)
		return RetryDecision{Retry: true, DelayMs: delay}
	case 502, 503:
		// Fixed 5s delay
		return RetryDecision{Retry: true, DelayMs: 5000}
	default:
		return RetryDecision{Retry: false}
	}
}
