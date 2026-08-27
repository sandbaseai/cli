<p align="center">
  <h1 align="center">@sandbaseai/cli</h1>
  <p align="center">
    <strong>Gib deinem KI-Agenten Superkräfte. Ein Befehl. 2.000+ KI-Modelle und APIs.</strong>
  </p>
  <p align="center">
    <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a> | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a> | <a href="./README.es.md">Español</a> | <a href="./README.fr.md">Français</a> | Deutsch | <a href="./README.pt-BR.md">Português</a>
  </p>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/sandbaseai/cli/main/.github/assets/sandbase-cli-hero.webp" alt="SandBase CLI MCP bridge" width="100%">
</p>

---

Dein KI-Coding-Assistent ist schlau, aber in einer Box gefangen. Er kann nicht im Web suchen, Social Media prüfen, Bilder generieren oder Echtzeitdaten abrufen — es sei denn, du verbindest jede API selbst.

**SandBase ändert das.** Ein Befehl verbindet deinen Agenten mit 2.000+ KI-Modellen und APIs über das [MCP](https://modelcontextprotocol.io). Keine API-Keys verwalten. Kein Konfigurationsaufwand.

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect
```

Das war's. Dein Agent hat jetzt Zugriff auf alles.

## SandBase Open-Source-Stack

- **[SandBase Harness](https://github.com/sandbaseai/sandbase-harness)** — selbst gehostete Agent-Runtime mit persistenten Sitzungen, Sandbox-Isolation, Freigaben, Audit und Replay.
- **[SandBase Agent Skills](https://github.com/sandbaseai/sandbase-skills)** — 88 installierbare Skills für Recherche, Social Intelligence, Marketing und Geschäftsabläufe.

---

## In Aktion

### "Suche nach KI-Trends auf Twitter"

```
Agent → SandBase Twitter API → Top 10 Posts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. @karpathy: "LLMs are the new CPUs..." (45K ❤️)
2. @emollick: "Agent benchmarks just crossed..." (12K ❤️)
...
```

### "Erstelle ein minimalistisches Logo für 'NightOwl'"

```
Agent → SandBase Flux → 1024x1024 PNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Generiert: nightowl-logo.png
  Kosten: $0,003 | Zeit: 2,1s
```

---

## Unterstützte Clients (25 Ziele)

| Automatische Konfiguration | Manuelle Konfiguration |
|---------------------------|----------------------|
| Cursor, Claude Code, Codex | ChatGPT |
| Kiro IDE, Kiro CLI, Windsurf | Claude Desktop |
| Gemini CLI, Amp, Warp | |
| OpenCode, Qwen Code, Kimi CLI | |

Möchtest du die Kompatibilität prüfen, bevor du dich anmeldest oder lokale Konfigurationen änderst? Mit dem schreibgeschützten Katalogbefehl kannst du die 25 unterstützten Clients überprüfen:

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz catalog --json
```

Der Befehl verwendet das unveränderliche GitHub-Release-Archiv `v0.1.17`. SHA-256-Prüfsumme:
`1ad535b2899ca460b57b3c268aef278fee28fd28e649a89b92951514fd71fffa`

Das npm-Tag `latest` verweist derzeit noch auf v0.1.14. Verwende bis zur Aktivierung von Trusted Publishing die oben angegebene versionierte GitHub-URL.

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect --client cursor
```

---

## Befehle

```sh
sandbase connect [--client <name>]    # Autorisieren + konfigurieren
sandbase doctor [--client <name>]     # Gesundheitscheck
sandbase unregister [--client <name>] # Konfiguration entfernen
sandbase catalog --json               # Unterstützte Clients auflisten
```

### MCP-Tools (nach Verbindung verfügbar)

| Tool | Zweck |
|------|-------|
| `sandbase_discover` | 2.000+ Modelle und APIs durchsuchen |
| `sandbase_inspect` | Schema, Preise und Vorlage abrufen |
| `sandbase_run` | Modell oder API ausführen |
| `sandbase_run_get` | Status asynchroner Aufgaben abfragen |
| `sandbase_runs` | Letzte API-Aufrufe und Kosten anzeigen |
| `sandbase_account` | Kontostand prüfen (kostenlos) |

---

## Sicherheit

- **Keine Secrets in URLs oder CLI-Argumenten** — OAuth Device Flow + PKCE
- **Eingeschränkte Dateiberechtigungen** — Anmeldedaten mit `0600` gespeichert
- **Automatischer Rollback** — Bei Fehler wird alles sauber zurückgesetzt
- **Jederzeit widerrufen** — [SandBase Dashboard](https://sandbase.ai/console/keys)

---

## Loslegen

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect
```

**[Kostenloses Konto erstellen →](https://sandbase.ai)**

## Praktische Anleitung

- [Claude Code und Codex: entdecken, Preis prüfen und ausführen](https://github.com/sandbaseai/cli/discussions/53)
- [Offizielle MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.sandbaseai%2Fcli/versions/0.1.17)

## Lizenz

Apache-2.0
