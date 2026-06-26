package file

import (
	"bytes"
	"io"
	"testing"
)

func TestProgressReader_ReportsCumulativeBytes(t *testing.T) {
	data := bytes.Repeat([]byte("x"), 1000)
	var last int64
	var calls int
	pr := &progressReader{
		r: bytes.NewReader(data),
		onProgress: func(read int64) {
			last = read
			calls++
		},
	}

	n, err := io.Copy(io.Discard, pr)
	if err != nil {
		t.Fatalf("copy error: %v", err)
	}
	if n != 1000 {
		t.Errorf("copied %d bytes, want 1000", n)
	}
	if last != 1000 {
		t.Errorf("final progress = %d, want 1000", last)
	}
	if calls == 0 {
		t.Error("onProgress was never called")
	}
}

func TestProgressReader_NilCallbackSafe(t *testing.T) {
	pr := &progressReader{r: bytes.NewReader([]byte("abc"))}
	if _, err := io.Copy(io.Discard, pr); err != nil {
		t.Fatalf("copy error with nil callback: %v", err)
	}
}
