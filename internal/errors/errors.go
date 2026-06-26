package errors

// CliError represents a structured CLI error with machine-readable code,
// human-readable message, process exit code, and optional details for JSON output.
type CliError struct {
	Code     string `json:"code"`
	Message  string `json:"message"`
	ExitCode int    `json:"-"`
	Details  any    `json:"details,omitempty"`
}

func (e *CliError) Error() string { return e.Message }
