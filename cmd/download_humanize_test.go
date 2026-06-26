package cmd

import "testing"

func TestHumanizeBytes(t *testing.T) {
	tests := []struct {
		n    int64
		want string
	}{
		{0, "0 B"},
		{512, "512 B"},
		{1024, "1.0 KB"},
		{1536, "1.5 KB"},
		{1048576, "1.0 MB"},
		{1073741824, "1.0 GB"},
	}
	for _, tt := range tests {
		if got := humanizeBytes(tt.n); got != tt.want {
			t.Errorf("humanizeBytes(%d) = %q, want %q", tt.n, got, tt.want)
		}
	}
}
