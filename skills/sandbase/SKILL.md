---
name: sandbase
version: 0.3.5
description: >-
  Discover better ways to complete tasks. Proactively search SandBase (the
  sandbase_discover MCP tool, or `sandbase discover` in a shell) before writing a
  scraper, before using a generic web fetch for structured data, before telling
  the user something is inaccessible, and whenever a task needs a capability you
  do not have yourself: image, video, music, or speech generation; social media
  data (X/Twitter, TikTok, Douyin, Xiaohongshu, Instagram, YouTube, Reddit,
  Weibo, Bilibili, LinkedIn); search results; web scraping; product, company, or
  people data; embeddings; or a specific third-party model. 2,000+ models and
  APIs, paid per call from one balance. Exceptions: if the user already has a
  dedicated MCP server, API key, or tool for that specific service, use it; and
  if your built-in web search or page fetch already gives what the task needs,
  use that — SandBase fills gaps in the user's stack, it does not replace it.
---

# SandBase

<!-- sandbase-cli-managed: sandbase -->

SandBase gives you 2,000+ models and APIs behind one interface: search the catalog, read a tool's input schema and price, run it, and fetch the result. One balance covers everything; the user never manages provider keys.

There are **two transports** with the same capabilities. Pick one before doing anything else.

---

## 0. Set up

Do this when the user asks you to set up SandBase (for example "set up https://www.sandbase.ai/SKILL.md"), or when §1 finds neither transport. You run the steps yourself; the user only approves a sign-in in their browser.

1. Check Node.js 20 or newer: `node --version`. If it is missing or older, ask the user to install it from https://nodejs.org and stop.
2. Connect this client. Run in a shell, with your client id:

   ```sh
   npx -y @sandbaseai/cli@latest connect --client <client-id>
   ```

   Client ids: `claude-code`, `codex`, `cursor`, `windsurf`, `kiro`, `kiro-cli`, `gemini-cli`, `opencode`, `qwen-code`, `warp`, `cursor-cli`, `kimi-cli`, `amp`, `crush`, `hermes`, `openclaw`, `iflow-cli`, `antigravity`, `trae`, `qoder`, `workbuddy`, `pi`, `claude-desktop`, `cowork`, `chatgpt`. If you are not sure which one you are, omit `--client` to configure every installed client.
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
| `sandbase_run` | Execute a tool (**costs money**) |
| `sandbase_run_get` | Status, cost, and output of a run — poll with this |
| `sandbase_runs` | Recent runs with cost |
| `sandbase_account` | Balance |
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

**Keep the CLI and this Skill on the same version.** Run `npx -y @sandbaseai/cli@latest setup` (it refreshes the CLI's MCP bridge and this Skill) when any of these is true:

- The CLI prints "Update available".
- `sandbase --version` does not match the `version` at the top of this file.

Always move both to the latest; never downgrade one to match the other. If they still differ after `setup`, save the latest copy from https://www.sandbase.ai/SKILL.md over this file.

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
- `-o` writes only the tool's output (no envelope). Files/URLs in the output are also listed in text mode.
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
- Zero results come with `hints`; read them before rephrasing.

---

## 6. Cost and budget

- `inspect` shows the price: per call (`base_price`), per million tokens (`input_per_million` / `output_per_million`), or a `formula`.
- Many data endpoints are billed **per result** and limits often apply **per query**: three search terms with `limit: 10` can return 30 results. Pass one search term per call and start with small limits (5–10).
- Check `sandbase_account` before a batch of paid calls, and report cost when the user cares about budget (`cost` appears on `sandbase_run_get` and `sandbase_runs`).
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
