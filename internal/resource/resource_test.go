package resource

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sandbaseai/cli/internal/client"
)

// newTestService wires a resource.Service to a mock server.
func newTestService(serverURL string) *Service {
	c := &client.ApiClient{
		BaseURL:    serverURL,
		APIKey:     "sk-sb-test",
		HTTPClient: http.DefaultClient,
		Stderr:     io.Discard,
	}
	return New(c)
}

func TestList(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s, want GET", r.Method)
		}
		if r.URL.Path != "/v1/agents" {
			t.Errorf("path = %s, want /v1/agents", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]any{"agents": []any{}})
	}))
	defer server.Close()

	svc := newTestService(server.URL)
	if _, err := svc.List(context.Background(), "agents", nil); err != nil {
		t.Fatalf("List error: %v", err)
	}
}

func TestListWithQuery(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/account/history" {
			t.Errorf("path = %s", r.URL.Path)
		}
		if got := r.URL.Query().Get("limit"); got != "5" {
			t.Errorf("limit = %s, want 5", got)
		}
		json.NewEncoder(w).Encode(map[string]any{"history": []any{}})
	}))
	defer server.Close()

	svc := newTestService(server.URL)
	q := map[string][]string{"limit": {"5"}}
	if _, err := svc.List(context.Background(), "account/history", q); err != nil {
		t.Fatalf("List error: %v", err)
	}
}

func TestGet(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s, want GET", r.Method)
		}
		if r.URL.Path != "/v1/agents/abc123" {
			t.Errorf("path = %s, want /v1/agents/abc123", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]any{"id": "abc123"})
	}))
	defer server.Close()

	svc := newTestService(server.URL)
	res, err := svc.Get(context.Background(), "agents", "abc123")
	if err != nil {
		t.Fatalf("Get error: %v", err)
	}
	if res["id"] != "abc123" {
		t.Errorf("id = %v, want abc123", res["id"])
	}
}

func TestGetEscapesID(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// id with a slash must be percent-escaped in the path segment.
		if r.URL.EscapedPath() != "/v1/agents/a%2Fb" {
			t.Errorf("escaped path = %s, want /v1/agents/a%%2Fb", r.URL.EscapedPath())
		}
		json.NewEncoder(w).Encode(map[string]any{})
	}))
	defer server.Close()

	svc := newTestService(server.URL)
	if _, err := svc.Get(context.Background(), "agents", "a/b"); err != nil {
		t.Fatalf("Get error: %v", err)
	}
}

func TestCreate(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", r.Method)
		}
		if r.URL.Path != "/v1/environments" {
			t.Errorf("path = %s", r.URL.Path)
		}
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if body["name"] != "prod" {
			t.Errorf("body name = %v, want prod", body["name"])
		}
		json.NewEncoder(w).Encode(map[string]any{"id": "env1", "name": "prod"})
	}))
	defer server.Close()

	svc := newTestService(server.URL)
	res, err := svc.Create(context.Background(), "environments", map[string]any{"name": "prod"})
	if err != nil {
		t.Fatalf("Create error: %v", err)
	}
	if res["id"] != "env1" {
		t.Errorf("id = %v, want env1", res["id"])
	}
}

func TestUpdate(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			t.Errorf("method = %s, want PATCH", r.Method)
		}
		if r.URL.Path != "/v1/skills/s1" {
			t.Errorf("path = %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]any{"id": "s1"})
	}))
	defer server.Close()

	svc := newTestService(server.URL)
	if _, err := svc.Update(context.Background(), "skills", "s1", map[string]any{"name": "x"}); err != nil {
		t.Fatalf("Update error: %v", err)
	}
}

func TestDelete(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("method = %s, want DELETE", r.Method)
		}
		if r.URL.Path != "/v1/sessions/x9" {
			t.Errorf("path = %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	svc := newTestService(server.URL)
	if err := svc.Delete(context.Background(), "sessions", "x9"); err != nil {
		t.Fatalf("Delete error: %v", err)
	}
}

func TestAction(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", r.Method)
		}
		if r.URL.Path != "/v1/sessions/x9/archive" {
			t.Errorf("path = %s, want /v1/sessions/x9/archive", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer server.Close()

	svc := newTestService(server.URL)
	if _, err := svc.Action(context.Background(), "sessions", "x9", "archive", nil); err != nil {
		t.Fatalf("Action error: %v", err)
	}
}

func TestSubList(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s, want GET", r.Method)
		}
		if r.URL.Path != "/v1/agents/a1/versions" {
			t.Errorf("path = %s, want /v1/agents/a1/versions", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]any{"versions": []any{}})
	}))
	defer server.Close()

	svc := newTestService(server.URL)
	if _, err := svc.SubList(context.Background(), "agents", "a1", "versions"); err != nil {
		t.Fatalf("SubList error: %v", err)
	}
}
