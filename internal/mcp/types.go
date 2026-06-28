package mcp

import (
	"context"

	"github.com/sandbaseai/cli/internal/client"
	"github.com/sandbaseai/cli/internal/file"
	"github.com/sandbaseai/cli/internal/poller"
	"github.com/sandbaseai/cli/internal/resource"
	"github.com/sandbaseai/cli/internal/schema"
)

// Toolset defines a group of related MCP tools.
type Toolset string

const (
	ToolsetModels      Toolset = "models"
	ToolsetRun         Toolset = "run"
	ToolsetChat        Toolset = "chat"
	ToolsetUpload      Toolset = "upload"
	ToolsetAgent       Toolset = "agent"
	ToolsetSession     Toolset = "session"
	ToolsetEnvironment Toolset = "environment"
	ToolsetSkill       Toolset = "skill"
	ToolsetEmbed       Toolset = "embed"
	ToolsetMCP         Toolset = "mcp"
	ToolsetAccount     Toolset = "account"
)

// AllToolsets contains every defined toolset.
var AllToolsets = []Toolset{
	ToolsetModels, ToolsetRun, ToolsetChat, ToolsetUpload,
	ToolsetAgent, ToolsetSession, ToolsetEnvironment,
	ToolsetSkill, ToolsetEmbed, ToolsetMCP, ToolsetAccount,
}

// ToolHandler is the function signature for a tool's execution logic.
type ToolHandler func(ctx context.Context, params map[string]any) (*ToolResult, error)

// ToolDef defines a single MCP tool's metadata and handler.
type ToolDef struct {
	Name        string
	Description string
	InputSchema map[string]any
	Toolset     Toolset
	ReadOnly    bool
	Handler     ToolHandler
}

// ToolResult is the result of a tool execution.
type ToolResult struct {
	Content []ContentBlock
	IsError bool
}

// ContentBlock is a single content element in a tool result.
type ContentBlock struct {
	Type string // "text" or "image"
	Text string
	Data string // base64 for image
	MIME string
}

// AppServices holds the CLI service dependencies needed by tool handlers.
type AppServices struct {
	Client   *client.ApiClient
	Schema   *schema.SchemaService
	Poller   *poller.JobPoller
	File     *file.FileService
	Resource *resource.Service
}
