package mcp

// Input schemas for all tools.

var ModelsListSchema = ObjectSchema(
	map[string]any{
		"type":  StringProp("Filter by model type (image, video, audio, 3d, llm)"),
		"query": StringProp("Search query to filter models by name, slug, vendor, or tags"),
	},
	nil,
)

var ModelsGetSchema = ObjectSchema(
	map[string]any{
		"model": StringProp("Model slug, e.g. black-forest-labs/flux-1.1-pro"),
	},
	[]string{"model"},
)

var SchemaGetSchema = ObjectSchema(
	map[string]any{
		"model": StringProp("Model slug to get parameter schema for"),
	},
	[]string{"model"},
)

var RunSubmitSchema = ObjectSchema(
	map[string]any{
		"model":  StringProp("Model slug, e.g. black-forest-labs/flux-1.1-pro"),
		"params": ObjectProp("Model input parameters"),
		"wait":   BoolProp("Wait for job completion (default true)", true),
	},
	[]string{"model"},
)

var RunStatusSchema = ObjectSchema(
	map[string]any{
		"job_id": StringProp("Job ID to query status for"),
	},
	[]string{"job_id"},
)

var ChatSchema = ObjectSchema(
	map[string]any{
		"model":  StringProp("LLM model identifier"),
		"prompt": StringProp("User message content"),
		"system": StringProp("System prompt (optional)"),
	},
	[]string{"model", "prompt"},
)

var UploadSchema = ObjectSchema(
	map[string]any{
		"file_path": StringProp("Local file path to upload"),
	},
	[]string{"file_path"},
)

var MCPServersSchema = ObjectSchema(map[string]any{}, nil)
var AccountBalanceSchema = ObjectSchema(map[string]any{}, nil)
var AccountHistorySchema = ObjectSchema(map[string]any{}, nil)
