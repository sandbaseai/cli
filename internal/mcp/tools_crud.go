package mcp

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
)

// CRUDConfig describes a resource's API paths.
type CRUDConfig struct {
	Resource string // e.g. "agent"
	IDParam  string // e.g. "agent_id"
	BasePath string // e.g. "agents"
}

func MakeListHandler(svc *AppServices, cfg CRUDConfig) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		result, err := svc.Resource.List(ctx, cfg.BasePath, nil)
		if err != nil {
			return ErrorResultf("list %s failed: %v", cfg.Resource, err), nil
		}
		return JSONResult(result), nil
	}
}

func MakeGetHandler(svc *AppServices, cfg CRUDConfig) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		id, errResult := RequireString(params, cfg.IDParam)
		if errResult != nil {
			return errResult, nil
		}
		result, err := svc.Resource.Get(ctx, cfg.BasePath, id)
		if err != nil {
			return ErrorResultf("get %s failed: %v", cfg.Resource, err), nil
		}
		return JSONResult(result), nil
	}
}

func MakeCreateHandler(svc *AppServices, cfg CRUDConfig) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		body := make(map[string]any)
		for k, v := range params {
			body[k] = v
		}
		result, err := svc.Resource.Create(ctx, cfg.BasePath, body)
		if err != nil {
			return ErrorResultf("create %s failed: %v", cfg.Resource, err), nil
		}
		return JSONResult(result), nil
	}
}

func MakeUpdateHandler(svc *AppServices, cfg CRUDConfig) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		id, errResult := RequireString(params, cfg.IDParam)
		if errResult != nil {
			return errResult, nil
		}
		body := make(map[string]any)
		for k, v := range params {
			if k != cfg.IDParam {
				body[k] = v
			}
		}
		result, err := svc.Resource.Update(ctx, cfg.BasePath, id, body)
		if err != nil {
			return ErrorResultf("update %s failed: %v", cfg.Resource, err), nil
		}
		return JSONResult(result), nil
	}
}

func MakeDeleteHandler(svc *AppServices, cfg CRUDConfig) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		id, errResult := RequireString(params, cfg.IDParam)
		if errResult != nil {
			return errResult, nil
		}
		err := svc.Resource.Delete(ctx, cfg.BasePath, id)
		if err != nil {
			return ErrorResultf("delete %s failed: %v", cfg.Resource, err), nil
		}
		return TextResult(fmt.Sprintf("%s %s deleted", cfg.Resource, id)), nil
	}
}

func MakeActionHandler(svc *AppServices, cfg CRUDConfig, action string) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		id, errResult := RequireString(params, cfg.IDParam)
		if errResult != nil {
			return errResult, nil
		}
		result, err := svc.Resource.Action(ctx, cfg.BasePath, id, action, nil)
		if err != nil {
			return ErrorResultf("%s %s failed: %v", action, cfg.Resource, err), nil
		}
		return JSONResult(result), nil
	}
}

// SessionSendHandler sends a message to a session.
func SessionSendHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		sessionID, errResult := RequireString(params, "session_id")
		if errResult != nil {
			return errResult, nil
		}
		message, errResult := RequireString(params, "message")
		if errResult != nil {
			return errResult, nil
		}
		body := map[string]any{"type": "message", "content": message}
		path := fmt.Sprintf("/v1/sessions/%s/events", url.PathEscape(sessionID))
		var result map[string]any
		if err := svc.Client.Request(ctx, http.MethodPost, path, body, &result); err != nil {
			return ErrorResultf("send message failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}

// SessionEventsHandler retrieves event history for a session.
func SessionEventsHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		sessionID, errResult := RequireString(params, "session_id")
		if errResult != nil {
			return errResult, nil
		}
		result, err := svc.Resource.SubList(ctx, "sessions", sessionID, "events")
		if err != nil {
			return ErrorResultf("get events failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}

// AccountBalanceHandler returns account balance.
func AccountBalanceHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		var result map[string]any
		if err := svc.Client.Request(ctx, http.MethodGet, "/v1/account/balance", nil, &result); err != nil {
			return ErrorResultf("get balance failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}

// AccountHistoryHandler returns usage history.
func AccountHistoryHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		var result map[string]any
		if err := svc.Client.Request(ctx, http.MethodGet, "/v1/account/history", nil, &result); err != nil {
			return ErrorResultf("get history failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}

// MCPServersHandler lists platform MCP servers.
func MCPServersHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		result, err := svc.Resource.List(ctx, "mcp/servers", nil)
		if err != nil {
			return ErrorResultf("list mcp servers failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}
