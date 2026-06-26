package output

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/fatih/color"
	clierrors "github.com/sandbaseai/cli/internal/errors"
)

func TestNew_ModeDecision(t *testing.T) {
	tests := []struct {
		name     string
		jsonFlag bool
		isTTY    bool
		want     Mode
	}{
		{"json flag forces JSON", true, true, ModeJSON},
		{"json flag and no TTY", true, false, ModeJSON},
		{"no TTY defaults to JSON", false, false, ModeJSON},
		{"TTY without json flag yields TTY", false, true, ModeTTY},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := New(tt.jsonFlag, tt.isTTY, false)
			if r.Mode != tt.want {
				t.Errorf("New(%v, %v, false).Mode = %q, want %q", tt.jsonFlag, tt.isTTY, r.Mode, tt.want)
			}
		})
	}
}

func TestNew_NoColor(t *testing.T) {
	// Reset after test
	defer func() { color.NoColor = false }()

	r := New(false, true, true)
	if !r.NoColor {
		t.Error("expected NoColor to be true when noColor=true")
	}
	if !color.NoColor {
		t.Error("expected fatih/color.NoColor to be set to true")
	}
}

func TestData_JSONMode(t *testing.T) {
	var stdout bytes.Buffer
	r := &Renderer{Mode: ModeJSON, Stdout: &stdout, Stderr: &bytes.Buffer{}}

	payload := map[string]string{"key": "value"}
	r.Data(payload, func(any) string { return "should not be called" })

	var result map[string]string
	if err := json.Unmarshal(stdout.Bytes(), &result); err != nil {
		t.Fatalf("failed to parse JSON output: %v", err)
	}
	if result["key"] != "value" {
		t.Errorf("expected key=value, got %v", result)
	}
}

func TestData_TTYMode(t *testing.T) {
	var stdout bytes.Buffer
	r := &Renderer{Mode: ModeTTY, Stdout: &stdout, Stderr: &bytes.Buffer{}}

	payload := map[string]string{"key": "value"}
	r.Data(payload, func(p any) string {
		m := p.(map[string]string)
		return "formatted: " + m["key"]
	})

	output := stdout.String()
	if !strings.Contains(output, "formatted: value") {
		t.Errorf("expected TTY formatted output, got %q", output)
	}
}

func TestInfo_TTYMode(t *testing.T) {
	var stderr bytes.Buffer
	r := &Renderer{Mode: ModeTTY, Stdout: &bytes.Buffer{}, Stderr: &stderr}

	r.Info("hello info")
	if !strings.Contains(stderr.String(), "hello info") {
		t.Errorf("expected info on stderr, got %q", stderr.String())
	}
}

func TestInfo_JSONMode_Suppressed(t *testing.T) {
	var stderr bytes.Buffer
	r := &Renderer{Mode: ModeJSON, Stdout: &bytes.Buffer{}, Stderr: &stderr}

	r.Info("should be suppressed")
	if stderr.Len() > 0 {
		t.Errorf("expected no output in JSON mode, got %q", stderr.String())
	}
}

func TestError_JSONMode(t *testing.T) {
	var stdout bytes.Buffer
	r := &Renderer{Mode: ModeJSON, Stdout: &stdout, Stderr: &bytes.Buffer{}}

	cliErr := &clierrors.CliError{
		Code:     "TEST_ERROR",
		Message:  "something went wrong",
		ExitCode: 1,
		Details:  map[string]string{"hint": "try again"},
	}
	r.Error(cliErr)

	var result map[string]any
	if err := json.Unmarshal(stdout.Bytes(), &result); err != nil {
		t.Fatalf("failed to parse error JSON: %v", err)
	}
	errObj, ok := result["error"].(map[string]any)
	if !ok {
		t.Fatal("expected error object in JSON output")
	}
	if errObj["code"] != "TEST_ERROR" {
		t.Errorf("expected code=TEST_ERROR, got %v", errObj["code"])
	}
	if errObj["message"] != "something went wrong" {
		t.Errorf("expected message='something went wrong', got %v", errObj["message"])
	}
}

func TestError_TTYMode(t *testing.T) {
	// Force no color for predictable output
	color.NoColor = true
	defer func() { color.NoColor = false }()

	var stderr bytes.Buffer
	var stdout bytes.Buffer
	r := &Renderer{Mode: ModeTTY, Stdout: &stdout, Stderr: &stderr}

	cliErr := &clierrors.CliError{
		Code:     "TEST_ERROR",
		Message:  "something went wrong",
		ExitCode: 1,
	}
	r.Error(cliErr)

	if stdout.Len() > 0 {
		t.Errorf("TTY error should not write to stdout, got %q", stdout.String())
	}
	if !strings.Contains(stderr.String(), "Error: something went wrong") {
		t.Errorf("expected error on stderr, got %q", stderr.String())
	}
}

func TestData_StreamSeparation(t *testing.T) {
	// Data goes to stdout, not stderr
	var stdout, stderr bytes.Buffer
	r := &Renderer{Mode: ModeJSON, Stdout: &stdout, Stderr: &stderr}

	r.Data("hello", func(any) string { return "" })
	if stderr.Len() > 0 {
		t.Errorf("data should not appear on stderr, got %q", stderr.String())
	}
	if stdout.Len() == 0 {
		t.Error("data should appear on stdout")
	}
}

func TestSpinner_JSONMode_IsNoOp(t *testing.T) {
	r := &Renderer{Mode: ModeJSON, Stdout: &bytes.Buffer{}, Stderr: &bytes.Buffer{}}
	sw := r.Spinner("loading")
	if sw.active {
		t.Error("spinner should be inactive in JSON mode")
	}
	// These should not panic
	sw.Start()
	sw.Stop()
	sw.UpdateText("new text")
}
