package client

import "context"

type apiKeyContextKey struct{}

// WithAPIKey returns a context carrying a per-request API key. It is used by
// hosted MCP transports so each caller can bring their own SandBase token
// without the server storing user credentials.
func WithAPIKey(ctx context.Context, apiKey string) context.Context {
	if apiKey == "" {
		return ctx
	}
	return context.WithValue(ctx, apiKeyContextKey{}, apiKey)
}

func apiKeyFromContext(ctx context.Context) string {
	value, _ := ctx.Value(apiKeyContextKey{}).(string)
	return value
}
