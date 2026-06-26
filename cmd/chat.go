package cmd

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	clierrors "github.com/sandbaseai/cli/internal/errors"
	"github.com/sandbaseai/cli/internal/output"
	"github.com/spf13/cobra"
)

func newChatCmd(app *App) *cobra.Command {
	var (
		model    string
		system   string
		noStream bool
	)

	cmd := &cobra.Command{
		Use:   "chat [prompt]",
		Short: "Send a chat completion request to an LLM",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			var prompt string
			if len(args) > 0 {
				prompt = args[0]
			} else {
				// Try reading from stdin if not a TTY
				if !isStdinTTY() {
					data, err := io.ReadAll(os.Stdin)
					if err == nil && len(data) > 0 {
						prompt = strings.TrimSpace(string(data))
					}
				}
			}
			if prompt == "" {
				return &clierrors.CliError{
					Code:     "VALIDATION_FAILED",
					Message:  "prompt is required: provide as argument or pipe via stdin",
					ExitCode: 1,
				}
			}
			return chatExec(cmd.Context(), app, model, system, prompt, noStream)
		},
	}

	cmd.Flags().StringVar(&model, "model", "", "Model slug to use (required unless defaultChatModel configured)")
	cmd.Flags().StringVar(&system, "system", "", "System message")
	cmd.Flags().BoolVar(&noStream, "no-stream", false, "Wait for full response instead of streaming")

	return cmd
}

func chatExec(ctx context.Context, app *App, model, system, prompt string, noStream bool) error {
	if err := app.EnsureClient(); err != nil {
		return err
	}

	// Load config once: used for default model and alias resolution.
	cwd, _ := getCwd()
	cfg, _ := app.Config.Load(cwd)

	// Resolve model: --model flag > config defaultChatModel
	if model == "" && cfg != nil {
		model = cfg.DefaultChatModel
	}
	if model == "" {
		return &clierrors.CliError{
			Code:     "VALIDATION_FAILED",
			Message:  "model is required: use --model flag or set defaultChatModel in config",
			ExitCode: 1,
		}
	}

	// Resolve alias to full slug
	if cfg != nil {
		model = app.Config.ResolveAlias(cfg, model)
	}

	// Build messages
	messages := []map[string]string{}
	if system != "" {
		messages = append(messages, map[string]string{"role": "system", "content": system})
	}
	messages = append(messages, map[string]string{"role": "user", "content": prompt})

	// Determine whether to stream
	shouldStream := !noStream && app.Output.Mode == output.ModeTTY

	body := map[string]any{
		"model":    model,
		"messages": messages,
		"stream":   shouldStream,
	}

	if shouldStream {
		return chatStream(ctx, app, model, body)
	}
	return chatSync(ctx, app, model, body)
}

// multimodalGuard inspects an API error and, if it indicates the model is a
// non-LLM (multimodal) model, rewrites it into a helpful hint to use `run`.
// This avoids a pre-flight schema fetch on the hot chat path (Requirement 6.8).
func multimodalGuard(err error, model string) error {
	var cliErr *clierrors.CliError
	if !errors.As(err, &cliErr) {
		return err
	}
	// The chat endpoint rejects non-LLM models with a 400. Detect the common
	// signals and turn the message into actionable guidance.
	lower := strings.ToLower(cliErr.Message)
	if cliErr.Code == "BAD_REQUEST" &&
		(strings.Contains(lower, "not a chat") ||
			strings.Contains(lower, "not an llm") ||
			strings.Contains(lower, "multimodal") ||
			strings.Contains(lower, "unsupported model")) {
		return &clierrors.CliError{
			Code:     "VALIDATION_FAILED",
			Message:  fmt.Sprintf("model %q is not an LLM. Use 'sandbase run %s' instead.", model, model),
			ExitCode: 1,
		}
	}
	return err
}

func chatStream(ctx context.Context, app *App, model string, body map[string]any) error {
	events, err := app.Client.Stream(ctx, http.MethodPost, "/v1/chat/completions", body)
	if err != nil {
		return multimodalGuard(err, model)
	}

	if _, err := app.Stream.Consume(events, app.Output.Mode, app.Output.Stdout); err != nil {
		return err
	}
	return nil
}

func chatSync(ctx context.Context, app *App, model string, body map[string]any) error {
	// Non-streaming: set stream=false and do a normal request
	body["stream"] = false

	var response chatCompletionResponse
	if err := app.Client.Request(ctx, http.MethodPost, "/v1/chat/completions", body, &response); err != nil {
		return multimodalGuard(err, model)
	}

	content := ""
	if len(response.Choices) > 0 {
		content = response.Choices[0].Message.Content
	}

	app.Output.Data(
		map[string]any{"content": content},
		func(payload any) string {
			return content
		},
	)
	return nil
}

// chatCompletionResponse represents the non-streaming chat response.
type chatCompletionResponse struct {
	Choices []chatChoice `json:"choices"`
}

type chatChoice struct {
	Message chatMessage `json:"message"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// isStdinTTY checks if stdin is a terminal.
func isStdinTTY() bool {
	fi, err := os.Stdin.Stat()
	if err != nil {
		return true
	}
	return fi.Mode()&os.ModeCharDevice != 0
}

// getCwd returns the current working directory. Helper used by multiple commands.
func getCwd() (string, error) {
	return os.Getwd()
}


