<p align="center">
  <h1 align="center">@sandbaseai/cli</h1>
  <p align="center">
    <strong>Dale superpoderes a tu agente de IA. Un comando. 2,000+ herramientas.</strong>
  </p>
  <p align="center">
    <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a> | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a> | Español | <a href="./README.fr.md">Français</a> | <a href="./README.de.md">Deutsch</a> | <a href="./README.pt-BR.md">Português</a>
  </p>
</p>

---

Tu asistente de codificación IA es inteligente, pero está atrapado en una caja. No puede buscar en la web, revisar redes sociales, generar imágenes ni acceder a datos en tiempo real — a menos que conectes cada API manualmente.

**SandBase cambia eso.** Un comando conecta tu agente a 2,000+ herramientas y 200+ modelos de IA a través del [MCP](https://modelcontextprotocol.io). Sin gestionar claves API. Sin dolores de cabeza de configuración.

```sh
npx -y @sandbaseai/cli connect
```

Eso es todo. Tu agente ahora tiene acceso a todo.

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

## Clientes Soportados (17+)

| Configuración automática | Configuración manual |
|--------------------------|---------------------|
| Cursor, Claude Code, Codex | ChatGPT |
| Kiro IDE, Kiro CLI, Windsurf | Claude Desktop |
| Gemini CLI, Amp, Warp | |
| OpenCode, Qwen Code, Kimi CLI | |
| Hermes, OpenClaw | |

```sh
# Conectar todos los clientes detectados
npx -y @sandbaseai/cli connect

# O uno específico
npx -y @sandbaseai/cli connect --client cursor
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
| `sandbase_discover` | Buscar entre 2,000+ modelos y APIs |
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
npx -y @sandbaseai/cli connect
```

**[Crear cuenta gratis →](https://sandbase.ai)**

## Licencia

Apache-2.0
