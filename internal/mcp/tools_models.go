package mcp

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// ModelsListHandler lists or searches models.
func ModelsListHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		query := url.Values{}
		if t := OptionalString(params, "type"); t != "" {
			query.Set("type", t)
		}
		if q := OptionalString(params, "query"); q != "" {
			query.Set("query", q)
		}
		result, err := svc.Resource.List(ctx, "models", query)
		if err != nil {
			return ErrorResultf("list models failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}

// ModelsGetHandler gets model details.
func ModelsGetHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		slug, errResult := RequireString(params, "model")
		if errResult != nil {
			return errResult, nil
		}
		result := map[string]any{}
		err := svc.Client.Request(ctx, http.MethodGet, fmt.Sprintf("/v1/models/slug/%s", modelSlugPath(slug)), nil, &result)
		if err != nil {
			return ErrorResultf("get model failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}

// SchemaGetHandler gets a model's parameter schema.
func SchemaGetHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		slug, errResult := RequireString(params, "model")
		if errResult != nil {
			return errResult, nil
		}
		s, err := svc.Schema.Fetch(ctx, slug)
		if err != nil {
			return ErrorResultf("get schema failed: %v", err), nil
		}
		return JSONResult(s), nil
	}
}

func modelSlugPath(slug string) string {
	parts := strings.Split(slug, "/")
	for i, part := range parts {
		parts[i] = url.PathEscape(part)
	}
	return strings.Join(parts, "/")
}
