package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/sandbaseai/cli/internal/client"
)

// ServerConfig configures the MCP server.
type ServerConfig struct {
	Name      string    // server name, e.g. "sandbase"
	Version   string    // CLI version
	Transport string    // "stdio" or "http"
	Addr      string    // HTTP listen address, e.g. ":8080"
	Endpoint  string    // HTTP endpoint path, default "/mcp"
	Toolsets  []Toolset // enabled toolsets (nil = all)
	ReadOnly  bool      // only expose read-only tools
}

// Server is the MCP server that bridges IDE/Agent requests to SandBase API.
type Server struct {
	config    ServerConfig
	registry  *Registry
	mcpServer *server.MCPServer
}

// NewServer creates a new MCP server with the given config.
func NewServer(cfg ServerConfig) *Server {
	registry := NewRegistry(cfg.Toolsets, cfg.ReadOnly)
	return &Server{
		config:   cfg,
		registry: registry,
	}
}

// Registry returns the tool registry for external tool registration.
func (s *Server) Registry() *Registry {
	return s.registry
}

// Run starts the MCP server and blocks until ctx is cancelled or the connection closes.
func (s *Server) Run(ctx context.Context) error {
	s.mcpServer = server.NewMCPServer(
		s.config.Name,
		s.config.Version,
		server.WithToolCapabilities(false),
		server.WithRecovery(),
	)

	// Register all enabled tools with the mcp-go server
	for _, def := range s.registry.ListTools() {
		mcpTool := mcp.Tool{
			Name:        def.Name,
			Description: def.Description,
		}
		if def.InputSchema != nil {
			mcpTool.RawInputSchema = marshalSchema(def.InputSchema)
		}

		handler := def.Handler
		s.mcpServer.AddTool(mcpTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			params := req.GetArguments()
			result, err := handler(ctx, params)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			return toMCPResult(result), nil
		})
	}

	// Start transport
	switch s.config.Transport {
	case "stdio", "":
		return server.ServeStdio(s.mcpServer,
			server.WithStdioContextFunc(func(_ context.Context) context.Context {
				return ctx // Propagate Cobra's signal-aware context
			}),
		)
	case "http":
		return s.runHTTP(ctx)
	default:
		return fmt.Errorf("unsupported transport: %s", s.config.Transport)
	}
}

func (s *Server) runHTTP(ctx context.Context) error {
	addr := s.config.Addr
	if addr == "" {
		addr = ":8080"
	}
	endpoint := s.config.Endpoint
	if endpoint == "" {
		endpoint = "/mcp"
	}

	streamable := server.NewStreamableHTTPServer(
		s.mcpServer,
		server.WithEndpointPath(endpoint),
		server.WithStateLess(true),
		server.WithHeartbeatInterval(30*time.Second),
		server.WithHTTPContextFunc(func(ctx context.Context, r *http.Request) context.Context {
			if token := bearerToken(r.Header.Get("Authorization")); token != "" {
				return client.WithAPIKey(ctx, token)
			}
			return ctx
		}),
		server.WithStreamableHTTPCORS(
			server.WithCORSAllowedOrigins("*"),
			server.WithCORSAllowedHeaders("Authorization", "Content-Type", "Mcp-Session-Id", "MCP-Protocol-Version"),
			server.WithCORSExposedHeaders("Mcp-Session-Id"),
		),
	)

	mux := http.NewServeMux()
	mux.Handle(endpoint, streamable)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprintf(w, `{"name":%q,"version":%q,"endpoint":%q}`+"\n", s.config.Name, s.config.Version, endpoint)
	})
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/readyz", healthHandler)

	httpServer := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- httpServer.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return httpServer.Shutdown(shutdownCtx)
	case err := <-errCh:
		if err == http.ErrServerClosed {
			return nil
		}
		return err
	}
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"ok":true}` + "\n"))
}

func bearerToken(header string) string {
	typ, token, ok := strings.Cut(header, " ")
	if !ok || !strings.EqualFold(typ, "Bearer") {
		return ""
	}
	return strings.TrimSpace(token)
}

func marshalSchema(schema map[string]any) json.RawMessage {
	data, err := json.Marshal(schema)
	if err != nil {
		return nil
	}
	return data
}

func toMCPResult(r *ToolResult) *mcp.CallToolResult {
	if r == nil {
		return mcp.NewToolResultText("")
	}
	result := &mcp.CallToolResult{
		IsError: r.IsError,
	}
	for _, block := range r.Content {
		switch block.Type {
		case "text":
			result.Content = append(result.Content, mcp.NewTextContent(block.Text))
		case "image":
			result.Content = append(result.Content, mcp.ImageContent{
				Type:     "image",
				Data:     block.Data,
				MIMEType: block.MIME,
			})
		}
	}
	return result
}
