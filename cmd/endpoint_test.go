package cmd

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/sandbaseai/cli/internal/client"
	"github.com/sandbaseai/cli/internal/output"
	"github.com/sandbaseai/cli/internal/resource"
)

func endpointTestApp(serverURL string) (*App, *bytes.Buffer) {
	api := client.New(serverURL, "sk-test", 30, false)
	var stdout bytes.Buffer
	renderer := output.New(true, false, true)
	renderer.Stdout = &stdout
	renderer.Stderr = io.Discard
	return &App{Client: api, Resource: resource.New(api), Output: renderer}, &stdout
}

func TestEndpointCreateFlags(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/endpoints" || r.Method != http.MethodPost {
			t.Fatalf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("Content-Type"); got != "application/json" {
			t.Fatalf("Content-Type = %q", got)
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body["name"] != "reviewer" || body["runtime"] != "hermes" {
			t.Fatalf("unexpected body: %#v", body)
		}
		skills, _ := body["skills"].([]any)
		if len(skills) != 2 || skills[0] != "vendor/one" || skills[1] != "vendor/two" {
			t.Fatalf("unexpected skills: %#v", body["skills"])
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"id":"ep_test","creation_mode":"declarative"}`))
	}))
	defer server.Close()

	app, stdout := endpointTestApp(server.URL)
	cmd := newEndpointCreateCmd(app)
	cmd.SetArgs([]string{"--name", "reviewer", "--runtime", "hermes", "--skill", "vendor/one", "--skill", "vendor/two"})
	if err := cmd.Execute(); err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(stdout.Bytes(), []byte(`"id": "ep_test"`)) {
		t.Fatalf("unexpected output: %s", stdout.String())
	}
}

func TestEndpointCreateYAMLFile(t *testing.T) {
	const definition = "name: reviewer\nruntime: hermes\nskills: []\n"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Content-Type"); got != "application/yaml" {
			t.Fatalf("Content-Type = %q", got)
		}
		body, _ := io.ReadAll(r.Body)
		if string(body) != definition {
			t.Fatalf("body = %q", body)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"id":"ep_yaml"}`))
	}))
	defer server.Close()

	path := filepath.Join(t.TempDir(), "endpoint.yaml")
	if err := os.WriteFile(path, []byte(definition), 0o600); err != nil {
		t.Fatal(err)
	}
	app, _ := endpointTestApp(server.URL)
	cmd := newEndpointCreateCmd(app)
	cmd.SetArgs([]string{"--file", path})
	if err := cmd.Execute(); err != nil {
		t.Fatal(err)
	}
}

func TestEndpointCreateRejectsMixedModes(t *testing.T) {
	app, _ := endpointTestApp("http://127.0.0.1:1")
	cmd := newEndpointCreateCmd(app)
	cmd.SetArgs([]string{"--file", "endpoint.yaml", "--name", "mixed"})
	if err := cmd.Execute(); err == nil {
		t.Fatal("expected mixed mode error")
	}
}
