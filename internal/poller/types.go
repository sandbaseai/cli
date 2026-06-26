package poller

// JobResult represents the result of an async job poll.
type JobResult struct {
	ID      string       `json:"id"`
	Status  string       `json:"status"`
	Outputs []OutputFile `json:"outputs,omitempty"`
	Error   *JobError    `json:"error,omitempty"`
}

// OutputFile represents a single output file from a completed job.
type OutputFile struct {
	URL  string `json:"url"`
	Type string `json:"type"`
}

// JobError represents an error returned by a failed job.
type JobError struct {
	Message string `json:"message"`
}
