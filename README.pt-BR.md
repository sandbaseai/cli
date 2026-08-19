<p align="center">
  <h1 align="center">@sandbaseai/cli</h1>
  <p align="center">
    <strong>Dê superpoderes ao seu agente de IA. Um comando. 2.000+ modelos de IA e APIs.</strong>
  </p>
  <p align="center">
    <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a> | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a> | <a href="./README.es.md">Español</a> | <a href="./README.fr.md">Français</a> | <a href="./README.de.md">Deutsch</a> | Português
  </p>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/sandbaseai/cli/main/.github/assets/sandbase-cli-hero.webp" alt="SandBase CLI MCP bridge" width="100%">
</p>

---

Seu assistente de codificação IA é inteligente, mas está preso em uma caixa. Ele não consegue pesquisar na web, verificar redes sociais, gerar imagens ou acessar dados em tempo real — a menos que você conecte cada API manualmente.

**SandBase muda isso.** Um comando conecta seu agente a 2.000+ modelos de IA e APIs pelo [MCP](https://modelcontextprotocol.io). Sem gerenciar chaves de API. Sem dor de cabeça.

```sh
npx -y @sandbaseai/cli connect
```

É isso. Seu agente agora tem acesso a tudo.

## Stack open source da SandBase

- **[SandBase Harness](https://github.com/sandbaseai/sandbase-harness)** — runtime de agentes auto-hospedado com sessões persistentes, isolamento, aprovações, auditoria e replay.
- **[SandBase Agent Skills](https://github.com/sandbaseai/sandbase-skills)** — 88 Skills instaláveis para pesquisa, inteligência social, marketing e fluxos de negócios.

---

## Veja em Ação

### "Busca tendências sobre IA no Twitter"

```
Agent → SandBase Twitter API → Top 10 posts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. @karpathy: "LLMs are the new CPUs..." (45K ❤️)
2. @emollick: "Agent benchmarks just crossed..." (12K ❤️)
...
```

### "Cria um logo minimalista para 'NightOwl'"

```
Agent → SandBase Flux → PNG 1024x1024
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Gerado: nightowl-logo.png
  Custo: $0,003 | Tempo: 2,1s
```

### "Extraia a tabela de preços do linear.app"

```
Agent → SandBase Firecrawl → Dados estruturados
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 3 planos extraídos:
  Free: $0/mês — 250 issues
  Standard: $8/usuário/mês — Ilimitado
  Plus: $14/usuário/mês — Recursos avançados
```

---

## Clientes compatíveis (25 destinos)

| Configuração automática | Configuração manual |
|------------------------|---------------------|
| Cursor, Claude Code, Codex | ChatGPT |
| Kiro IDE, Kiro CLI, Windsurf | Claude Desktop |
| Gemini CLI, Amp, Warp | |
| OpenCode, Qwen Code, Kimi CLI | |
| Hermes, OpenClaw | |

```sh
# Conectar todos os clientes detectados
npx -y @sandbaseai/cli connect

# Ou um cliente específico
npx -y @sandbaseai/cli connect --client cursor
```

---

## Comandos

```sh
sandbase connect [--client <name>]    # Autorizar + configurar
sandbase doctor [--client <name>]     # Verificação de saúde
sandbase unregister [--client <name>] # Remover configuração
sandbase catalog --json               # Listar clientes suportados
```

### Ferramentas MCP (disponíveis após conexão)

| Ferramenta | Propósito |
|------------|-----------|
| `sandbase_discover` | Pesquisar entre 2.000+ modelos e APIs |
| `sandbase_inspect` | Obter schema, preços e template |
| `sandbase_run` | Executar um modelo ou API |
| `sandbase_run_get` | Verificar status de tarefas assíncronas |
| `sandbase_runs` | Ver chamadas recentes e custos |
| `sandbase_account` | Verificar saldo (grátis) |

---

## Segurança

- **Zero segredos em URLs ou argumentos** — OAuth device flow + PKCE
- **Permissões de arquivo restritas** — Credenciais com `0600`
- **Rollback automático** — Se algo falhar, tudo é revertido
- **Revogar a qualquer momento** — [Dashboard SandBase](https://sandbase.ai/console/keys)

---

## Começar

```sh
npx -y @sandbaseai/cli connect
```

**[Criar conta grátis →](https://sandbase.ai)**

## Licença

Apache-2.0
