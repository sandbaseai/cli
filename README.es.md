<p align="center">
  <h1 align="center">@sandbaseai/cli</h1>
  <p align="center">
    <strong>Dale superpoderes a tu agente de IA. Un comando. 2,000+ modelos y API de IA.</strong>
  </p>
  <p align="center">
    <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a> | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a> | Español | <a href="./README.fr.md">Français</a> | <a href="./README.de.md">Deutsch</a> | <a href="./README.pt-BR.md">Português</a>
  </p>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/sandbaseai/cli/main/.github/assets/sandbase-cli-hero.webp" alt="SandBase CLI MCP bridge" width="100%">
</p>

---

Tu asistente de codificación IA es inteligente, pero está atrapado en una caja. No puede buscar en la web, revisar redes sociales, generar imágenes ni acceder a datos en tiempo real — a menos que conectes cada API manualmente.

**SandBase cambia eso.** Un comando conecta tu agente a 2,000+ modelos y API de IA a través del [MCP](https://modelcontextprotocol.io). Sin gestionar claves API. Sin dolores de cabeza de configuración.

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect
```

Eso es todo. Tu agente ahora tiene acceso a todo.

## Stack open source de SandBase

- **[SandBase Harness](https://github.com/sandbaseai/sandbase-harness)** — runtime de agentes autohospedado con sesiones persistentes, aislamiento, aprobaciones, auditoría y reproducción.
- **[SandBase Agent Skills](https://github.com/sandbaseai/sandbase-skills)** — 88 Skills instalables para investigación, inteligencia social, marketing y flujos de negocio.

---

## Míralo en Acción

### "Busca tendencias sobre IA en Twitter"

```
Agent → SandBase Twitter API → Top 10 posts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. @karpathy: "LLMs are the new CPUs..." (45K ❤️)
2. @emollick: "Agent benchmarks just crossed..." (12K ❤️)
...
```

### "Genera un logo minimalista para 'NightOwl'"

```
Agent → SandBase Flux → 1024x1024 PNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Generado: nightowl-logo.png
  Costo: $0.003 | Tiempo: 2.1s
```

### "Extrae la tabla de precios de linear.app"

```
Agent → SandBase Firecrawl → Datos estructurados
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 3 planes extraídos:
  Free: $0/mes — 250 issues
  Standard: $8/usuario/mes — Ilimitado
  Plus: $14/usuario/mes — Funciones avanzadas
```

---

## Clientes compatibles (25 destinos)

| Configuración automática | Configuración manual |
|--------------------------|---------------------|
| Cursor, Claude Code, Codex | ChatGPT |
| Kiro IDE, Kiro CLI, Windsurf | Claude Desktop |
| Gemini CLI, Amp, Warp | |
| OpenCode, Qwen Code, Kimi CLI | |
| Hermes, OpenClaw | |

¿Quieres comprobar la compatibilidad antes de iniciar sesión o modificar la configuración local? Ejecuta el catálogo de solo lectura para verificar los 25 clientes compatibles:

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz catalog --json
```

Este comando usa el archivo inmutable de la versión `v0.1.17` en GitHub. SHA-256:
`1ad535b2899ca460b57b3c268aef278fee28fd28e649a89b92951514fd71fffa`

La etiqueta `latest` de npm todavía apunta a v0.1.14; hasta que se habilite Trusted Publishing, usa la URL versionada de GitHub anterior.

```sh
# Conectar todos los clientes detectados
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect

# O uno específico
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect --client cursor
```

---

## Comandos

```sh
sandbase connect [--client <name>]    # Autorizar + configurar
sandbase doctor [--client <name>]     # Verificación de salud
sandbase unregister [--client <name>] # Eliminar configuración
sandbase catalog --json               # Listar clientes soportados
```

### Herramientas MCP (disponibles para tu agente después de conectar)

| Herramienta | Propósito |
|-------------|-----------|
| `sandbase_discover` | Buscar entre 2,000+ modelos y API de IA |
| `sandbase_inspect` | Obtener esquema, precios y plantilla |
| `sandbase_run` | Ejecutar un modelo o API |
| `sandbase_run_get` | Consultar estado de tareas asíncronas |
| `sandbase_runs` | Ver llamadas recientes y costos |
| `sandbase_account` | Verificar saldo (gratis) |

---

## Seguridad

- **Cero secretos en URLs o argumentos CLI** — OAuth device flow + PKCE
- **Permisos de archivo restringidos** — Credenciales guardadas con `0600`
- **Rollback automático** — Si algo falla, todo se revierte
- **Revocar en cualquier momento** — Un clic en el [Dashboard](https://sandbase.ai/console/keys)

---

## Comenzar

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect
```

**[Crear cuenta gratis →](https://sandbase.ai)**

## Licencia

Apache-2.0
