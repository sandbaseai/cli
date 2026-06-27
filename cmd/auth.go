package cmd

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/AlecAivazis/survey/v2"
	"github.com/mattn/go-isatty"
	"github.com/sandbaseai/cli/internal/auth"
	clierrors "github.com/sandbaseai/cli/internal/errors"
	"github.com/spf13/cobra"
)

func newAuthCmd(app *App) *cobra.Command {
	authCmd := &cobra.Command{
		Use:   "auth",
		Short: "Manage authentication credentials",
	}

	authCmd.AddCommand(
		newAuthLoginCmd(app),
		newAuthLogoutCmd(app),
		newAuthStatusCmd(app),
	)

	return authCmd
}

func newAuthLoginCmd(app *App) *cobra.Command {
	var keyFlag string
	var skipVerify bool

	cmd := &cobra.Command{
		Use:   "login",
		Short: "Authenticate with the SandBase API",
		RunE: func(cmd *cobra.Command, args []string) error {
			return authLoginExec(cmd.Context(), app, keyFlag, skipVerify)
		},
	}

	cmd.Flags().StringVar(&keyFlag, "key", "", "API key (non-interactive)")
	cmd.Flags().BoolVar(&skipVerify, "no-verify", false, "Skip validating the key against the API before storing")
	return cmd
}

func authLoginExec(ctx context.Context, app *App, keyFlag string, skipVerify bool) error {
	var apiKey string

	if keyFlag != "" {
		// Non-interactive: use provided key directly
		apiKey = keyFlag
	} else {
		// Interactive: prompt for key if TTY
		if !isatty.IsTerminal(os.Stdin.Fd()) {
			return &clierrors.CliError{
				Code:     "AUTH_MISSING",
				Message:  "no API key provided. Use --key flag or run in a TTY for interactive input",
				ExitCode: 1,
			}
		}

		prompt := &survey.Password{
			Message: "Enter your SandBase API key (sk-...):",
		}
		if err := survey.AskOne(prompt, &apiKey); err != nil {
			return fmt.Errorf("input cancelled: %w", err)
		}
	}

	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return &clierrors.CliError{
			Code:     "AUTH_MISSING",
			Message:  "API key cannot be empty",
			ExitCode: 1,
		}
	}

	// Verify the key against the API before persisting it, so users get
	// immediate feedback on a bad key instead of failing on the next call.
	if !skipVerify {
		if err := app.VerifyKey(ctx, apiKey); err != nil {
			return err
		}
	}

	// Store the credentials
	if err := app.Auth.Store(apiKey); err != nil {
		return fmt.Errorf("failed to store credentials: %w", err)
	}

	app.Output.Info(fmt.Sprintf("Credentials stored. Key: %s", auth.MaskKey(apiKey)))
	return nil
}

func newAuthLogoutCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "logout",
		Short: "Remove stored credentials",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.Auth.Clear(); err != nil {
				return fmt.Errorf("failed to clear credentials: %w", err)
			}
			app.Output.Info("Credentials removed.")
			return nil
		},
	}
}

func newAuthStatusCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show current authentication status",
		RunE: func(cmd *cobra.Command, args []string) error {
			return authStatusExec(app)
		},
	}
}

func authStatusExec(app *App) error {
	cwd, _ := os.Getwd()
	resolved := app.Auth.Resolve(cwd)

	if resolved.Source == auth.SourceNone {
		app.Output.Data(
			map[string]any{
				"authenticated": false,
				"source":        string(resolved.Source),
			},
			func(payload any) string {
				return "Not authenticated. Run `sandbase auth login` to authenticate."
			},
		)
		return nil
	}

	masked := auth.MaskKey(resolved.APIKey)
	app.Output.Data(
		map[string]any{
			"authenticated": true,
			"source":        string(resolved.Source),
			"key":           masked,
		},
		func(payload any) string {
			data := payload.(map[string]any)
			return fmt.Sprintf("Authenticated\n  Source: %s\n  Key:    %s", data["source"], data["key"])
		},
	)
	return nil
}
