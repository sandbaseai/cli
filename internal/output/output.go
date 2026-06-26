package output

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/briandowns/spinner"
	"github.com/fatih/color"
	clierrors "github.com/sandbaseai/cli/internal/errors"
)

// Mode represents the output rendering mode.
type Mode string

const (
	ModeTTY  Mode = "tty"
	ModeJSON Mode = "json"
)

// Renderer handles all CLI output in either TTY or JSON mode.
type Renderer struct {
	Mode    Mode
	Stdout  io.Writer
	Stderr  io.Writer
	NoColor bool
}

// New creates a Renderer based on flags and environment.
// jsonFlag: --json was passed
// isTTY: stdout is a terminal
// noColor: NO_COLOR env var is set (non-empty)
func New(jsonFlag bool, isTTY bool, noColor bool) *Renderer {
	mode := ModeTTY
	if jsonFlag || !isTTY {
		mode = ModeJSON
	}
	if noColor {
		color.NoColor = true
	}
	return &Renderer{
		Mode:    mode,
		Stdout:  os.Stdout,
		Stderr:  os.Stderr,
		NoColor: noColor,
	}
}

// Data outputs data payload to stdout.
// In JSON mode: marshals payload as JSON.
// In TTY mode: calls ttyFormat function to produce human-readable output.
func (r *Renderer) Data(payload any, ttyFormat func(any) string) {
	if r.Mode == ModeJSON {
		enc := json.NewEncoder(r.Stdout)
		enc.SetIndent("", "  ")
		enc.Encode(payload)
		return
	}
	fmt.Fprintln(r.Stdout, ttyFormat(payload))
}

// Info outputs diagnostic/progress info to stderr.
// Suppressed in JSON mode (decorative info is not needed for machines).
func (r *Renderer) Info(msg string) {
	if r.Mode == ModeJSON {
		return // suppress decorative info in JSON mode
	}
	fmt.Fprintf(r.Stderr, "%s\n", msg)
}

// Error outputs an error.
// JSON mode: writes error JSON to stdout (for machine parsing).
// TTY mode: writes formatted error to stderr.
func (r *Renderer) Error(err *clierrors.CliError) {
	if r.Mode == ModeJSON {
		enc := json.NewEncoder(r.Stdout)
		enc.SetIndent("", "  ")
		enc.Encode(map[string]any{
			"error": map[string]any{
				"code":    err.Code,
				"message": err.Message,
				"details": err.Details,
			},
		})
		return
	}
	// TTY mode: red error to stderr
	errColor := color.New(color.FgRed, color.Bold)
	errColor.Fprintf(r.Stderr, "Error: %s\n", err.Message)
}

// Spinner creates a loading spinner (only visible in TTY mode).
// Returns a SpinnerWrapper that is a no-op in JSON mode.
func (r *Renderer) Spinner(text string) *SpinnerWrapper {
	if r.Mode == ModeJSON {
		return &SpinnerWrapper{active: false}
	}
	s := spinner.New(spinner.CharSets[14], 100*time.Millisecond, spinner.WithWriter(r.Stderr))
	s.Suffix = " " + text
	return &SpinnerWrapper{s: s, active: true}
}

// SpinnerWrapper wraps spinner to be a no-op in JSON mode.
type SpinnerWrapper struct {
	s      *spinner.Spinner
	active bool
}

// Start begins the spinner animation.
func (sw *SpinnerWrapper) Start() {
	if sw.active {
		sw.s.Start()
	}
}

// Stop halts the spinner animation.
func (sw *SpinnerWrapper) Stop() {
	if sw.active {
		sw.s.Stop()
	}
}

// UpdateText changes the spinner suffix text.
func (sw *SpinnerWrapper) UpdateText(text string) {
	if sw.active {
		sw.s.Suffix = " " + text
	}
}
