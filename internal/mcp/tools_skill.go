package mcp

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
)

// SkillListHandler searches/browses skills in the marketplace.
func SkillListHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		query := url.Values{}
		if q := OptionalString(params, "query"); q != "" {
			query.Set("q", q)
		}
		if cat := OptionalString(params, "category"); cat != "" {
			query.Set("category", cat)
		}
		result, err := svc.Resource.List(ctx, "skills", query)
		if err != nil {
			return ErrorResultf("list skills failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}

// SkillGetHandler gets skill details by vendor/slug identifier.
func SkillGetHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		slug, errResult := RequireString(params, "slug")
		if errResult != nil {
			return errResult, nil
		}
		result, err := svc.Resource.Get(ctx, "skills", slug)
		if err != nil {
			return ErrorResultf("get skill failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}

// SkillMineHandler lists the current user's uploaded skills.
func SkillMineHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		result, err := svc.Resource.List(ctx, "skills/mine", nil)
		if err != nil {
			return ErrorResultf("list my skills failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}

// SkillRunHandler submits a skill run by vendor/slug.
func SkillRunHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		slug, errResult := RequireString(params, "slug")
		if errResult != nil {
			return errResult, nil
		}
		path := fmt.Sprintf("/v1/skills/%s/runs", slug)
		var result map[string]any
		if err := svc.Client.Request(ctx, http.MethodPost, path, nil, &result); err != nil {
			return ErrorResultf("run skill failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}

// SkillRunStatusHandler gets the status/artifacts of a skill run.
func SkillRunStatusHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		runID, errResult := RequireString(params, "run_id")
		if errResult != nil {
			return errResult, nil
		}
		path := fmt.Sprintf("/v1/skills/runs/%s", url.PathEscape(runID))
		var result map[string]any
		if err := svc.Client.Request(ctx, http.MethodGet, path, nil, &result); err != nil {
			return ErrorResultf("get run status failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}

// SkillFavoriteHandler favorites a skill.
func SkillFavoriteHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		skillID, errResult := RequireString(params, "skill_id")
		if errResult != nil {
			return errResult, nil
		}
		_, err := svc.Resource.Action(ctx, "skills", skillID, "favorite", nil)
		if err != nil {
			return ErrorResultf("favorite failed: %v", err), nil
		}
		return TextResult(fmt.Sprintf("Skill %s favorited.", skillID)), nil
	}
}

// SkillUnfavoriteHandler removes a skill from favorites.
func SkillUnfavoriteHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		skillID, errResult := RequireString(params, "skill_id")
		if errResult != nil {
			return errResult, nil
		}
		path := fmt.Sprintf("/v1/skills/%s/favorite", url.PathEscape(skillID))
		if err := svc.Client.Request(ctx, http.MethodDelete, path, nil, nil); err != nil {
			return ErrorResultf("unfavorite failed: %v", err), nil
		}
		return TextResult(fmt.Sprintf("Skill %s unfavorited.", skillID)), nil
	}
}
