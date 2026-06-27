package mcp

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ServerConfig configures the MCP server.
type ServerConfig struct {
	Name      string    // server name, e.g. "sandbase"
	Version   string    // CLI version
	Transport string    // "stdio" or "http"
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
		return fmt.Errorf("http transport not yet implemented")
	default:
		return fmt.Errorf("unsupported transport: %s", s.config.Transport)
	}
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
