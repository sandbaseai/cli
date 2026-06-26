package cmd

import (
	"context"
	"net/http"
	"os"

	"github.com/mattn/go-isatty"
	"github.com/sandbaseai/cli/internal/auth"
	"github.com/sandbaseai/cli/internal/client"
	"github.com/sandbaseai/cli/internal/config"
	"github.com/sandbaseai/cli/internal/file"
	"github.com/sandbaseai/cli/internal/output"
	"github.com/sandbaseai/cli/internal/poller"
	"github.com/sandbaseai/cli/internal/resource"
	"github.com/sandbaseai/cli/internal/schema"
	"github.com/sandbaseai/cli/internal/stream"
)

// App is the shared dependency container for all commands.
// Services are populated during the PersistentPreRunE phase
// once global flags have been parsed.
type App struct {
	Flags  GlobalFlags
	Config *config.Manager
	Auth   *auth.Resolver
	Output *output.Renderer
	Client *client.ApiClient
	Schema *schema.SchemaService
	Poller *poller.JobPoller
	File   *file.FileService
	Stream *stream.StreamService
	Resource *resource.Service
}

// GlobalFlags holds CLI-wide flags that affect all commands.
type GlobalFlags struct {
	JSON    bool
	Verbose bool
	Timeout int // seconds
}

// init constructs all core services. Called from PersistentPreRunE after flags are parsed.
func (a *App) init() error {
	// 1. Output (depends on flags + TTY)
	isTTY := isatty.IsTerminal(os.Stdout.Fd())
	noColor := os.Getenv("NO_COLOR") != ""
	a.Output = output.New(a.Flags.JSON, isTTY, noColor)

	// 2. Config
	a.Config = config.NewManager()

	// 3. Auth
	a.Auth = auth.NewResolver()

	// Don't construct Client/Schema/Poller/File/Stream yet - they need APIKey which may not be available
	// (auth login doesn't need API key). Instead, provide a helper method.
	return nil
}

// EnsureClient initializes the API client (requires auth). Call this from commands that need API access.
func (a *App) EnsureClient() error {
	if a.Client != nil {
		return nil
	}
	cwd, _ := os.Getwd()
	cfg, err := a.Config.Load(cwd)
	if err != nil {
		return err
	}
	resolved := a.Auth.Resolve(cwd)
	// If no auth at all, the ApiClient will just have empty key
	// and commands that require auth will get 401
	a.Client = client.New(cfg.BaseURL, resolved.APIKey, a.Flags.Timeout, a.Flags.Verbose)
	a.Schema = schema.New(a.Client)
	a.Poller = poller.New(a.Client)
	a.File = file.New(a.Client)
	a.Stream = stream.New()
	a.Resource = resource.New(a.Client)
	return nil
}

// VerifyKey checks a candidate API key against the API by making a lightweight
// authenticated request. Used by `auth login` to fail fast on an invalid key.
// It builds a throwaway client bound to the candidate key (not the resolved
// one) so verification reflects exactly what would be stored.
func (a *App) VerifyKey(ctx context.Context, apiKey string) error {
	cwd, _ := os.Getwd()
	cfg, err := a.Config.Load(cwd)
	if err != nil {
		return err
	}
	verifyClient := client.New(cfg.BaseURL, apiKey, a.Flags.Timeout, a.Flags.Verbose)
	// GET /v1/account/balance is a cheap authenticated endpoint; a 401 maps to
	// AUTH_INVALID via the client's error parser.
	var discard map[string]any
	if err := verifyClient.Request(ctx, http.MethodGet, "/v1/account/balance", nil, &discard); err != nil {
		return err
	}
	return nil
}
