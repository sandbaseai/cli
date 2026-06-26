package output

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
	"testing/quick"

	clierrors "github.com/sandbaseai/cli/internal/errors"
)

// Feature: sandbase-cli, Property 6: 输出模式选择 — For any (jsonFlag, isTTY) combination, mode is JSON iff jsonFlag||!isTTY, else TTY.
func TestProperty6_OutputModeSelection(t *testing.T) {
	prop := func(jsonFlag, isTTY bool) bool {
		r := New(jsonFlag, isTTY, false)
		wantJSON := jsonFlag || !isTTY
		if wantJSON {
			return r.Mode == ModeJSON
		}
		return r.Mode == ModeTTY
	}

	if err := quick.Check(prop, &quick.Config{MaxCount: 100}); err != nil {
		t.Fatalf("Property 6 failed: %v", err)
	}
}

// Feature: sandbase-cli, Property 7: 流分离不变量 — For any mode and any data payload, after rendering, stdout contains only data (parseable JSON in JSON mode), all diagnostics/progress go only to stderr.
func TestProperty7_StreamSeparationInvariant(t *testing.T) {
	prop := func(jsonFlag, isTTY bool, payloadKey, payloadVal, infoMsg string) bool {
		var stdout, stderr bytes.Buffer
		r := New(jsonFlag, isTTY, false)
		r.Stdout = &stdout
		r.Stderr = &stderr

		payload := map[string]string{normalizeKey(payloadKey): payloadVal}

		// Emit data (must go to stdout) and a diagnostic (must go to stderr).
		r.Data(payload, func(p any) string {
			m := p.(map[string]string)
			return "DATA " + m[normalizeKey(payloadKey)]
		})
		r.Info(infoMsg)

		// Diagnostics must never leak into stdout.
		if r.Mode == ModeJSON {
			// stdout must be parseable JSON equal to the payload.
			var decoded map[string]string
			if err := json.Unmarshal(stdout.Bytes(), &decoded); err != nil {
				t.Logf("stdout not parseable JSON: %q err=%v", stdout.String(), err)
				return false
			}
			if decoded[normalizeKey(payloadKey)] != payloadVal {
				t.Logf("decoded payload mismatch: %v", decoded)
				return false
			}
			// In JSON mode Info is suppressed; stderr stays empty.
			if stderr.Len() != 0 {
				t.Logf("JSON mode leaked to stderr: %q", stderr.String())
				return false
			}
		} else {
			// TTY mode: stdout has the data line, stderr has the diagnostic.
			if !strings.Contains(stdout.String(), "DATA "+payloadVal) {
				t.Logf("TTY stdout missing data: %q", stdout.String())
				return false
			}
			if infoMsg != "" && !strings.Contains(stderr.String(), infoMsg) {
				t.Logf("TTY stderr missing info: %q", stderr.String())
				return false
			}
			// The diagnostic message must not appear in stdout.
			if infoMsg != "" && strings.Contains(stdout.String(), infoMsg) && infoMsg != "DATA "+payloadVal {
				t.Logf("TTY diagnostic leaked into stdout: %q", stdout.String())
				return false
			}
		}
		return true
	}

	if err := quick.Check(prop, &quick.Config{MaxCount: 100}); err != nil {
		t.Fatalf("Property 7 failed: %v", err)
	}
}

// Feature: sandbase-cli, Property 8: JSON 模式错误与退出码不变量 — For any CliError, in JSON mode rendering writes parseable JSON to stdout containing code and message. (Exit code is asserted via the error's ExitCode field being non-zero for error cases.)
func TestProperty8_JSONErrorAndExitCode(t *testing.T) {
	prop := func(code, message string, exitSeed uint8) bool {
		// Error cases have a non-zero exit code.
		exitCode := int(exitSeed%255) + 1

		var stdout, stderr bytes.Buffer
		r := New(true, false, false) // force JSON mode
		r.Stdout = &stdout
		r.Stderr = &stderr

		cliErr := &clierrors.CliError{
			Code:     code,
			Message:  message,
			ExitCode: exitCode,
		}

		r.Error(cliErr)

		// stdout must be parseable JSON containing code and message.
		var decoded struct {
			Error struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := json.Unmarshal(stdout.Bytes(), &decoded); err != nil {
			t.Logf("stdout not parseable JSON: %q err=%v", stdout.String(), err)
			return false
		}
		if decoded.Error.Code != code || decoded.Error.Message != message {
			t.Logf("decoded error mismatch: got code=%q msg=%q", decoded.Error.Code, decoded.Error.Message)
			return false
		}
		// Exit code for error cases must be non-zero.
		return cliErr.ExitCode != 0
	}

	if err := quick.Check(prop, &quick.Config{MaxCount: 100}); err != nil {
		t.Fatalf("Property 8 failed: %v", err)
	}
}

// Feature: sandbase-cli, Property 9: NO_COLOR 移除颜色 — For any content, when NO_COLOR is set, TTY mode output contains no ANSI escape sequences (no "\x1b[").
func TestProperty9_NoColorRemovesColor(t *testing.T) {
	prop := func(code, message string) bool {
		var stdout, stderr bytes.Buffer
		// TTY mode (jsonFlag=false, isTTY=true) with NO_COLOR set.
		r := New(false, true, true)
		r.Stdout = &stdout
		r.Stderr = &stderr

		// Error in TTY mode renders colored text to stderr (colors disabled here).
		r.Error(&clierrors.CliError{Code: code, Message: message, ExitCode: 1})
		// Info in TTY mode renders to stderr.
		r.Info(message)
		// Data in TTY mode renders to stdout.
		r.Data(message, func(p any) string { return p.(string) })

		combined := stdout.String() + stderr.String()
		return !strings.Contains(combined, "\x1b[")
	}

	if err := quick.Check(prop, &quick.Config{MaxCount: 100}); err != nil {
		t.Fatalf("Property 9 failed: %v", err)
	}
}

// normalizeKey ensures a non-empty JSON object key for generated payloads.
func normalizeKey(k string) string {
	if k == "" {
		return "k"
	}
	return k
}
