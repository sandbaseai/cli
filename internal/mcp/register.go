package mcp

// RegisterAllTools registers all 30 MCP tools into the registry.
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
		Toolset: ToolsetModels, ReadOnly: true, Handler: ModelsGetHandler(svc),
	})
	r.Register(ToolDef{
		Name: "sandbase_schema_get", Description: "Get model parameter schema",
		InputSchema: ObjectSchema(map[string]any{"model": StringProp("Model slug")}, []string{"model"}),
		Toolset: ToolsetModels, ReadOnly: true, Handler: SchemaGetHandler(svc),
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
		Toolset: ToolsetRun, ReadOnly: true, Handler: RunStatusHandler(svc),
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
		Toolset: ToolsetUpload, ReadOnly: false, Handler: UploadHandler(svc),
	})

	// --- Agent toolset ---
	agentCfg := CRUDConfig{Resource: "agent", IDParam: "agent_id", BasePath: "agents"}
	r.Register(ToolDef{
		Name: "sandbase_agent_list", Description: "List agents",
		InputSchema: ObjectSchema(map[string]any{}, nil),
		Toolset: ToolsetAgent, ReadOnly: true, Handler: MakeListHandler(svc, agentCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_agent_get", Description: "Get agent details",
		InputSchema: ObjectSchema(map[string]any{"agent_id": StringProp("Agent ID")}, []string{"agent_id"}),
		Toolset: ToolsetAgent, ReadOnly: true, Handler: MakeGetHandler(svc, agentCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_agent_create", Description: "Create agent",
		InputSchema: ObjectSchema(map[string]any{"name": StringProp("Agent name"), "config": ObjectProp("Configuration")}, []string{"name"}),
		Toolset: ToolsetAgent, ReadOnly: false, Handler: MakeCreateHandler(svc, agentCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_agent_update", Description: "Update agent",
		InputSchema: ObjectSchema(map[string]any{"agent_id": StringProp("Agent ID"), "config": ObjectProp("Updated config")}, []string{"agent_id"}),
		Toolset: ToolsetAgent, ReadOnly: false, Handler: MakeUpdateHandler(svc, agentCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_agent_archive", Description: "Archive agent",
		InputSchema: ObjectSchema(map[string]any{"agent_id": StringProp("Agent ID")}, []string{"agent_id"}),
		Toolset: ToolsetAgent, ReadOnly: false, Handler: MakeActionHandler(svc, agentCfg, "archive"),
	})

	// --- Session toolset ---
	sessionCfg := CRUDConfig{Resource: "session", IDParam: "session_id", BasePath: "sessions"}
	r.Register(ToolDef{
		Name: "sandbase_session_list", Description: "List sessions",
		InputSchema: ObjectSchema(map[string]any{}, nil),
		Toolset: ToolsetSession, ReadOnly: true, Handler: MakeListHandler(svc, sessionCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_session_get", Description: "Get session details",
		InputSchema: ObjectSchema(map[string]any{"session_id": StringProp("Session ID")}, []string{"session_id"}),
		Toolset: ToolsetSession, ReadOnly: true, Handler: MakeGetHandler(svc, sessionCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_session_create", Description: "Create session",
		InputSchema: ObjectSchema(map[string]any{"agent_id": StringProp("Agent ID")}, []string{"agent_id"}),
		Toolset: ToolsetSession, ReadOnly: false, Handler: MakeCreateHandler(svc, sessionCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_session_send", Description: "Send message to session",
		InputSchema: ObjectSchema(map[string]any{"session_id": StringProp("Session ID"), "message": StringProp("Message")}, []string{"session_id", "message"}),
		Toolset: ToolsetSession, ReadOnly: false, Handler: SessionSendHandler(svc),
	})
	r.Register(ToolDef{
		Name: "sandbase_session_events", Description: "Get session events",
		InputSchema: ObjectSchema(map[string]any{"session_id": StringProp("Session ID")}, []string{"session_id"}),
		Toolset: ToolsetSession, ReadOnly: true, Handler: SessionEventsHandler(svc),
	})
	r.Register(ToolDef{
		Name: "sandbase_session_stop", Description: "Stop session",
		InputSchema: ObjectSchema(map[string]any{"session_id": StringProp("Session ID")}, []string{"session_id"}),
		Toolset: ToolsetSession, ReadOnly: false, Handler: MakeActionHandler(svc, sessionCfg, "stop"),
	})

	// --- Environment toolset ---
	envCfg := CRUDConfig{Resource: "environment", IDParam: "env_id", BasePath: "environments"}
	r.Register(ToolDef{
		Name: "sandbase_env_list", Description: "List environments",
		InputSchema: ObjectSchema(map[string]any{}, nil),
		Toolset: ToolsetEnvironment, ReadOnly: true, Handler: MakeListHandler(svc, envCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_env_get", Description: "Get environment details",
		InputSchema: ObjectSchema(map[string]any{"env_id": StringProp("Environment ID")}, []string{"env_id"}),
		Toolset: ToolsetEnvironment, ReadOnly: true, Handler: MakeGetHandler(svc, envCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_env_create", Description: "Create environment",
		InputSchema: ObjectSchema(map[string]any{"name": StringProp("Name"), "config": ObjectProp("Configuration")}, []string{"name"}),
		Toolset: ToolsetEnvironment, ReadOnly: false, Handler: MakeCreateHandler(svc, envCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_env_update", Description: "Update environment",
		InputSchema: ObjectSchema(map[string]any{"env_id": StringProp("Environment ID"), "config": ObjectProp("Config")}, []string{"env_id"}),
		Toolset: ToolsetEnvironment, ReadOnly: false, Handler: MakeUpdateHandler(svc, envCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_env_delete", Description: "Delete environment",
		InputSchema: ObjectSchema(map[string]any{"env_id": StringProp("Environment ID")}, []string{"env_id"}),
		Toolset: ToolsetEnvironment, ReadOnly: false, Handler: MakeDeleteHandler(svc, envCfg),
	})

	// --- Skill toolset ---
	skillCfg := CRUDConfig{Resource: "skill", IDParam: "skill_id", BasePath: "skills"}
	r.Register(ToolDef{
		Name: "sandbase_skill_list", Description: "List skills",
		InputSchema: ObjectSchema(map[string]any{}, nil),
		Toolset: ToolsetSkill, ReadOnly: true, Handler: MakeListHandler(svc, skillCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_skill_create", Description: "Create skill",
		InputSchema: ObjectSchema(map[string]any{"name": StringProp("Skill name"), "config": ObjectProp("Configuration")}, []string{"name"}),
		Toolset: ToolsetSkill, ReadOnly: false, Handler: MakeCreateHandler(svc, skillCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_skill_update", Description: "Update skill",
		InputSchema: ObjectSchema(map[string]any{"skill_id": StringProp("Skill ID"), "config": ObjectProp("Config")}, []string{"skill_id"}),
		Toolset: ToolsetSkill, ReadOnly: false, Handler: MakeUpdateHandler(svc, skillCfg),
	})
	r.Register(ToolDef{
		Name: "sandbase_skill_delete", Description: "Delete skill",
		InputSchema: ObjectSchema(map[string]any{"skill_id": StringProp("Skill ID")}, []string{"skill_id"}),
		Toolset: ToolsetSkill, ReadOnly: false, Handler: MakeDeleteHandler(svc, skillCfg),
	})

	// --- MCP toolset ---
	r.Register(ToolDef{
		Name: "sandbase_mcp_servers", Description: "List platform MCP servers",
		InputSchema: ObjectSchema(map[string]any{}, nil),
		Toolset: ToolsetMCP, ReadOnly: true, Handler: MCPServersHandler(svc),
	})

	// --- Account toolset ---
	r.Register(ToolDef{
		Name: "sandbase_account_balance", Description: "Get account balance",
		InputSchema: ObjectSchema(map[string]any{}, nil),
		Toolset: ToolsetAccount, ReadOnly: true, Handler: AccountBalanceHandler(svc),
	})
	r.Register(ToolDef{
		Name: "sandbase_account_history", Description: "Get usage history",
		InputSchema: ObjectSchema(map[string]any{}, nil),
		Toolset: ToolsetAccount, ReadOnly: true, Handler: AccountHistoryHandler(svc),
	})
}
