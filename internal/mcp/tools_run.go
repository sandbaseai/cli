package mcp

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/sandbaseai/cli/internal/poller"
)

// maxMCPWait bounds how long sandbase_run_submit will block while polling.
// MCP clients (Claude, Cursor) typically time out requests within ~60s, so
// blocking longer risks an orphaned job. When this bound is hit, we return the
// job ID and let the LLM poll via sandbase_run_status instead.
const maxMCPWait = 50 * time.Second

// RunSubmitHandler submits a generation job and optionally waits for completion.
func RunSubmitHandler(svc *AppServices) ToolHandler {
	return func(ctx context.Context, params map[string]any) (*ToolResult, error) {
		model, errResult := RequireString(params, "model")
		if errResult != nil {
			return errResult, nil
		}

		// Fetch schema to guard model type and validate params.
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

		// Validate required params against schema before submitting.
		if s != nil {
			if v := svc.Schema.Validate(s, runParams); !v.Valid {
				return ErrorResultf("missing required parameters: %s", strings.Join(v.Missing, ", ")), nil
			}
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
			return TextResult(fmt.Sprintf("Job submitted: %s (status: %s). Use sandbase_run_status to check progress.", submitResp.ID, submitResp.Status)), nil
		}

		// Bounded wait: poll up to maxMCPWait, then hand off to the LLM.
		pollCtx, cancel := context.WithTimeout(ctx, maxMCPWait)
		defer cancel()

		result, err := svc.Poller.Poll(pollCtx, submitResp.ID, nil)
		if err != nil {
			// Timeout/cancellation: job is still running, return its ID so the
			// LLM can poll instead of leaving the call hanging.
			if pollCtx.Err() != nil && ctx.Err() == nil {
				return TextResult(fmt.Sprintf(
					"Job %s is still running after %s. Use sandbase_run_status with job_id=%q to check progress.",
					submitResp.ID, maxMCPWait, submitResp.ID)), nil
			}
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
