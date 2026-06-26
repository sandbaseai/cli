package cmd

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	clierrors "github.com/sandbaseai/cli/internal/errors"
	"github.com/sandbaseai/cli/internal/poller"
	"github.com/spf13/cobra"
)

func newStatusCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "status <job_id>",
		Short: "Check the status of an async job",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return statusExec(cmd.Context(), app, args[0])
		},
	}
}

func statusExec(ctx context.Context, app *App, jobID string) error {
	if err := app.EnsureClient(); err != nil {
		return err
	}

	path := fmt.Sprintf("/v1/run/%s", jobID)

	var result poller.JobResult
	if err := app.Client.Request(ctx, http.MethodGet, path, nil, &result); err != nil {
		return err
	}

	// If the job failed, return error with the message
	if result.Status == "failed" && result.Error != nil {
		return &clierrors.CliError{
			Code:     "JOB_FAILED",
			Message:  fmt.Sprintf("job failed: %s", result.Error.Message),
			ExitCode: 1,
			Details:  result,
		}
	}

	app.Output.Data(
		result,
		func(payload any) string {
			return formatJobStatus(result)
		},
	)
	return nil
}

func formatJobStatus(r poller.JobResult) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("Job:    %s\n", r.ID))
	sb.WriteString(fmt.Sprintf("Status: %s\n", r.Status))

	if len(r.Outputs) > 0 {
		sb.WriteString("\nOutputs:\n")
		for i, o := range r.Outputs {
			sb.WriteString(fmt.Sprintf("  %d. [%s] %s\n", i+1, o.Type, o.URL))
		}
	}

	if r.Error != nil {
		sb.WriteString(fmt.Sprintf("\nError: %s\n", r.Error.Message))
	}

	return strings.TrimSpace(sb.String())
}
