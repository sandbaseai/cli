package mcp

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/sandbaseai/cli/internal/poller"
)

// RunSubmitHandler submits a generation job and optionally waits for completion.
func RunSubmitHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		model, errResult := RequireString(params, "model")
		if errResult != nil {
			return errResult, nil
		}

		// Check model type
		s, err := svc.Schema.Fetch(ctx, model)
		if err != nil {
			return ErrorResultf("failed to fetch model schema: %v", err), nil
		}
		if s != nil && s.Kind == "llm" {
			return ErrorResult("model is LLM type, use sandbase_chat instead"), nil
		}

		runParams, _ := params["params"].(map[string]any)
		if runParams == nil {
			runParams = make(map[string]any)
		}

		var submitResp struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		}
		body := map[string]any{"model": model, "input": runParams}
		if err := svc.Client.Request(ctx, http.MethodPost, "/v1/run", body, &submitResp); err != nil {
			return ErrorResultf("failed to submit job: %v", err), nil
		}

		wait := OptionalBool(params, "wait", true)
		if !wait {
			return TextResult(fmt.Sprintf("Job submitted: %s (status: %s)", submitResp.ID, submitResp.Status)), nil
		}

		result, err := svc.Poller.Poll(ctx, submitResp.ID, nil)
		if err != nil {
			return ErrorResultf("polling failed: %v", err), nil
		}
		if result.Status == "failed" {
			msg := "job failed"
			if result.Error != nil {
				msg = fmt.Sprintf("job failed: %s", result.Error.Message)
			}
			return ErrorResult(msg), nil
		}

		var lines []string
		lines = append(lines, fmt.Sprintf("Job %s completed.", result.ID))
		for i, out := range result.Outputs {
			lines = append(lines, fmt.Sprintf("Output %d: %s", i+1, out.URL))
		}
		return TextResult(strings.Join(lines, "\n")), nil
	}
}

// RunStatusHandler queries a job's current status.
func RunStatusHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		jobID, errResult := RequireString(params, "job_id")
		if errResult != nil {
			return errResult, nil
		}
		var result poller.JobResult
		path := fmt.Sprintf("/v1/run/%s", jobID)
		if err := svc.Client.Request(ctx, http.MethodGet, path, nil, &result); err != nil {
			return ErrorResultf("get status failed: %v", err), nil
		}
		return JSONResult(result), nil
	}
}
