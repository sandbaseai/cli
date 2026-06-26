package cmd

import (
	"fmt"
	"net/http"
	"strings"

	clierrors "github.com/sandbaseai/cli/internal/errors"
	"github.com/sandbaseai/cli/internal/poller"
	"github.com/sandbaseai/cli/internal/schema"
	"github.com/spf13/cobra"
)

func newRunCmd(app *App) *cobra.Command {
	var (
		setParams  []string
		noWait     bool
		noDownload bool
		outputDir  string
	)

	cmd := &cobra.Command{
		Use:   "run <slug>",
		Short: "Submit a multimodal generation job",
		Long: `Submit a multimodal generation job to a model.

Parameters are passed via --set flags:
  sandbase run flux-pro --set prompt="a cat in space" --set width=1024

Use 'sandbase schema <slug>' to see available parameters.`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			// Handle dynamic help: if --help was requested with a slug, show schema
			return runExec(cmd, app, args[0], setParams, noWait, noDownload, outputDir)
		},
	}

	cmd.Flags().StringSliceVar(&setParams, "set", nil, "Set parameter as key=value (repeatable)")
	cmd.Flags().BoolVar(&noWait, "no-wait", false, "Return job ID immediately without polling")
	cmd.Flags().BoolVar(&noDownload, "no-download", false, "Output URLs without downloading files")
	cmd.Flags().StringVar(&outputDir, "output", ".", "Output directory for downloaded files")

	return cmd
}

func runExec(cmd *cobra.Command, app *App, slug string, setParams []string, noWait, noDownload bool, outputDir string) error {
	if err := app.EnsureClient(); err != nil {
		return err
	}

	ctx := cmd.Context()

	// Resolve alias
	cwd, _ := getCwd()
	cfg, err := app.Config.Load(cwd)
	if err == nil {
		slug = app.Config.ResolveAlias(cfg, slug)
	}

	// Fetch schema for validation and type guard
	sp := app.Output.Spinner("Fetching model schema...")
	sp.Start()
	schemaData, err := app.Schema.Fetch(ctx, slug)
	sp.Stop()
	if err != nil {
		return err
	}

	// LLM type guard: if model is LLM, reject with hint to use chat
	if schemaData.Kind == schema.KindLLM {
		return &clierrors.CliError{
			Code:     "VALIDATION_FAILED",
			Message:  fmt.Sprintf("model %q is type \"llm\". Use 'sandbase chat --model %s' instead.", slug, slug),
			ExitCode: 1,
		}
	}

	// Parse --set key=value parameters
	params, err := parseSetParams(setParams)
	if err != nil {
		return err
	}

	// Merge with project defaults
	if cfg != nil {
		params = app.Config.MergeParams(cfg, slug, params)
	}

	// Validate required parameters
	validation := app.Schema.Validate(schemaData, params)
	if !validation.Valid {
		return &clierrors.CliError{
			Code:     "VALIDATION_FAILED",
			Message:  fmt.Sprintf("missing required parameters: %s", strings.Join(validation.Missing, ", ")),
			ExitCode: 1,
			Details:  map[string]any{"missing": validation.Missing},
		}
	}

	// Auto-upload local files
	for key, val := range params {
		strVal, ok := val.(string)
		if !ok {
			continue
		}
		if app.File.IsLocalPath(strVal) {
			sp := app.Output.Spinner(fmt.Sprintf("Uploading %s...", strVal))
			sp.Start()
			uploadResult, err := app.File.UploadWithProgress(ctx, strVal, func(read int64) {
				sp.UpdateText(fmt.Sprintf("Uploading %s (%s)...", strVal, humanizeBytes(read)))
			})
			sp.Stop()
			if err != nil {
				return err
			}
			params[key] = uploadResult.URL
			app.Output.Info(fmt.Sprintf("Uploaded: %s", uploadResult.URL))
		}
	}

	// Submit job: POST /v1/run
	body := map[string]any{
		"model":  slug,
		"params": params,
	}

	var submitResp runSubmitResponse
	if err := app.Client.Request(ctx, http.MethodPost, "/v1/run", body, &submitResp); err != nil {
		return err
	}

	jobID := submitResp.ID
	if jobID == "" {
		return &clierrors.CliError{
			Code:     "API_ERROR",
			Message:  "API did not return a job ID",
			ExitCode: 1,
		}
	}

	// --no-wait: output job_id and exit
	if noWait {
		app.Output.Data(
			map[string]any{"job_id": jobID},
			func(payload any) string {
				return fmt.Sprintf("Job submitted: %s", jobID)
			},
		)
		return nil
	}

	// Poll for completion
	sp = app.Output.Spinner(fmt.Sprintf("Processing job %s...", jobID))
	sp.Start()
	result, err := app.Poller.Poll(ctx, jobID, func(r poller.JobResult) {
		sp.UpdateText(fmt.Sprintf("Job %s: %s", jobID, r.Status))
	})
	sp.Stop()
	if err != nil {
		return err
	}

	// Handle failed jobs
	if result.Status == "failed" {
		msg := "job failed"
		if result.Error != nil {
			msg = fmt.Sprintf("job failed: %s", result.Error.Message)
		}
		return &clierrors.CliError{
			Code:     "JOB_FAILED",
			Message:  msg,
			ExitCode: 1,
			Details:  result,
		}
	}

	// --no-download: output URLs only
	if noDownload || len(result.Outputs) == 0 {
		app.Output.Data(
			result,
			func(payload any) string {
				return formatRunResult(result)
			},
		)
		return nil
	}

	// Download outputs
	for i, out := range result.Outputs {
		filename := app.File.BuildFilename(slug, out.URL, i)
		sp := app.Output.Spinner(fmt.Sprintf("Downloading %s...", filename))
		sp.Start()
		err := app.File.DownloadWithProgress(ctx, out.URL, outputDir, filename, func(written int64) {
			sp.UpdateText(fmt.Sprintf("Downloading %s (%s)...", filename, humanizeBytes(written)))
		})
		sp.Stop()
		if err != nil {
			return err
		}
		app.Output.Info(fmt.Sprintf("Saved: %s/%s", outputDir, filename))
	}

	app.Output.Data(
		result,
		func(payload any) string {
			return formatRunResult(result)
		},
	)
	return nil
}

// parseSetParams parses key=value pairs from --set flags.
func parseSetParams(setParams []string) (map[string]any, error) {
	result := make(map[string]any)
	for _, s := range setParams {
		parts := strings.SplitN(s, "=", 2)
		if len(parts) != 2 {
			return nil, &clierrors.CliError{
				Code:     "VALIDATION_FAILED",
				Message:  fmt.Sprintf("invalid parameter format %q: expected key=value", s),
				ExitCode: 1,
			}
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		if key == "" {
			return nil, &clierrors.CliError{
				Code:     "VALIDATION_FAILED",
				Message:  fmt.Sprintf("empty key in parameter %q", s),
				ExitCode: 1,
			}
		}
		result[key] = value
	}
	return result, nil
}

func formatRunResult(result *poller.JobResult) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("Job:    %s\n", result.ID))
	sb.WriteString(fmt.Sprintf("Status: %s\n", result.Status))

	if len(result.Outputs) > 0 {
		sb.WriteString("\nOutputs:\n")
		for i, o := range result.Outputs {
			sb.WriteString(fmt.Sprintf("  %d. [%s] %s\n", i+1, o.Type, o.URL))
		}
	}

	return strings.TrimSpace(sb.String())
}

// runSubmitResponse represents the response from POST /v1/run.
type runSubmitResponse struct {
	ID string `json:"id"`
}
