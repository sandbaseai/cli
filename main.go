package main

import (
	"context"
	"errors"
	"os"
	"os/signal"
	"syscall"

	"github.com/mattn/go-isatty"
	"github.com/sandbaseai/cli/cmd"
	clierrors "github.com/sandbaseai/cli/internal/errors"
	"github.com/sandbaseai/cli/internal/output"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	root := cmd.NewRootCmd()
	if err := root.ExecuteContext(ctx); err != nil {
		exitCode := 1
		var cliErr *clierrors.CliError
		if errors.As(err, &cliErr) {
			exitCode = cliErr.ExitCode
		}

		// Render the error through OutputRenderer using the same mode-decision
		// logic as commands: JSON when --json is set or stdout is not a TTY,
		// otherwise colored TTY text on stderr. Detecting the real TTY here
		// keeps terminal error output human-readable instead of forcing JSON.
		jsonFlag, _ := root.PersistentFlags().GetBool("json")
		isTTY := isatty.IsTerminal(os.Stdout.Fd())
		renderer := output.New(jsonFlag, isTTY, os.Getenv("NO_COLOR") != "")

		if cliErr != nil {
			renderer.Error(cliErr)
		} else {
			renderer.Error(&clierrors.CliError{
				Code:     "CLI_ERROR",
				Message:  err.Error(),
				ExitCode: exitCode,
			})
		}

		os.Exit(exitCode)
	}
}


