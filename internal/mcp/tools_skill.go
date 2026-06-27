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

// SkillManageHandler gets skill editable fields (owner only).
func SkillManageHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		skillID, errResult := RequireString(params, "skill_id")
		if errResult != nil {
			return errResult, nil
		}
		result, err := svc.Resource.SubList(ctx, "skills", skillID, "manage")
		if err != nil {
			return ErrorResultf("get skill manage failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}

// SkillCreateHandler uploads a new skill (multipart: name + skill_file/git_url + preview_image).
func SkillCreateHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		name, errResult := RequireString(params, "name")
		if errResult != nil {
			return errResult, nil
		}

		fields := map[string]string{"name": name}
		if desc := OptionalString(params, "description"); desc != "" {
			fields["description"] = desc
		}
		if cats := OptionalString(params, "categories"); cats != "" {
			fields["categories"] = cats
		}
		if gitURL := OptionalString(params, "git_url"); gitURL != "" {
			fields["git_url"] = gitURL
		}

		files := map[string]string{}
		if sf := OptionalString(params, "skill_file"); sf != "" {
			files["skill_file"] = sf
		}
		if pi := OptionalString(params, "preview_image"); pi != "" {
			files["preview_image"] = pi
		}

		// Require at least one source
		if files["skill_file"] == "" && fields["git_url"] == "" {
			return ErrorResult("skill_file or git_url is required"), nil
		}
		if files["preview_image"] == "" {
			return ErrorResult("preview_image is required"), nil
		}

		result, err := svc.File.UploadMultipart(ctx, "/v1/skills", fields, files)
		if err != nil {
			return ErrorResultf("create skill failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}

// SkillUpdateHandler updates a skill (multipart PUT: name required, other fields optional).
func SkillUpdateHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		skillID, errResult := RequireString(params, "skill_id")
		if errResult != nil {
			return errResult, nil
		}
		name, errResult := RequireString(params, "name")
		if errResult != nil {
			return errResult, nil
		}

		fields := map[string]string{"name": name}
		if desc := OptionalString(params, "description"); desc != "" {
			fields["description"] = desc
		}
		if cats := OptionalString(params, "categories"); cats != "" {
			fields["categories"] = cats
		}
		if envID := OptionalString(params, "environment_id"); envID != "" {
			fields["environment_id"] = envID
		}
		if model := OptionalString(params, "agent_model"); model != "" {
			fields["agent_model"] = model
		}
		if sys := OptionalString(params, "agent_system"); sys != "" {
			fields["agent_system"] = sys
		}

		files := map[string]string{}
		if sf := OptionalString(params, "skill_file"); sf != "" {
			files["skill_file"] = sf
		}
		if pi := OptionalString(params, "preview_image"); pi != "" {
			files["preview_image"] = pi
		}

		path := fmt.Sprintf("/v1/skills/%s", url.PathEscape(skillID))
		result, err := svc.File.UploadMultipartPut(ctx, path, fields, files)
		if err != nil {
			return ErrorResultf("update skill failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}

// SkillDeleteHandler deletes a skill. Note: currently uses disable via PATCH if available,
// otherwise returns unsupported. (API may not expose DELETE at this time.)
func SkillDeleteHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		skillID, errResult := RequireString(params, "skill_id")
		if errResult != nil {
			return errResult, nil
		}
		// Try DELETE; the API may return 404/405 if not supported
		path := fmt.Sprintf("/v1/skills/%s", url.PathEscape(skillID))
		if err := svc.Client.Request(ctx, http.MethodDelete, path, nil, nil); err != nil {
			return ErrorResultf("delete skill failed: %v", err), nil
		}
		return TextResult(fmt.Sprintf("Skill %s deleted.", skillID)), nil
	}
}
