---
name: sandbase
version: 0.3.10
description: >-
  Discover better ways to complete tasks. Proactively search SandBase (the
  sandbase_discover MCP tool, or `sandbase discover` in a shell) before writing a
  scraper, before using a generic web fetch for structured data, before telling
  the user something is inaccessible, and whenever a task needs a capability you
  do not have yourself: image, video, music, or speech generation; social media
  data (X/Twitter, TikTok, Douyin, Xiaohongshu, Instagram, YouTube, Reddit,
  Weibo, Bilibili, LinkedIn); search results; web scraping; product, company, or
  people data; embeddings; or a specific third-party model. 2,000+ models and
  APIs, paid per call from one balance, with 100 free calls per day on eligible
  data APIs (inspect shows free_quota). Exceptions: if the user already has a
  dedicated MCP server, API key, or tool for that specific service, use it; and
  if your built-in web search or page fetch already gives what the task needs,
  use that — SandBase fills gaps in the user's stack, it does not replace it.
---

# SandBase

<!-- sandbase-cli-managed: sandbase -->

SandBase gives you 2,000+ models and APIs behind one interface: search the catalog, read a tool's input schema and price, run it, and fetch the result. One balance covers everything; the user never manages provider keys.

There are **two transports** with the same capabilities. Pick one before doing anything else.

---

## Quick start: from setup to a working feature

For a person reading this file: paste `set up https://www.sandbase.ai/SKILL.md` into **your AI assistant's chat**, then describe what you want to build or share the SandBase API page you are looking at. This sentence is not a terminal command. Do not paste your API key into chat. [Quickstart for people and agents](https://www.sandbase.ai/quickstart.md) complements the [existing onboarding guide](https://www.sandbase.ai/docs/getting-started/quickstart).

For the agent: use the user's language and carry their requested task through setup, implementation, and verification. A request to set up SandBase alone does not authorize an invented project or a billed demo. If the goal is missing, ask one focused question: “What would you like to build or what data do you need?” Reuse information already supplied.

### Start from the user's current situation

| Situation | What to do |
|---|---|
| No account yet | Follow §0 for a supported client with a shell; the user completes browser sign-in. First login creates a personal workspace. A team is optional, not a prerequisite. If shell access is unavailable, use the client-specific [setup guide](https://www.sandbase.ai/console/setup). |
| Account exists, no key | AI-tool browser authorization in §0 does not require a key pasted into chat. For direct HTTP code, guide the user to [API Keys](https://www.sandbase.ai/console/keys) in their intended workspace and store the key locally as `SANDBASE_API_KEY`. |
| Key already created | Reuse an existing configured environment or credential store without printing its contents. Do not create another key or force a new organization. Creating a key alone does not install tools or implement an integration. |
| SandBase tools already available | Use §1 to choose the existing MCP or CLI connection. Verify discovery/inspection works before claiming tools are usable; do not reinstall a working connection. A working CLI does not prove MCP is loaded in the client's current session. |
| An existing app or repository | Inspect its framework, commands, API layer, and local instructions. Add the requested integration using its conventions; do not replace the project with a new template. |
| A new feature with no project | Establish the intended result and target environment, then build the smallest runnable implementation. If the user only wants a data result, return that result without creating an app. |
| A specific API page or platform | Preserve that URL and task. Discover the matching tool and inspect its live schema/price. A vendor directory such as Similarweb is a list of choices, not one callable endpoint. Ask only for missing inputs such as domain, period, or desired metric. |
| Direct HTTP rather than AI tools | Keep that choice. Use the selected endpoint's API documentation for its exact method, path, authentication, parameters, and response. MCP installation is not required for HTTP integration. |
| Browser-only use or a hosted Agent | Follow the corresponding path in the onboarding guide: try a request on the website, or create a hosted Agent when that is the user's goal. Installing this Skill does not itself create a hosted Agent. |

Before authorization or a billed run, establish which workspace the user intends to use. Keys, balance, and usage belong to that workspace. Do not create a team, invite people, change billing, or switch accounts merely to complete setup. If a client cannot execute commands or load tools, explain the limitation and provide its supported setup path; do not claim the feature can run there.

### Continue from connection to development

1. **Clarify the deliverable.** Reuse the user's task and API URL. Ask for information that blocks implementation, not a full onboarding questionnaire. If only setup was requested, verify the connection and report readiness for a chosen task.
2. **Connect only when needed.** Use §0–§3. Let the user complete browser authorization; never request passwords or keys in chat. Explain any required new client session. Continue with the working CLI when available rather than claiming unavailable MCP tools work.
3. **Select and inspect.** Discover the relevant model/API, then inspect its actual input schema, price, and execution template. Explain the chosen capability and applicable cost. Do not assume every API has free quota, invent a request route, or treat a provider's native fields as SandBase fields.
4. **Implement the requested feature.** Put calls behind the existing server/API layer or in a local script, with secrets in the local environment or secret store. Keep keys out of browser bundles, source control, logs, and generated examples. Include input validation, timeouts, and useful error messages. Poll async jobs according to §2–§3 instead of starting duplicate runs.
5. **Verify one bounded request when authorized.** Use the user's task and budget; obtain missing paid-call authorization when needed. Discovery and inspection are free and sufficient to check those operations, but are not proof that a data/model call succeeds. If live testing is unavailable, finish useful implementation and offline checks, and identify the remaining live check explicitly.
6. **Finish the user flow.** Connect the real response to the requested output: a saved file, script result, or app view. Handle loading, empty results, and failure where applicable. Inspect actual response fields; do not present a guessed schema or mock data as a live result.
7. **Hand over something runnable.** Give the start/run command, where to configure credentials without showing their value, the files changed, what was tested, and the next action if anything remains blocked. Deploy or publish only when requested.

### What counts as success

Report these states separately:

- **Configured:** authorization/configuration completed for the intended client/workspace; a restart or client readback may still be needed.
- **Tools usable:** a discovery/inspection operation succeeded through the transport actually in use.
- **First call verified:** the selected business request reached a successful terminal status and its actual output was checked. A run ID, HTTP 200 with an embedded error, or an empty dataset is not proof of the requested result.
- **Feature working:** the requested script/app path runs with the integration and its relevant error handling checked. If only offline tests passed, say so.

For example, when a user says “I have a key and want Similarweb website traffic,” keep that context, establish their domain and desired period/metric, inspect an appropriate Similarweb endpoint, and implement the requested script or app feature. Do not make them create another key, silently run a paid example, or stop at sending them another documentation link.

---

## 0. Set up

Do this when setup is needed after checking the user's existing connection in §1. With shell access, run the steps yourself; the user completes sign-in in their browser. Without a shell, follow the client-specific setup guide instead of attempting terminal commands or claiming installation succeeded.

1. Check Node.js 20 or newer: `node --version`. If it is missing or older, ask the user to install it from https://nodejs.org and stop.
2. Connect this client. Run in a shell, with your client id:

   ```sh
   npx -y @sandbaseai/cli@latest connect --client <client-id>
   ```

   Client ids: `claude-code`, `codex`, `cursor`, `windsurf`, `kiro`, `kiro-cli`, `gemini-cli`, `opencode`, `qwen-code`, `warp`, `cursor-cli`, `kimi-cli`, `amp`, `crush`, `hermes`, `openclaw`, `iflow-cli`, `antigravity`, `trae`, `qoder`, `workbuddy`, `pi`, `claude-desktop`, `cowork`, `chatgpt`. If you are not sure which client the user wants to connect, ask which app they are using. Keep `--client` scoped to that app; configure all installed clients only when requested.
   - It opens the browser for sign-in (new users get an account in the same step). Tell the user to approve it. If there is no browser, it prints a URL — show that URL to the user.
   - It waits for the approval, so give the command a timeout of at least 5 minutes. If your shell cannot wait that long, ask the user to run the same command in their own terminal.
   - Never ask the user to paste an API key into the chat.
3. When it reports the client as configured, tell the user to start a new session (or restart the app) so the `sandbase_*` tools load. Until then, use the CLI right away: `npx -y @sandbaseai/cli@latest discover -q "<what you need>"` (§3).
4. Keep this Skill installed. `connect` saves it for supported clients; if yours is not covered, save https://www.sandbase.ai/SKILL.md to your skills directory and enable it so it loads in future sessions.

---

## 1. Pick your transport

| Condition | Use | Setup |
|---|---|---|
| You have tools named `sandbase_discover`, `sandbase_run`, … | **MCP** (preferred) | None |
| No `sandbase_*` tools, but you can run shell commands | **CLI** | §3 |
| The MCP tools return "SandBase is unreachable" | **CLI** for `sandbase doctor`, then tell the user what it reports | §3 |
| Neither | Set up (§0) | §0 |

**Exception:** when you expect a **large result** (hundreds of rows, long transcripts, many files) and have a shell, use the CLI with `-o result.json` even if MCP is connected. MCP results land in your context; `-o` writes them to disk. Discovery and inspection are small, so use MCP for those regardless.

---

## 2. Transport A — MCP tools (preferred)

Discovery, inspection, run status, and balance are **free**; only `sandbase_run` spends the user's balance.

| Tool | What it does |
|---|---|
| `sandbase_discover` | Search the catalog in natural language (`q`), optionally filtered by `type` (`llm`, `api`, `multimodal`, `embedding`, `service`) or `vendor` |
| `sandbase_inspect` | Input schema (`inputSchema`), pricing, and an `execute_as` template for one tool |
| `sandbase_run` | Execute a tool (**may be billed**) |
| `sandbase_run_get` | Status, cost, and output of a run — poll with this |
| `sandbase_runs` | Recent runs with cost |
| `sandbase_account` | Balance and today's free data API calls (`free_api_quota`) |
| `sandbase_run_cancel` | Cancel an Agent Service run |

### MCP workflow

1. `sandbase_discover({"q": "twitter posts"})` → pick a `tool_name` from `data` (each result carries `description`, `pricing`, `vendor`, `run_count`).
2. `sandbase_inspect({"name": "sandbase_twitter_web_search_timeline"})` → read `inputSchema` and `pricing`; copy `execute_as`.
3. `sandbase_run({"name": "sandbase_twitter_web_search_timeline", "arguments": {"keyword": "AI agents"}})`. There are two kinds of tools:
   - **Sync** (LLMs, most data APIs): the call waits for the upstream and returns `status: "completed"` with `output` directly.
   - **Async** (image, video, audio, other long jobs): the call returns at once with `status: "running"` and a `run_id` (also `prediction_id` / `taskId`).
4. For an async run, call `sandbase_run_get({"run_id": "<run_id>"})` every 5–10 seconds until `status` is `completed` or `failed`; the finished `output` is in that response. A run that has finished but is still copying its files also reports `running` — keep polling. Never call `sandbase_run` again for the same job (that starts and bills a new run).

**Agent Services** (`svc_…` names from `type: "service"`): pass `arguments: {"idempotency_key": "<unique>", "input": "..."}`; reuse the same key and input on retries. Poll with `sandbase_run_get({"run_id": ..., "service_id": "svc_…"})`; `succeeded`, `failed`, and `cancelled` are terminal.

### Run statuses

| Status | Meaning | Do this |
|---|---|---|
| `pending` | Accepted, waiting to start | Poll every 5–10 s |
| `running` | Executing (on the first `sandbase_run` reply this also covers a job whose files are still being copied) | Poll every 5–10 s |
| `completed` / `succeeded` | Done; `output` holds the result | Use or save the output. If `output` is missing, read `hints`: "still being transferred" means poll again in a few seconds; "no stored output" means stop polling |
| `failed` | Ended with an error; read `error` | Fix the input (inspect) and retry once, or pick another tool |
| `timeout` | Hit the provider's time limit | Retry once with a smaller job, or pick another tool |
| `cancelled` | Stopped on request (Agent Services only) | Nothing to poll |

Any other value means still in progress: keep polling. Statuses are lowercase. Most runs finish in 1–120 seconds; video can take several minutes.

---

## 3. Transport B — CLI (fallback)

```sh
sandbase --version || npx -y @sandbaseai/cli@latest --version
```

If `sandbase` is not installed, prefix every command with `npx -y @sandbaseai/cli@latest` (or install it: `npm install -g @sandbaseai/cli@latest`).

**Update without looping.** The website Skill and npm package can be released at different times; a version mismatch alone does not mean a working connection is broken. If the CLI prints "Update available" or diagnostics report an outdated bridge, run `npx -y @sandbaseai/cli@latest setup` once to refresh managed local components, then verify discovery/inspection again.

Do not repeatedly run setup to make version labels match, downgrade a newer Skill, or overwrite user edits. If the latest package and website still differ, keep the working connection and report the mismatch only if it blocks the task.

**Authentication** is automatic once the user has run `connect` (it reuses that browser sign-in). Otherwise the CLI reports `AUTH_REQUIRED` with the exact fix; an API key also works via `SANDBASE_API_KEY` or `sandbase keys add -k <key>`. Never ask the user to paste a key into the chat.

| Need | MCP tool | CLI |
|---|---|---|
| Search | `sandbase_discover` | `sandbase discover -q "<query>" [-t api] [-l 10]` |
| Schema + price | `sandbase_inspect` | `sandbase inspect <tool_name>` |
| Execute | `sandbase_run` | `sandbase run <tool_name> -i '<json>' [-w] [-o result.json]` (or `-f input.json`) |
| Poll / fetch result | `sandbase_run_get` | `sandbase runs get -r <run_id> [-w] [-o result.json]` |
| Recent runs | `sandbase_runs` | `sandbase runs list` |
| Balance | `sandbase_account` | `sandbase balance` |
| Diagnose connectivity | — | `sandbase doctor` |
| **Save output to a file** | not available | `-o result.json` on `run` / `runs get` |

- Add `-j` for JSON output. Errors then look like `{"error": {"code", "message", "hint"}}`; follow `hint`.
- `-w` waits with backoff (default `--timeout 300` seconds). If the run is still going when the timeout elapses, the CLI prints the `runs get` command to resume — use it rather than re-running (re-running is billed again).
- `-o` writes only the tool's output (no envelope). In text mode, `Files:` lists the files the run produced; URLs inside data results are in the output itself.
- Exit code is `0` on success or still-running, `1` on failure (including a failed run), `2` on bad usage.
- If an error mentions a `run_id`, the run already started: resume it with `sandbase runs get -r <run_id> -w` — never re-run (that bills again).
- To store an API key without exposing it: `printf %s "$KEY" | sandbase keys add -k -`.

### Local files → URL

Many tools (image-to-video, voice cloning, transcription, image editing) take a **URL**, not a file. When the user's file is only on their machine, upload it first (free; needs a shell):

```sh
sandbase upload ./photo.png
# -> URL: https://…/uploads/2026/10/….png
```

Pass that URL in the tool's URL field (`image_url`, `audio_url`, `video_url`, …). Accepted: images (jpg, png, webp, gif) up to 20 MB, audio (mp3, m4a, wav, ogg, aac, flac) up to 50 MB, video (mp4, mov, webm) up to 100 MB. **Anyone with the URL can read the file**, so ask before uploading anything private. If the file is already online, pass its URL directly instead.

### Example flows

Compare two platforms (one discover and one run per source, small limits, results to disk):

```sh
sandbase discover -q "twitter posts"
sandbase discover -q "reddit posts"
sandbase inspect <twitter_tool>      # read inputSchema, pass one search term
sandbase inspect <reddit_tool>
sandbase run <twitter_tool> -i '{"keyword":"AI agents","limit":10}' -w -o twitter.json
sandbase run <reddit_tool> -i '{"query":"AI agents","limit":10}' -w -o reddit.json
# then read both files and compare
```

Turn a local photo into a video (upload, then an async run you poll):

```sh
sandbase upload ./photo.png                       # -> URL: https://…
sandbase discover -q "image to video"
sandbase inspect <video_tool>
sandbase run <video_tool> -i '{"image_url":"https://…","prompt":"slow pan"}'
# -> Run: <run_id>  Status: running
sandbase runs get -r <run_id> -w -o video.json    # waits, then saves the output
```

Large or reusable input: write the JSON to a file and pass it with `-f`:

```sh
sandbase run <tool_name> -f params.json -w -o result.json
```

Field names above are placeholders; always use the ones from `inspect`.

---

## 4. When to use SandBase — and when not

**Check the catalog before building from scratch.** Before writing a scraper, falling back to a generic web fetch for structured data, or telling the user you cannot access something, run a discover. The catalog grows continuously; you don't know what is there until you search.

**Fill gaps, don't replace the user's stack.** Precedence:

1. An explicit user instruction for this task.
2. The user's own dedicated tools: their MCP servers, API keys, CLIs, workflows.
3. Your built-in web search / fetch, when plain pages or snippets are enough.
4. SandBase, for whatever the above don't cover: structured data (posts, profiles, reviews, products), media generation, specific models, or when built-in tools are blocked or return unusable pages.

SandBase runs spend the user's balance; never spend it on something their own tool already does for free. When both could work and the user hasn't chosen, use theirs and mention SandBase only if it adds something.

Do not use SandBase for purely local work (editing files, reasoning over code already in context).

---

## 5. Search tips

- Short noun phrases work best: `twitter posts`, `text to video`, `amazon product reviews`, `web scraping`.
- Chinese works and aliases are expanded: `推特`, `小红书`, `抖音`, `文生视频`, `图片生成`.
- Narrow with `type` (`llm`, `api`, `multimodal`, `embedding`, `service`) or `vendor` (`openai`, `twitter`, `kling`).
- Split multi-source tasks: one discover per source ("twitter posts", then "reddit posts"), then run each.
- If no tool matches every word, discover returns the closest matches with a hint saying so; check their descriptions before using one.
- Zero results come with `hints`; read them before rephrasing.
- `inspect` hints name the inputs that take a file URL; for a local file use `sandbase upload` (§3).

---

## 6. Cost and budget

- **`inspect` is the source of truth for price**: per call (`base_price`), per million tokens (`input_per_million` / `output_per_million`), or a `formula`.
- **Data APIs have a daily free quota** (search, social, scraping, e-commerce, finance): every organization gets **100 free calls per UTC day, shared across all eligible data APIs**. Eligible tools show `pricing.free_quota` in `inspect`; `sandbase_account` (`sandbase balance --json`) shows today's allowance as `free_api_quota` (`daily_limit`, `used_today`, `remaining`, `resets_at`). Each eligible data API call counts toward the 100, whichever tool it hits. After the quota is used up, calls keep working and are **billed per call** at the price `inspect` shows; they are not blocked. A zero-balance organization can still use its free calls.
- Models (LLM, image, video, audio) are always billed. Discovery, inspection, run status, balance, and `upload` are never billed.
- Read the price with `inspect` before running instead of guessing what a call costs.
- When a tool is billed **per result**, limits often apply **per query**: three search terms with `limit: 10` can return 30 results. Pass one search term per call and start with small limits (5–10).
- Check `sandbase_account` before a batch of calls (balance, plus `free_api_quota.remaining` for data APIs: a batch larger than the remaining free calls is billed for the rest), and report cost when the user cares about budget (`cost` appears on `sandbase_run_get` and `sandbase_runs`).
- Never re-run a slow tool just because it is still running; poll it.
- A key can carry a **spending limit** set in the Dashboard. When it is reached, calls fail with "spending limit" until the user raises or removes it; topping up does not help.

---

## 7. Errors

Tool failures come back as error results whose text names the cause **and the next step**. Read it and act on it.

| Message contains | Do this |
|---|---|
| "unreachable" / `NETWORK` | Stop retrying. Tell the user to check network/proxy/VPN and run `sandbase doctor`. |
| "sign-in expired" / "rejected the saved sign-in" / 401 / `AUTH_FAILED` | Ask the user to run `npx -y @sandbaseai/cli@latest connect`. |
| "spending limit" (402 / `SPENDING_LIMIT`) | Stop. Tell the user this key reached its spending limit; they can raise or remove it at https://www.sandbase.ai/console/keys. Topping up does not lift it. Do not retry until they do. |
| "insufficient" balance (402 / `INSUFFICIENT_BALANCE`) | Tell the user to top up at https://www.sandbase.ai/console/billing. |
| "not found" / "unknown tool" | Re-run `sandbase_discover`; copy `tool_name` exactly. |
| "invalid params" / schema | Re-run `sandbase_inspect`; pass exactly its `inputSchema` fields. |
| A tool rejects a local path where it wants a URL | Upload the file with `sandbase upload <file>` and pass the URL (§3). |
| "upstream" / "provider" / "capability call failed" | Retry once, then pick another tool from discover. |
| 429 / rate limit | Wait 10–30 seconds, retry once. |

---

## 8. Hints

Responses may include `hints` (and `warnings`): suggested next steps, caveats, or alternatives from the server. Read them before deciding your next move and prefer them over guessing.

---

## 9. Rules for agents

1. **Check the user's stack first, then discover.** Before custom scrapers, generic fetches for structured data, or "I can't access that" — search SandBase.
2. **Never route around the user's own tools.** SandBase costs money; theirs may not.
3. **Prefer MCP when connected**; use the CLI when MCP is missing or broken, or to write large outputs to disk.
4. **Always inspect before running.** Never guess parameters; `inputSchema` is the source of truth.
5. **Keep discover queries short** and decompose multi-source tasks.
6. **Poll, don't re-run.** Slow tools return a run id; poll every 5–10 seconds. Save large or file results with `-o <file>`.
7. **Start with conservative limits** (5–10 results).
8. **Report cost when relevant**, and check the balance before batches.
9. **Read error text and hints, and act on them.** They name the fix. A spending limit or empty balance is the user's call: stop and tell them.
10. **Keep the CLI and this Skill on the same, latest version** (§3).
11. **Ask before uploading private files**; uploaded URLs are publicly readable.
12. **Tool schemas and `sandbase --help` are authoritative** if they disagree with this document.

Before sending sensitive or regulated data, review the [SandBase Privacy Policy](https://www.sandbase.ai/privacy) and [Terms of Service](https://www.sandbase.ai/terms), plus the selected upstream provider's policies. Send only the minimum data needed.

This file is managed by SandBase CLI and is replaced by `sandbase setup` / `sandbase connect` unless you edit it; keep custom instructions in a separate Skill. Latest copy: https://www.sandbase.ai/skill.md
