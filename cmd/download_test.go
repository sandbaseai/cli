package cmd

import (
	"strings"
	"testing"
)

func TestFilenameFromURL_Traversal(t *testing.T) {
	cases := []struct {
		name string
		url  string
		want string
	}{
		{"traversal_tokens", "https://x/../../etc/passwd", "passwd"},
		{"nested_path", "https://x/a/b/c.png", "c.png"},
		{"query_string", "https://x/file.png?token=1", "file.png"},
		// No path segment: path.Base falls back to the last remaining segment
		// ("x", the host here). Still a safe bare filename (no separators).
		{"trailing_slash", "https://x/", "x"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := filenameFromURL(tc.url, 0)

			// The result must always be a bare filename: no separators and no
			// residual traversal tokens.
			if strings.ContainsAny(got, `/\`) {
				t.Errorf("filenameFromURL(%q) = %q contains a path separator", tc.url, got)
			}
			if got == ".." || strings.Contains(got, "..") {
				t.Errorf("filenameFromURL(%q) = %q contains a traversal token", tc.url, got)
			}
			if got == "" {
				t.Errorf("filenameFromURL(%q) returned empty filename", tc.url)
			}
			if got != tc.want {
				t.Errorf("filenameFromURL(%q) = %q, want %q", tc.url, got, tc.want)
			}
		})
	}
}
