// Shell transport for agents: discover → inspect → run → runs get, plus
// balance and key management. Mirrors the sandbase_* MCP tools one-to-one so an
// agent without MCP (or with a broken MCP session) still has a working path,
// and so large results can go straight to disk with -o instead of the context.
import { constants as fsConstants } from "node:fs";
import { access, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";
import { parseArgs } from "node:util";
import { atomicWrite } from "../fs-safe.js";
import { CONNECT_COMMAND, keyFilePath, keysUrl, readStoredKey, resolveEndpoint, SandBaseError, SandBaseMCPClient, toolOutput, validMcpUrl, type FetchLike } from "./client.js";
import { updateNotice } from "./update.js";

export const agentCommands = ["discover", "inspect", "run", "runs", "balance", "keys"] as const;
export type AgentCommand = typeof agentCommands[number];
export function isAgentCommand(value: string | undefined): value is AgentCommand { return agentCommands.includes(value as AgentCommand); }

export interface AgentDeps { env?: NodeJS.ProcessEnv; fetchImpl?: FetchLike; out?: (text: string) => void; err?: (text: string) => void; sleep?: (ms: number) => Promise<void>; now?: () => number; stdin?: () => Promise<string> }

export const agentUsage = `SandBase agent commands (same capabilities as the sandbase_* MCP tools):
  sandbase discover -q "<what you need>" [-t llm|api|multimodal|embedding|service] [--vendor <slug>] [-l 10] [-j]
  sandbase inspect <tool_name> [-j]
  sandbase run <tool_name> [-i '<json>' | -f input.json] [-w] [--timeout 300] [-o result.json] [-j]
  sandbase runs get -r <run_id> [--service <svc_id>] [-w] [--timeout 300] [-o result.json] [-j]
  sandbase runs list [-l 10] [--model <model>] [--service <svc_id>] [-j]
  sandbase balance [-j]
  sandbase keys add -k - (reads the key from stdin) | keys list | keys remove
Global: --client <client> picks a connected client's credential; SANDBASE_API_KEY overrides all; -j prints JSON.`;

// Only an explicit failure ends a run as failed; any status we do not know
// (IN_QUEUE, created, unknown, …) is treated as still running so agents poll
// instead of giving up or paying for a re-run.
const SUCCEEDED = new Set(["completed", "succeeded", "success", "done"]);
const FAILED = new Set(["failed", "failure", "error", "errored", "cancelled", "canceled", "timeout", "timed_out", "expired", "rejected", "blocked", "stopped"]);
type Phase = "running" | "succeeded" | "failed";
function phaseOf(status: unknown): Phase { const value = String(status ?? "").toLowerCase(); return SUCCEEDED.has(value) ? "succeeded" : FAILED.has(value) ? "failed" : "running"; }
function hasOutput(view: { output?: unknown }): boolean { return view.output !== undefined && view.output !== null; }

interface RunView { run_id?: string; service_id?: string; idempotency_key?: string; tool?: string; status: string; output?: unknown; error?: unknown; cost?: unknown; cost_status?: unknown; hints?: unknown; timed_out?: boolean }

class Output {
  readonly notes: string[] = [];
  constructor(readonly json: boolean, private readonly out: (text: string) => void, private readonly err: (text: string) => void) {}
  print(text: string): void { this.out(text); }
  data(value: Record<string, unknown>): void { this.out(JSON.stringify(this.notes.length ? { ...value, notes: this.notes } : value, null, 2)); }
  error(error: SandBaseError): void {
    if (this.json) this.out(JSON.stringify({ error: { code: error.code, message: error.message, ...(error.hint ? { hint: error.hint } : {}) }, ...(error.runId ? { run_id: error.runId } : {}), ...(this.notes.length ? { notes: this.notes } : {}) }, null, 2));
    else this.err(`Error [${error.code}]: ${error.message}${error.runId ? `\nRun: ${error.runId}` : ""}${error.hint ? `\nNext: ${error.hint}` : ""}`);
  }
  notice(text: string): void { if (this.json) this.notes.push(text); else this.err(text); }
}

function truncate(value: string, width: number): string { const flat = value.replace(/\s+/g, " ").trim(); return flat.length > width ? `${flat.slice(0, width - 1)}…` : flat; }
function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, i) => Math.max(header.length, ...rows.map(row => (row[i] || "").length)));
  const line = (cells: string[]) => cells.map((cell, i) => i === cells.length - 1 ? cell : cell.padEnd(widths[i]!)).join("  ").trimEnd();
  return [line(headers), ...rows.map(line)].join("\n");
}
function trimNumber(value: unknown): string { const text = String(value); return /^-?\d+(\.\d+)?$/.test(text) ? String(Number(text)) : text; }
export function formatPrice(pricing: unknown): string {
  if (!pricing || typeof pricing !== "object") return "see inspect";
  const p = pricing as Record<string, unknown>;
  if (p.input_per_million !== undefined || p.output_per_million !== undefined) return `$${trimNumber(p.input_per_million ?? "?")}/$${trimNumber(p.output_per_million ?? "?")} per 1M tok`;
  if (p.base_price !== undefined && Number(p.base_price) > 0) return `$${trimNumber(p.base_price)}/call`;
  if (typeof p.formula === "string" && p.formula) return "formula (see inspect)";
  return "see inspect";
}
function hintLines(hints: unknown): string[] {
  if (!hints) return [];
  if (Array.isArray(hints)) return hints.filter(item => item !== undefined && item !== null).map(item => typeof item === "string" ? item : JSON.stringify(item));
  if (typeof hints === "object") return Object.entries(hints as Record<string, unknown>).map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
  return [String(hints)];
}
function printHints(out: Output, ...sources: unknown[]): void { const lines = sources.flatMap(hintLines); if (lines.length) out.print(["", "Hints:", ...lines.map(line => `  - ${line}`)].join("\n")); }
function collectUrls(value: unknown, found = new Set<string>()): Set<string> {
  if (found.size >= 20) return found;
  if (typeof value === "string") { if (/^https?:\/\/\S+$/.test(value)) found.add(value); }
  else if (Array.isArray(value)) for (const item of value) collectUrls(item, found);
  else if (value && typeof value === "object") for (const item of Object.values(value)) collectUrls(item, found);
  return found;
}
function shellQuote(value: string): string { return `'${value.replace(/'/g, `'\\''`)}'`; }

type OptionSpec = Record<string, { type: "string" | "boolean"; short?: string }>;
const commonOptions = { json: { type: "boolean", short: "j" }, client: { type: "string" }, help: { type: "boolean", short: "h" } } as const;
function parse<T extends OptionSpec>(argv: string[], options: T) {
  try { return parseArgs({ args: argv, options: { ...commonOptions, ...options }, allowPositionals: true, strict: true }); }
  catch (error) { throw new SandBaseError("USAGE", error instanceof Error ? error.message : "Invalid arguments.", `Usage:\n${agentUsage}`); }
}
function parseJsonObject(text: string, label: string): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new SandBaseError("USAGE", `${label} is not valid JSON.`, `Use ${label === "--input" ? "-i" : "-f"} '{"key": "value"}' with the fields from \`sandbase inspect <tool_name>\`.`); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SandBaseError("USAGE", `${label} must be a JSON object.`, "Pass an object such as '{\"prompt\": \"...\"}'.");
  return value as Record<string, unknown>;
}
function positiveSeconds(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const seconds = Number(value); if (!Number.isFinite(seconds) || seconds <= 0) throw new SandBaseError("USAGE", "--timeout must be a positive number of seconds.");
  return Math.min(seconds, 3600);
}

async function writeResult(path: string, output: unknown): Promise<void> {
  await writeFile(path, typeof output === "string" ? output : `${JSON.stringify(output ?? null, null, 2)}\n`, "utf8");
}

function runViewFromRun(data: Record<string, unknown>, tool: string): RunView {
  const runId = (data.run_id ?? data.prediction_id ?? data.taskId ?? data.id) as string | undefined;
  // No status and no run id means a synchronous tool answered directly (possibly plain text).
  const syncOutput = data.status === undefined && !runId;
  const output = data.output !== undefined ? data.output : syncOutput ? (Object.keys(data).length === 1 && "text" in data ? data.text : data) : undefined;
  return { ...(runId ? { run_id: String(runId) } : {}), ...(data.service_id ? { service_id: String(data.service_id) } : {}), tool, status: String(data.status ?? (syncOutput ? "completed" : "running")), ...(output !== undefined ? { output } : {}), ...(data.error !== undefined ? { error: data.error } : {}), ...(data.cost !== undefined ? { cost: data.cost } : {}), ...(data.cost_status !== undefined ? { cost_status: data.cost_status } : {}), ...(data.hints !== undefined ? { hints: data.hints } : {}) };
}

/** Fail before spending money when -o cannot be written. */
async function assertWritableOutput(path: string | undefined): Promise<void> {
  if (!path) return;
  try { await access(dirname(resolvePath(path)), fsConstants.W_OK); }
  catch { throw new SandBaseError("USAGE", `Cannot write the output file ${path}: its directory does not exist or is not writable.`, "Pick a writable path for -o; nothing was run."); }
}

/** After a run was accepted, every failure must still tell the agent how to resume it instead of re-running (and paying) again. */
function withRunContext(error: unknown, view: RunView): SandBaseError {
  const resume = `sandbase runs get -r ${view.run_id}${view.service_id ? ` --service ${view.service_id}` : ""} -w`;
  if (error instanceof SandBaseError) return new SandBaseError(error.code, error.message, `${error.hint ? `${error.hint} ` : ""}The run ${view.run_id} was already started; resume with \`${resume}\` instead of running it again.`, error.status, view.run_id);
  return new SandBaseError("TOOL_ERROR", error instanceof Error ? error.message : "Unknown failure", `The run ${view.run_id} was already started; resume with \`${resume}\`.`, undefined, view.run_id);
}

/** One status read: sandbase_run_get for status/cost, then MCP tasks/result for the output of finished model runs. */
async function readRun(client: SandBaseMCPClient, runId: string, serviceId?: string): Promise<RunView> {
  const { data } = await client.tool("sandbase_run_get", { run_id: runId, ...(serviceId ? { service_id: serviceId } : {}) });
  const view: RunView = { run_id: runId, ...(serviceId ? { service_id: serviceId } : {}), status: String(data.status ?? "unknown"), ...(data.model ? { tool: String(data.model) } : {}), ...(data.cost !== undefined ? { cost: data.cost } : {}), ...(data.hints !== undefined ? { hints: data.hints } : {}) };
  if (data.output !== undefined && data.output !== null) view.output = data.output; else if (serviceId && (data.items !== undefined || data.result !== undefined)) view.output = data.items ?? data.result;
  if (data.error !== undefined && data.error !== null) view.error = data.error;
  if (!serviceId && phaseOf(view.status) !== "running" && !hasOutput(view)) {
    try {
      const result = await client.rpc("tasks/result", { taskId: runId }) as { task?: unknown };
      if (!result?.task) { const task = toolOutput(result).data; if (task.output !== undefined && task.output !== null) view.output = task.output; if (task.error !== undefined && task.error !== null && view.error === undefined) view.error = task.error; }
    } catch { /* older servers: status and cost are still accurate */ }
  }
  return view;
}

async function pollRun(client: SandBaseMCPClient, initial: RunView, timeoutSeconds: number, deps: Required<Pick<AgentDeps, "sleep" | "now">>): Promise<RunView> {
  if (!initial.run_id) return initial;
  const deadline = deps.now() + timeoutSeconds * 1000;
  let view = initial, delay = 1000, emptyCompletions = 0;
  for (;;) {
    const phase = phaseOf(view.status);
    // A completed media run can briefly report no output while its files are transferred.
    if (phase === "failed" || (phase === "succeeded" && (hasOutput(view) || emptyCompletions >= 8))) return view;
    if (phase === "succeeded") emptyCompletions++;
    if (deps.now() + delay > deadline) return { ...view, timed_out: true };
    await deps.sleep(delay); delay = Math.min(Math.round(delay * 1.5), 10_000);
    const next = await readRun(client, initial.run_id, initial.service_id);
    const tool = view.tool ?? next.tool;
    view = { ...view, ...next, ...(tool ? { tool } : {}) };
  }
}

function printRun(out: Output, view: RunView, outputFile?: string): void {
  const phase = phaseOf(view.status);
  const lines = [`Run: ${view.run_id ?? "(synchronous)"}${view.tool ? `  tool=${view.tool}` : ""}`, `Status: ${view.status}${view.timed_out ? " (still running when --timeout elapsed)" : ""}`];
  if (view.cost !== undefined && view.cost !== null && view.cost !== "") lines.push(`Cost: $${trimNumber(view.cost)}`);
  if (view.error !== undefined && view.error !== null) lines.push(`Error: ${typeof view.error === "string" ? view.error : JSON.stringify(view.error)}`);
  if (view.idempotency_key) lines.push(`Idempotency key: ${view.idempotency_key}  (reuse it with the same input when retrying this service run)`);
  if (view.cost === undefined && view.cost_status === "settling") lines.push("Cost: settling (see `sandbase runs list` shortly)");
  if (phase === "succeeded" && hasOutput(view)) {
    const urls = [...collectUrls(view.output)];
    if (urls.length) lines.push("Files:", ...urls.map(url => `  ${url}`));
    if (outputFile) lines.push(`Saved output to ${outputFile}`);
    else { const text = typeof view.output === "string" ? view.output : JSON.stringify(view.output, null, 2); lines.push("Output:", text.length > 6000 ? `${text.slice(0, 6000)}\n…(truncated ${text.length - 6000} chars; rerun \`sandbase runs get -r ${view.run_id ?? "<run_id>"} -o result.json\` to save everything)` : text); }
  }
  if (phase === "running" && view.run_id) lines.push(`Next: sandbase runs get -r ${view.run_id}${view.service_id ? ` --service ${view.service_id}` : ""} -w${outputFile ? ` -o ${outputFile}` : ""}   (poll every 5-10s; runs take 1-300s)`);
  if (phase === "succeeded" && !hasOutput(view) && view.run_id) lines.push(`Output is not available yet. Retry: sandbase runs get -r ${view.run_id}${view.service_id ? ` --service ${view.service_id}` : ""}${outputFile ? ` -o ${outputFile}` : ""}`);
  out.print(lines.join("\n"));
  printHints(out, view.hints);
}

async function finishRun(out: Output, view: RunView, outputFile: string | undefined): Promise<number> {
  const phase = phaseOf(view.status);
  const saved = !!outputFile && phase === "succeeded" && hasOutput(view);
  if (saved) await writeResult(outputFile!, view.output);
  if (out.json) {
    // With -o the output goes to disk only, so a large result never enters the agent's context.
    const value: Record<string, unknown> = { ...view };
    if (saved) { delete value.output; value.output_file = outputFile; }
    out.data(value);
  } else printRun(out, view, saved ? outputFile : undefined);
  return phase === "failed" ? 1 : 0;
}

async function client(values: { client?: string | undefined }, env: NodeJS.ProcessEnv, fetchImpl?: FetchLike): Promise<SandBaseMCPClient> {
  const endpoint = await resolveEndpoint(values.client ? { client: values.client } : {}, env);
  return new SandBaseMCPClient(endpoint, fetchImpl, 120_000, env);
}

async function discover(argv: string[], out: Output, env: NodeJS.ProcessEnv, fetchImpl?: FetchLike): Promise<number> {
  const { values, positionals } = parse(argv, { query: { type: "string", short: "q" }, type: { type: "string", short: "t" }, vendor: { type: "string" }, limit: { type: "string", short: "l" } });
  const q = (values.query ?? positionals.join(" ")).trim();
  const limit = values.limit === undefined ? 10 : Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new SandBaseError("USAGE", "--limit must be an integer between 1 and 100.");
  if (!q && !values.type && !values.vendor) throw new SandBaseError("USAGE", "Describe what you need with -q.", 'Example: sandbase discover -q "twitter posts"  (short noun phrases work best; Chinese works too)');
  const api = await client(values, env, fetchImpl);
  const { data } = await api.tool("sandbase_discover", { ...(q ? { q } : {}), ...(values.type ? { type: values.type } : {}), ...(values.vendor ? { vendor: values.vendor } : {}), limit });
  const items = (Array.isArray(data.data) ? data.data : []) as Array<Record<string, unknown>>;
  if (out.json) { out.data(data); return 0; }
  if (!items.length) { out.print(`No tools matched "${q}". Try a shorter noun phrase, a synonym, or filter with -t.`); printHints(out, data.hints, data.warnings); return 0; }
  const rows = items.map(item => [String(item.tool_name ?? item.name ?? item.id ?? ""), String(item.category ?? item.type ?? ""), String(item.vendor ?? item.vendor_slug ?? ""), formatPrice(item.pricing), item.run_count === undefined ? "" : String(item.run_count), truncate(String(item.description ?? ""), 70)]);
  out.print([`Found ${items.length} tool${items.length === 1 ? "" : "s"}${q ? ` for "${q}"` : ""}:`, "", table(["TOOL", "TYPE", "VENDOR", "PRICE", "RUNS", "DESCRIPTION"], rows), "", "Next: sandbase inspect <TOOL>   (input schema, exact price, and a ready-to-run command)"].join("\n"));
  printHints(out, data.hints, data.warnings);
  return 0;
}

/** Resolve a root-level local $ref (#/components/schemas/X, #/$defs/X, #/definitions/X) so agents see real fields. */
export function resolveSchema(schema: unknown): Record<string, unknown> {
  let current = (schema && typeof schema === "object" ? schema : {}) as Record<string, unknown>;
  const root = current;
  for (let depth = 0; depth < 5 && typeof current.$ref === "string"; depth++) {
    const path = (current.$ref as string).replace(/^#\//, "").split("/").map(part => part.replace(/~1/g, "/").replace(/~0/g, "~"));
    if (!(current.$ref as string).startsWith("#/")) break;
    let target: unknown = root;
    for (const part of path) target = target && typeof target === "object" ? (target as Record<string, unknown>)[part] : undefined;
    if (!target || typeof target !== "object") break;
    current = target as Record<string, unknown>;
  }
  return current;
}

function schemaRows(schema: unknown): { rows: string[][]; example: Record<string, unknown> } {
  const value = resolveSchema(schema) as { properties?: Record<string, Record<string, unknown>>; required?: string[] };
  const required = new Set(Array.isArray(value.required) ? value.required : []);
  const rows: string[][] = [], example: Record<string, unknown> = {};
  for (const [name, prop] of Object.entries(value.properties || {})) {
    const type = Array.isArray(prop.type) ? prop.type.join("|") : String(prop.type ?? (prop.enum ? "enum" : "any"));
    const extras = [prop.enum ? `one of: ${(prop.enum as unknown[]).join(", ")}` : "", prop.default !== undefined ? `default: ${JSON.stringify(prop.default)}` : ""].filter(Boolean).join("; ");
    rows.push([name, type, required.has(name) ? "yes" : "", truncate([String(prop.description ?? ""), extras].filter(Boolean).join(" — "), 90)]);
    if (required.has(name)) example[name] = prop.example ?? prop.default ?? (Array.isArray(prop.enum) ? prop.enum[0] : type === "integer" || type === "number" ? 1 : type === "boolean" ? true : type === "array" ? [] : `<${name}>`);
  }
  return { rows, example };
}

async function inspect(argv: string[], out: Output, env: NodeJS.ProcessEnv, fetchImpl?: FetchLike): Promise<number> {
  const { values, positionals } = parse(argv, { name: { type: "string", short: "n" } });
  const name = (values.name ?? positionals[0] ?? "").trim();
  if (!name) throw new SandBaseError("USAGE", "Pass the tool name from discover.", "Example: sandbase inspect sandbase_twitter_web_search_timeline");
  const api = await client(values, env, fetchImpl);
  const { data } = await api.tool("sandbase_inspect", { name });
  const tool = String(data.tool_name ?? data.name ?? name);
  const rawSchema = data.inputSchema ?? data.input_schema;
  const { rows, example } = schemaRows(rawSchema);
  if (out.json) {
    const resolved = resolveSchema(rawSchema);
    out.data({ ...data, ...(resolved !== rawSchema ? { inputSchema: resolved } : {}), example_arguments: example, cli: `sandbase run ${tool} -i ${shellQuote(JSON.stringify(example))}` });
    return 0;
  }
  const pricing = (data.pricing || {}) as Record<string, unknown>;
  const priceLine = [formatPrice(pricing), typeof pricing.formula === "string" && pricing.formula ? `formula: ${pricing.formula}` : ""].filter(Boolean).join("  ");
  const meta = [data.model, data.category ?? data.type, data.vendor].filter(Boolean).join(" · ");
  const lines = [`${tool}${meta ? `  (${meta})` : ""}`, String(data.description ?? "").trim(), "", `Price: ${priceLine}`];
  lines.push("", rows.length ? `Input (send as JSON with -i):\n${table(["FIELD", "TYPE", "REQUIRED", "DESCRIPTION"], rows)}` : "Input: no parameters.");
  lines.push("", "Run:", `  sandbase run ${tool} -i ${shellQuote(JSON.stringify(example))}${/video|image|audio|music|speech/i.test(`${data.category ?? ""} ${data.description ?? ""} ${tool}`) ? " -w -o result.json" : ""}`);
  lines.push(`MCP: sandbase_run ${JSON.stringify({ name: tool, arguments: example })}`);
  out.print(lines.join("\n"));
  printHints(out, data.hints, data.notes);
  return 0;
}

async function run(argv: string[], out: Output, env: NodeJS.ProcessEnv, deps: Required<Pick<AgentDeps, "sleep" | "now">>, fetchImpl?: FetchLike): Promise<number> {
  const { values, positionals } = parse(argv, { input: { type: "string", short: "i" }, file: { type: "string", short: "f" }, wait: { type: "boolean", short: "w" }, timeout: { type: "string" }, output: { type: "string", short: "o" } });
  const name = (positionals[0] ?? "").trim();
  if (!name) throw new SandBaseError("USAGE", "Pass the tool name to run.", "Example: sandbase run sandbase_twitter_web_search_timeline -i '{\"keyword\":\"AI agents\"}'");
  if (values.input && values.file) throw new SandBaseError("USAGE", "Use either -i or -f, not both.");
  const timeout = positiveSeconds(values.timeout, 300);
  let args: Record<string, unknown> = {};
  if (values.input) args = parseJsonObject(values.input, "--input");
  if (values.file) { let text: string; try { text = await readFile(values.file, "utf8"); } catch { throw new SandBaseError("USAGE", `Cannot read input file ${values.file}.`); } args = parseJsonObject(text, "--file"); }
  const generatedKey = name.startsWith("svc_") && typeof args.idempotency_key !== "string" ? `cli-${deps.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}` : undefined;
  if (generatedKey) args = { ...args, idempotency_key: generatedKey };
  await assertWritableOutput(values.output);
  const api = await client(values, env, fetchImpl);
  let view: RunView;
  try {
    const { data } = await api.tool("sandbase_run", { name, arguments: args });
    view = runViewFromRun(data, name);
  } catch (error) {
    // A run that started and then failed is a result (exit 1), not a transport error.
    if (error instanceof SandBaseError && error.code === "RUN_FAILED") return finishRun(out, { ...(error.runId ? { run_id: error.runId } : {}), tool: name, status: "failed", error: error.message, ...(error.hint ? { hints: [error.hint] } : {}) }, values.output);
    throw error;
  }
  if (name.startsWith("svc_") && !view.service_id) view.service_id = name;
  if (typeof args.idempotency_key === "string" && view.service_id) view.idempotency_key = args.idempotency_key;
  if (!view.run_id) return finishRun(out, view, values.output);
  try {
    if (values.wait && phaseOf(view.status) === "running") view = await pollRun(api, view, timeout, deps);
    else if (phaseOf(view.status) !== "running" && view.cost === undefined && !view.service_id) {
      try { const { data: detail } = await api.tool("sandbase_run_get", { run_id: view.run_id }); if (detail.cost !== undefined) view.cost = detail.cost; } catch { /* cost is informational */ }
    }
    return await finishRun(out, view, values.output);
  } catch (error) { throw withRunContext(error, view); }
}

async function runs(argv: string[], out: Output, env: NodeJS.ProcessEnv, deps: Required<Pick<AgentDeps, "sleep" | "now">>, fetchImpl?: FetchLike): Promise<number> {
  const [sub, ...rest] = argv;
  if (sub === "get") {
    const { values, positionals } = parse(rest, { run: { type: "string", short: "r" }, service: { type: "string" }, wait: { type: "boolean", short: "w" }, timeout: { type: "string" }, output: { type: "string", short: "o" } });
    const runId = (values.run ?? positionals[0] ?? "").trim();
    if (!runId) throw new SandBaseError("USAGE", "Pass the run id with -r.", "Example: sandbase runs get -r pred_abc123 -w -o result.json");
    const timeout = positiveSeconds(values.timeout, 300);
    await assertWritableOutput(values.output);
    const api = await client(values, env, fetchImpl);
    let view = await readRun(api, runId, values.service);
    try {
      if (values.wait) view = await pollRun(api, view, timeout, deps);
      return await finishRun(out, view, values.output);
    } catch (error) { throw withRunContext(error, view); }
  }
  if (sub === "list") {
    const { values } = parse(rest, { limit: { type: "string", short: "l" }, model: { type: "string" }, service: { type: "string" } });
    const limit = values.limit === undefined ? 10 : Number(values.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new SandBaseError("USAGE", "--limit must be an integer between 1 and 50.");
    const api = await client(values, env, fetchImpl);
    const { data } = await api.tool("sandbase_runs", { limit, ...(values.model ? { model: values.model } : {}), ...(values.service ? { service_id: values.service } : {}) });
    if (out.json) { out.data(data); return 0; }
    const items = (Array.isArray(data.runs) ? data.runs : Array.isArray(data.data) ? data.data : Array.isArray(data.items) ? data.items : []) as Array<Record<string, unknown>>;
    if (!items.length) { out.print("No runs yet."); return 0; }
    out.print(table(["RUN", "MODEL", "STATUS", "COST", "CREATED"], items.map(item => [String(item.id ?? item.run_id ?? ""), String(item.model ?? item.service_id ?? ""), String(item.status ?? ""), item.cost === undefined ? "" : `$${trimNumber(item.cost)}`, String(item.created_at ?? "")])));
    return 0;
  }
  throw new SandBaseError("USAGE", "Use `sandbase runs get -r <run_id>` or `sandbase runs list`.");
}

async function balance(argv: string[], out: Output, env: NodeJS.ProcessEnv, fetchImpl?: FetchLike): Promise<number> {
  const { values } = parse(argv, {});
  const api = await client(values, env, fetchImpl);
  const { data } = await api.tool("sandbase_account", {});
  if (out.json) { out.data(data); return 0; }
  out.print(`Balance: $${trimNumber(data.balance ?? "?")} ${String(data.currency ?? "USD")}${data.credit_limit ? `  (credit limit $${trimNumber(data.credit_limit)})` : ""}`);
  printHints(out, data.hints);
  return 0;
}

/** Shows at most a quarter of the key (capped at 6 chars) so short keys are not mostly revealed. */
export function maskKey(key: string): string {
  const visible = Math.min(6, Math.floor(key.length / 4));
  return visible >= 2 ? `${key.slice(0, Math.ceil(visible / 2) + 1)}…${key.slice(-Math.floor(visible / 2))}` : "…";
}
async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function keys(argv: string[], out: Output, env: NodeJS.ProcessEnv, deps: Pick<AgentDeps, "stdin">): Promise<number> {
  const [sub, ...rest] = argv;
  if (sub === "add") {
    const { values } = parse(rest, { key: { type: "string", short: "k" }, url: { type: "string" } });
    // `-k -` (or no -k with piped stdin) keeps the key out of shell history, `ps`, and agent transcripts.
    const key = (values.key === "-" || (values.key === undefined && deps.stdin) ? await (deps.stdin ?? readStdin)() : values.key ?? "").trim();
    if (!key) throw new SandBaseError("USAGE", "Pass the API key on stdin (`sandbase keys add -k -`) or with -k.", `Create one at ${keysUrl(env)}. Never paste API keys into an AI chat.`);
    if (values.url && !validMcpUrl(values.url)) throw new SandBaseError("USAGE", "--url must be an http(s) URL ending in /v1/mcp.");
    await atomicWrite(keyFilePath(env), JSON.stringify({ key, ...(values.url ? { mcpUrl: values.url } : {}), addedAt: new Date().toISOString() }, null, 2) + "\n", 0o600);
    const masked = maskKey(key);
    if (out.json) out.data({ saved: true, key: masked, path: keyFilePath(env) }); else out.print(`Saved API key ${masked} to ${keyFilePath(env)} (mode 600). Verify with: sandbase balance`);
    return 0;
  }
  if (sub === "list") {
    parse(rest, {});
    const stored = await readStoredKey(env);
    const entries = [...(env.SANDBASE_API_KEY ? [{ source: "env:SANDBASE_API_KEY", key: maskKey(env.SANDBASE_API_KEY), active: true }] : []), ...(stored ? [{ source: "keys", key: maskKey(stored.key), active: !env.SANDBASE_API_KEY }] : [])];
    if (out.json) { out.data({ keys: entries }); return 0; }
    out.print(entries.length ? table(["SOURCE", "KEY", "ACTIVE"], entries.map(entry => [entry.source, entry.key, entry.active ? "yes" : ""])) : `No API key stored. Connected clients from \`${CONNECT_COMMAND}\` are used automatically.`);
    return 0;
  }
  if (sub === "remove") {
    parse(rest, {});
    await rm(keyFilePath(env), { force: true });
    if (out.json) out.data({ removed: true }); else out.print("Removed the stored API key.");
    return 0;
  }
  throw new SandBaseError("USAGE", "Use `sandbase keys add -k <key>`, `sandbase keys list`, or `sandbase keys remove`.");
}

export async function runAgentCommand(command: AgentCommand, argv: string[], deps: AgentDeps = {}): Promise<number> {
  const env = deps.env || process.env;
  const json = argv.includes("-j") || argv.includes("--json");
  const out = new Output(json, deps.out || (text => process.stdout.write(`${text}\n`)), deps.err || (text => process.stderr.write(`${text}\n`)));
  const timing = { sleep: deps.sleep || (ms => new Promise<void>(resolve => setTimeout(resolve, ms))), now: deps.now || Date.now };
  const pendingNotice = command === "keys" ? Promise.resolve(undefined) : updateNotice(env);
  if (argv.includes("-h") || argv.includes("--help")) { out.print(agentUsage); return 0; }
  let code: number;
  try {
    const notice = async () => { const text = await Promise.race([pendingNotice, new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), 2500).unref())]); if (text) out.notice(text); };
    if (json) await notice();
    code = command === "discover" ? await discover(argv, out, env, deps.fetchImpl)
      : command === "inspect" ? await inspect(argv, out, env, deps.fetchImpl)
      : command === "run" ? await run(argv, out, env, timing, deps.fetchImpl)
      : command === "runs" ? await runs(argv, out, env, timing, deps.fetchImpl)
      : command === "balance" ? await balance(argv, out, env, deps.fetchImpl)
      : await keys(argv, out, env, deps);
    if (!json) await notice();
  } catch (error) {
    const failure = error instanceof SandBaseError ? error : new SandBaseError("TOOL_ERROR", (error instanceof Error ? error.message : "Unknown failure").replace(/(?:sk|cln)-[A-Za-z0-9_-]+/g, "[REDACTED]"));
    out.error(failure);
    code = failure.code === "USAGE" ? 2 : 1;
  }
  return code;
}
