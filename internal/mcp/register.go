package mcp

// RegisterAllTools registers SandBase platform MCP tools into the registry.
func RegisterAllTools(r *Registry, svc *AppServices) {
	// --- Models toolset (all read-only) ---
	r.Register(ToolDef{
		Name: "sandbase_models_list", Description: "List or search SandBase platform models",
		InputSchema: ObjectSchema(map[string]any{
			"type":  StringProp("Filter by model type (image, video, audio, 3d, llm)"),
			"query": StringProp("Search query"),
		}, nil),
		Toolset: ToolsetModels, ReadOnly: true, Handler: ModelsListHandler(svc),
	})
	r.Register(ToolDef{
		Name: "sandbase_models_get", Description: "Get model details",
		InputSchema: ObjectSchema(map[string]any{"model": StringProp("Model slug")}, []string{"model"}),
		Toolset:     ToolsetModels, ReadOnly: true, Handler: ModelsGetHandler(svc),
	})
	r.Register(ToolDef{
		Name: "sandbase_schema_get", Description: "Get model parameter schema",
		InputSchema: ObjectSchema(map[string]any{"model": StringProp("Model slug")}, []string{"model"}),
		Toolset:     ToolsetModels, ReadOnly: true, Handler: SchemaGetHandler(svc),
	})

	// --- Run toolset ---
	r.Register(ToolDef{
		Name: "sandbase_run_submit", Description: "Submit multimodal generation job. Waits up to ~50s for completion; if the job takes longer, returns a job_id to poll with sandbase_run_status.",
		InputSchema: ObjectSchema(map[string]any{
			"model":  StringProp("Model slug"),
			"params": ObjectProp("Model input parameters"),
			"wait":   BoolProp("Wait for completion (default true)", true),
		}, []string{"model"}),
		Toolset: ToolsetRun, ReadOnly: false, Handler: RunSubmitHandler(svc),
	})
	r.Register(ToolDef{
		Name: "sandbase_run_status", Description: "Query job status",
		InputSchema: ObjectSchema(map[string]any{"job_id": StringProp("Job ID")}, []string{"job_id"}),
		Toolset:     ToolsetRun, ReadOnly: true, Handler: RunStatusHandler(svc),
	})

	// --- Chat toolset ---
	r.Register(ToolDef{
		Name: "sandbase_chat", Description: "Chat with an LLM (synchronous)",
		InputSchema: ObjectSchema(map[string]any{
			"model":  StringProp("LLM model identifier"),
			"prompt": StringProp("User message"),
			"system": StringProp("System prompt (optional)"),
		}, []string{"model", "prompt"}),
		Toolset: ToolsetChat, ReadOnly: false, Handler: ChatHandler(svc),
	})

	// --- Upload toolset ---
	r.Register(ToolDef{
		Name: "sandbase_upload", Description: "Upload a file to SandBase CDN",
		InputSchema: ObjectSchema(map[string]any{"file_path": StringProp("Local file path")}, []string{"file_path"}),
		Toolset:     ToolsetUpload, ReadOnly: false, Handler: UploadHandler(svc),
	})

	// --- Agent toolset ---
	agentCfg := CRUDConfig{Resource: "agent", IDParam: "agent_id", BasePath: "agents"}
	r.Register(ToolDef{
		Name: "sandbase_agent_list", Description: "List agents",
		InputSchema: ObjectSchema(map[string]any{}, nil),
		Toolset:     ToolsetAgent, ReadOnly: true, Handler: MakeListHandler(svc, agentCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_agent_get", Description: "Get agent details",
		InputSchema: ObjectSchema(map[string]any{"agent_id": StringProp("Agent ID")}, []string{"agent_id"}),
		Toolset:     ToolsetAgent, ReadOnly: true, Handler: MakeGetHandler(svc, agentCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_agent_create", Description: "Create agent",
		InputSchema: ObjectSchema(map[string]any{"name": StringProp("Agent name"), "config": ObjectProp("Configuration")}, []string{"name"}),
		Toolset:     ToolsetAgent, ReadOnly: false, Handler: MakeCreateHandler(svc, agentCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_agent_update", Description: "Update agent",
		InputSchema: ObjectSchema(map[string]any{"agent_id": StringProp("Agent ID"), "config": ObjectProp("Updated config")}, []string{"agent_id"}),
		Toolset:     ToolsetAgent, ReadOnly: false, Handler: MakeUpdateHandler(svc, agentCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_agent_archive", Description: "Archive agent",
		InputSchema: ObjectSchema(map[string]any{"agent_id": StringProp("Agent ID")}, []string{"agent_id"}),
		Toolset:     ToolsetAgent, ReadOnly: false, Handler: MakeActionHandler(svc, agentCfg, "archive"),
	})

	// --- Session toolset ---
	sessionCfg := CRUDConfig{Resource: "session", IDParam: "session_id", BasePath: "sessions"}
	r.Register(ToolDef{
		Name: "sandbase_session_list", Description: "List sessions",
		InputSchema: ObjectSchema(map[string]any{}, nil),
		Toolset:     ToolsetSession, ReadOnly: true, Handler: MakeListHandler(svc, sessionCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_session_get", Description: "Get session details",
		InputSchema: ObjectSchema(map[string]any{"session_id": StringProp("Session ID")}, []string{"session_id"}),
		Toolset:     ToolsetSession, ReadOnly: true, Handler: MakeGetHandler(svc, sessionCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_session_create", Description: "Create session",
		InputSchema: ObjectSchema(map[string]any{"agent_id": StringProp("Agent ID")}, []string{"agent_id"}),
		Toolset:     ToolsetSession, ReadOnly: false, Handler: MakeCreateHandler(svc, sessionCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_session_send", Description: "Send message to session",
		InputSchema: ObjectSchema(map[string]any{"session_id": StringProp("Session ID"), "message": StringProp("Message")}, []string{"session_id", "message"}),
		Toolset:     ToolsetSession, ReadOnly: false, Handler: SessionSendHandler(svc),
	})
	r.Register(ToolDef{
		Name: "sandbase_session_events", Description: "Get session events",
		InputSchema: ObjectSchema(map[string]any{"session_id": StringProp("Session ID")}, []string{"session_id"}),
		Toolset:     ToolsetSession, ReadOnly: true, Handler: SessionEventsHandler(svc),
	})
	r.Register(ToolDef{
		Name: "sandbase_session_stop", Description: "Stop session",
		InputSchema: ObjectSchema(map[string]any{"session_id": StringProp("Session ID")}, []string{"session_id"}),
		Toolset:     ToolsetSession, ReadOnly: false, Handler: MakeActionHandler(svc, sessionCfg, "stop"),
	})

	// --- Environment toolset ---
	envCfg := CRUDConfig{Resource: "environment", IDParam: "env_id", BasePath: "environments"}
	r.Register(ToolDef{
		Name: "sandbase_env_list", Description: "List environments",
		InputSchema: ObjectSchema(map[string]any{}, nil),
		Toolset:     ToolsetEnvironment, ReadOnly: true, Handler: MakeListHandler(svc, envCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_env_get", Description: "Get environment details",
		InputSchema: ObjectSchema(map[string]any{"env_id": StringProp("Environment ID")}, []string{"env_id"}),
		Toolset:     ToolsetEnvironment, ReadOnly: true, Handler: MakeGetHandler(svc, envCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_env_create", Description: "Create environment",
		InputSchema: ObjectSchema(map[string]any{"name": StringProp("Name"), "config": ObjectProp("Configuration")}, []string{"name"}),
		Toolset:     ToolsetEnvironment, ReadOnly: false, Handler: MakeCreateHandler(svc, envCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_env_update", Description: "Update environment",
		InputSchema: ObjectSchema(map[string]any{"env_id": StringProp("Environment ID"), "config": ObjectProp("Config")}, []string{"env_id"}),
		Toolset:     ToolsetEnvironment, ReadOnly: false, Handler: MakeUpdateHandler(svc, envCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_env_delete", Description: "Delete environment",
		InputSchema: ObjectSchema(map[string]any{"env_id": StringProp("Environment ID")}, []string{"env_id"}),
		Toolset:     ToolsetEnvironment, ReadOnly: false, Handler: MakeDeleteHandler(svc, envCfg),
	})

	// --- Skill toolset ---
	r.Register(ToolDef{
		Name: "sandbase_skill_list", Description: "Search and browse skills",
		InputSchema: ObjectSchema(map[string]any{
			"query":    StringProp("Search query (optional)"),
			"category": StringProp("Filter by category (optional)"),
		}, nil),
		Toolset: ToolsetSkill, ReadOnly: true, Handler: SkillListHandler(svc),
	})
	r.Register(ToolDef{
		Name: "sandbase_skill_get", Description: "Get skill details by ID",
		InputSchema: ObjectSchema(map[string]any{"skill_id": StringProp("Skill ID")}, []string{"skill_id"}),
		Toolset:     ToolsetSkill, ReadOnly: true, Handler: SkillGetHandler(svc),
	})
	r.Register(ToolDef{
		Name: "sandbase_skill_library", Description: "List the current organization's skills",
		InputSchema: ObjectSchema(map[string]any{}, nil),
		Toolset:     ToolsetSkill, ReadOnly: true, Handler: SkillLibraryHandler(svc),
	})
	r.Register(ToolDef{
		Name: "sandbase_skill_create", Description: "Create an organization skill. Provide either skill_file_url from /v1/skills/files or git_url.",
		InputSchema: ObjectSchema(map[string]any{
			"name":               StringProp("Skill name"),
			"description":        StringProp("Description (optional)"),
			"skill_file_url":     StringProp("Uploaded skill file URL from /v1/skills/files"),
			"git_url":            StringProp("Public Git repository or directory URL"),
			"preview_image_urls": map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Preview image URLs"},
			"categories":         map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Category tags"},
		}, []string{"name"}),
		Toolset: ToolsetSkill, ReadOnly: false, Handler: SkillCreateHandler(svc),
	})
	r.Register(ToolDef{
		Name: "sandbase_skill_update", Description: "Update a skill (JSON)",
		InputSchema: ObjectSchema(map[string]any{
			"skill_id":       StringProp("Skill ID"),
			"name":           StringProp("Skill name"),
			"description":    StringProp("Description (optional)"),
			"skill_file_url": StringProp("New skill file URL (optional)"),
			"preview_image_urls": map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "New preview image URLs (optional)"},
			"categories":     map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Category tags (optional)"},
			"environment_id": StringProp("Environment ID (optional)"),
		}, []string{"skill_id", "name"}),
		Toolset: ToolsetSkill, ReadOnly: false, Handler: SkillUpdateHandler(svc),
	})
	r.Register(ToolDef{
		Name: "sandbase_skill_delete", Description: "Delete a skill",
		InputSchema: ObjectSchema(map[string]any{"skill_id": StringProp("Skill ID")}, []string{"skill_id"}),
		Toolset:     ToolsetSkill, ReadOnly: false, Handler: SkillDeleteHandler(svc),
	})

	// --- Embed toolset ---
	embedCfg := CRUDConfig{Resource: "embed", IDParam: "embed_id", BasePath: "embeds"}
	r.Register(ToolDef{
		Name: "sandbase_embed_list", Description: "List embed configs for the current organization",
		InputSchema: ObjectSchema(map[string]any{}, nil),
		Toolset:     ToolsetEmbed, ReadOnly: true, Handler: MakeListHandler(svc, embedCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_embed_get", Description: "Get embed config details",
		InputSchema: ObjectSchema(map[string]any{"embed_id": StringProp("Embed config ID")}, []string{"embed_id"}),
		Toolset:     ToolsetEmbed, ReadOnly: true, Handler: MakeGetHandler(svc, embedCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_embed_create", Description: "Create an embed config and return a publishable key plus embed_code",
		InputSchema: ObjectSchema(map[string]any{
			"name":             StringProp("Embed config name"),
			"agent_id":         StringProp("Agent ID"),
			"environment_id":   StringProp("Environment ID"),
			"allowed_origins":  map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Allowed website origins"},
			"title":            StringProp("Widget title"),
			"welcome_message":  StringProp("Welcome message"),
			"theme_color":      StringProp("Widget theme color, e.g. #10b981"),
			"avatar_url":       StringProp("Assistant avatar URL"),
			"placeholder_text": StringProp("Input placeholder text"),
		}, []string{"name", "agent_id", "environment_id"}),
		Toolset: ToolsetEmbed, ReadOnly: false, Handler: MakeCreateHandler(svc, embedCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_embed_update", Description: "Update an embed config",
		InputSchema: ObjectSchema(map[string]any{
			"embed_id":         StringProp("Embed config ID"),
			"name":             StringProp("Embed config name"),
			"allowed_origins":  map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Allowed website origins"},
			"title":            StringProp("Widget title"),
			"welcome_message":  StringProp("Welcome message"),
			"theme_color":      StringProp("Widget theme color"),
			"avatar_url":       StringProp("Assistant avatar URL"),
			"placeholder_text": StringProp("Input placeholder text"),
			"enabled":          BoolProp("Whether the embed is enabled", true),
		}, []string{"embed_id"}),
		Toolset: ToolsetEmbed, ReadOnly: false, Handler: MakeUpdateHandler(svc, embedCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_embed_delete", Description: "Delete an embed config",
		InputSchema: ObjectSchema(map[string]any{"embed_id": StringProp("Embed config ID")}, []string{"embed_id"}),
		Toolset:     ToolsetEmbed, ReadOnly: false, Handler: MakeDeleteHandler(svc, embedCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_embed_usage", Description: "Get usage stats for an embed config",
		InputSchema: ObjectSchema(map[string]any{"embed_id": StringProp("Embed config ID")}, []string{"embed_id"}),
		Toolset:     ToolsetEmbed, ReadOnly: true, Handler: MakeSubListHandler(svc, embedCfg, "usage"),
	})

	// --- MCP toolset ---
	r.Register(ToolDef{
		Name: "sandbase_mcp_servers", Description: "List platform MCP servers",
		InputSchema: ObjectSchema(map[string]any{}, nil),
		Toolset:     ToolsetMCP, ReadOnly: true, Handler: MCPServersHandler(svc),
	})

	// --- Account toolset ---
	r.Register(ToolDef{
		Name: "sandbase_account_balance", Description: "Get account balance",
		InputSchema: ObjectSchema(map[string]any{}, nil),
		Toolset:     ToolsetAccount, ReadOnly: true, Handler: AccountBalanceHandler(svc),
	})
	r.Register(ToolDef{
		Name: "sandbase_account_history", Description: "Get usage history",
		InputSchema: ObjectSchema(map[string]any{}, nil),
		Toolset:     ToolsetAccount, ReadOnly: true, Handler: AccountHistoryHandler(svc),
	})
}
