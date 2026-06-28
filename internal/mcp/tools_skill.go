package mcp

import (
	"context"
	"net/http"
	"net/url"
)

// SkillListHandler searches/browses skills.
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

// SkillGetHandler gets skill details by ID.
func SkillGetHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		id, errResult := RequireString(params, "skill_id")
		if errResult != nil {
			return errResult, nil
		}
		result, err := svc.Resource.Get(ctx, "skills", id)
		if err != nil {
			return ErrorResultf("get skill failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}

// SkillLibraryHandler lists the current organization's skills.
func SkillLibraryHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		result, err := svc.Resource.List(ctx, "skills", nil)
		if err != nil {
			return ErrorResultf("list organization skills failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}

// SkillCreateHandler creates a skill via JSON.
func SkillCreateHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		name, errResult := RequireString(params, "name")
		if errResult != nil {
			return errResult, nil
		}
		skillFileURL := OptionalString(params, "skill_file_url")
		gitURL := OptionalString(params, "git_url")
		if skillFileURL == "" && gitURL == "" {
			return ErrorResultf("create skill failed: provide either skill_file_url or git_url"), nil
		}

		body := map[string]any{
			"name": name,
		}
		if skillFileURL != "" {
			body["skill_file_url"] = skillFileURL
		}
		if gitURL != "" {
			body["git_url"] = gitURL
		}
		if desc := OptionalString(params, "description"); desc != "" {
			body["description"] = desc
		}
		if urls, ok := params["preview_image_urls"]; ok {
			body["preview_image_urls"] = urls
		}
		if _, ok := params["categories"]; ok {
			body["categories"] = params["categories"]
		}

		result, err := svc.Resource.Create(ctx, "skills", body)
		if err != nil {
			return ErrorResultf("create skill failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}

// SkillUpdateHandler updates a skill via JSON.
func SkillUpdateHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		id, errResult := RequireString(params, "skill_id")
		if errResult != nil {
			return errResult, nil
		}
		name, errResult := RequireString(params, "name")
		if errResult != nil {
			return errResult, nil
		}

		body := map[string]any{"name": name}
		if desc := OptionalString(params, "description"); desc != "" {
			body["description"] = desc
		}
		if cats, ok := params["categories"]; ok {
			body["categories"] = cats
		}
		if u := OptionalString(params, "skill_file_url"); u != "" {
			body["skill_file_url"] = u
		}
		if urls, ok := params["preview_image_urls"]; ok {
			body["preview_image_urls"] = urls
		}
		if envID := OptionalString(params, "environment_id"); envID != "" {
			body["environment_id"] = envID
		}

		result, err := svc.Resource.Update(ctx, "skills", id, body)
		if err != nil {
			return ErrorResultf("update skill failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}

// SkillDeleteHandler deletes a skill.
func SkillDeleteHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		id, errResult := RequireString(params, "skill_id")
		if errResult != nil {
			return errResult, nil
		}
		if err := svc.Client.Request(ctx, http.MethodDelete, "/v1/skills/"+url.PathEscape(id), nil, nil); err != nil {
			return ErrorResultf("delete skill failed: %v", err), nil
		}
		return TextResult("skill deleted: " + id), nil
	}
}
