<p align="center">
  <h1 align="center">@sandbaseai/cli</h1>
  <p align="center">
    <strong>Dê superpoderes ao seu agente de IA. Um comando. 2.000+ modelos de IA e APIs.</strong>
  </p>
  <p align="center">
    <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a> | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a> | <a href="./README.es.md">Español</a> | <a href="./README.fr.md">Français</a> | <a href="./README.de.md">Deutsch</a> | Português
  </p>
  <p align="center">
    <a href="https://github.com/sandbaseai/cli/releases/latest"><img alt="Versão do GitHub" src="https://img.shields.io/github/v/release/sandbaseai/cli"></a>
    <a href="https://github.com/sandbaseai/cli/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sandbaseai/cli/actions/workflows/ci.yml/badge.svg"></a>
    <a href="https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.sandbaseai%2Fcli"><img alt="Registro MCP oficial" src="https://img.shields.io/badge/MCP%20Registry-listed-5a67d8"></a>
    <a href="https://github.com/sandbaseai/cli/blob/main/LICENSE"><img alt="Licença" src="https://img.shields.io/github/license/sandbaseai/cli"></a>
    <a href="https://github.com/sandbaseai/cli/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/sandbaseai/cli?style=social"></a>
  </p>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/sandbaseai/cli/main/.github/assets/sandbase-cli-hero.webp" alt="SandBase CLI MCP bridge" width="100%">
</p>

---

Seu assistente de codificação IA é inteligente, mas está preso em uma caixa. Ele não consegue pesquisar na web, verificar redes sociais, gerar imagens ou acessar dados em tempo real — a menos que você conecte cada API manualmente.

**SandBase muda isso.** Um comando conecta seu agente a 2.000+ modelos de IA e APIs pelo [MCP](https://modelcontextprotocol.io). Sem gerenciar chaves de API. Sem dor de cabeça.

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect
```

Ou instale a fórmula oficial do Homebrew no macOS ou Linux:

```sh
brew install sandbaseai/tap/sandbaseai-cli
sandbase connect
```

É isso. Seu agente agora tem acesso a tudo.

## Stack open source da SandBase

- **[SandBase Harness](https://github.com/sandbaseai/sandbase-harness)** — runtime de agentes auto-hospedado com sessões persistentes, isolamento, aprovações, auditoria e replay.
- **[SandBase Agent Skills](https://github.com/sandbaseai/sandbase-skills)** — 88 Skills instaláveis para pesquisa, inteligência social, marketing e fluxos de negócios.

---

## Fluxo de agente verificável

Depois de conectar, peça ao agente para seguir esta sequência auditável:

1. Use `sandbase_discover` para encontrar modelos ou APIs adequados.
2. Use `sandbase_inspect` para revisar o esquema de entrada, os preços atuais e os requisitos.
3. Confirme o endpoint, os parâmetros e o possível custo antes de chamar `sandbase_run`.
4. Para tarefas assíncronas, consulte `sandbase_run_get` com o `run_id` retornado.
5. Use `sandbase_runs` para revisar o status e o custo registrado das execuções recentes.
6. Use `sandbase_account` para verificar o saldo atual.

Comece, por exemplo, com uma solicitação de descoberta não faturável:

> Encontre modelos de imagem adequados para uma ilustração quadrada de produto. Compare as entradas e os preços atuais dos dois melhores candidatos. Não execute nenhum deles ainda.

Catálogo, preços, latência e disponibilidade podem mudar. Use a resposta atual das ferramentas em vez de valores estáticos de exemplo.

---

## Clientes compatíveis (25 destinos)

| Configuração automática | Configuração manual |
|------------------------|---------------------|
| Cursor, Claude Code, Codex | ChatGPT |
| Kiro IDE, Kiro CLI, Windsurf | Claude Desktop |
| Gemini CLI, Amp, Warp | |
| OpenCode, Qwen Code, Kimi CLI | |
| Hermes, OpenClaw | |

Quer verificar a compatibilidade antes de entrar ou alterar a configuração local? Execute o catálogo somente leitura para confirmar os 25 clientes compatíveis:

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz catalog --json
```

Esse comando usa o arquivo imutável da versão `v0.1.17` no GitHub. SHA-256:
`1ad535b2899ca460b57b3c268aef278fee28fd28e649a89b92951514fd71fffa`

A tag `latest` do npm ainda aponta para a v0.1.14; até a ativação do Trusted Publishing, use a URL versionada do GitHub acima.

```sh
# Conectar todos os clientes detectados
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect

# Ou um cliente específico
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect --client cursor
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
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect
```

**[Criar conta grátis →](https://sandbase.ai)**

Se o SandBase economizou seu tempo de configuração, [dê uma estrela ao projeto](https://github.com/sandbaseai/cli). Isso ajuda mais usuários de agentes a encontrá-lo.

## Guia prático

- [Claude Code e Codex: descobrir, conferir o preço e executar](https://github.com/sandbaseai/cli/discussions/54)
- [Registro MCP oficial](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.sandbaseai%2Fcli/versions/0.1.17)

## Licença

Apache-2.0
