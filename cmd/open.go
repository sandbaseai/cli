package cmd

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"

	clierrors "github.com/sandbaseai/cli/internal/errors"
	"github.com/sandbaseai/cli/internal/output"
	"github.com/spf13/cobra"
)

var openTargets = map[string]string{
	"dashboard": "https://sandbase.ai/dashboard",
	"docs":      "https://sandbase.ai/docs",
	"models":    "https://sandbase.ai/models",
}

func newOpenCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "open [target]",
		Short: "Open dashboard, docs, or models in browser",
		Long: fmt.Sprintf(`Open a platform page in the default browser.

Supported targets: %s

If no target is given, opens the dashboard.`, strings.Join(supportedTargets(), ", ")),
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			target := "dashboard"
			if len(args) > 0 {
				target = args[0]
			}

			url, ok := openTargets[target]
			if !ok {
				return &clierrors.CliError{
					Code:     "UNSUPPORTED_TARGET",
					Message:  fmt.Sprintf("unsupported target %q. Supported: %s", target, strings.Join(supportedTargets(), ", ")),
					ExitCode: 1,
				}
			}

			// In JSON mode, output URL without launching browser
			if app.Output.Mode == output.ModeJSON {
				app.Output.Data(
					map[string]any{"url": url, "target": target},
					func(payload any) string { return url },
				)
				return nil
			}

			// Open in browser
			app.Output.Info(fmt.Sprintf("Opening %s...", url))
			if err := openBrowser(url); err != nil {
				return &clierrors.CliError{
					Code:     "BROWSER_ERROR",
					Message:  fmt.Sprintf("failed to open browser: %v", err),
					ExitCode: 1,
				}
			}

			app.Output.Data(
				map[string]any{"url": url, "target": target},
				func(payload any) string {
					return fmt.Sprintf("Opened: %s", url)
				},
			)
			return nil
		},
	}
}

func supportedTargets() []string {
	targets := make([]string, 0, len(openTargets))
	for k := range openTargets {
		targets = append(targets, k)
	}
	return targets
}

func openBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "linux":
		cmd = exec.Command("xdg-open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}
	return cmd.Start()
}
