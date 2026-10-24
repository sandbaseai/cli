<p align="center">
  <h1 align="center">@sandbaseai/cli</h1>
  <p align="center">
    <strong>Gib deinem KI-Agenten Superkräfte. Ein Befehl. 2.000+ KI-Modelle und APIs.</strong>
  </p>
  <p align="center">
    <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a> | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a> | <a href="./README.es.md">Español</a> | <a href="./README.fr.md">Français</a> | Deutsch | <a href="./README.pt-BR.md">Português</a>
  </p>
  <p align="center">
    <a href="https://github.com/sandbaseai/cli/releases/latest"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/sandbaseai/cli"></a>
    <a href="https://github.com/sandbaseai/cli/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sandbaseai/cli/actions/workflows/ci.yml/badge.svg"></a>
    <a href="https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.sandbaseai%2Fcli"><img alt="Offizielle MCP Registry" src="https://img.shields.io/badge/MCP%20Registry-listed-5a67d8"></a>
    <a href="https://github.com/sandbaseai/cli/blob/main/LICENSE"><img alt="Lizenz" src="https://img.shields.io/github/license/sandbaseai/cli"></a>
    <a href="https://github.com/sandbaseai/cli/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/sandbaseai/cli?style=social"></a>
  </p>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/sandbaseai/cli/main/.github/assets/sandbase-cli-hero.webp" alt="SandBase CLI MCP bridge" width="100%">
</p>

---

Dein KI-Coding-Assistent ist schlau, aber in einer Box gefangen. Er kann nicht im Web suchen, Social Media prüfen, Bilder generieren oder Echtzeitdaten abrufen — es sei denn, du verbindest jede API selbst.

**SandBase ändert das.** Ein Befehl verbindet deinen Agenten mit 2.000+ KI-Modellen und APIs über das [MCP](https://modelcontextprotocol.io). Keine API-Keys verwalten. Kein Konfigurationsaufwand.

Füge diese Zeile in deinen Agent ein, er übernimmt den Rest: Er liest die Skill, führt `connect` selbst aus und bittet dich nur, die Anmeldung im Browser zu bestätigen:

```
set up https://www.sandbase.ai/SKILL.md
```

Wenn du es selbst machen willst:

```sh
npx -y @sandbaseai/cli@latest connect
```

Oder installiere die offizielle Homebrew-Formel unter macOS oder Linux:

```sh
brew install sandbaseai/tap/sandbaseai-cli
sandbase connect
```

Das war's. Dein Agent hat jetzt Zugriff auf alles.

## SandBase Open-Source-Stack

- **[SandBase Harness](https://github.com/sandbaseai/sandbase-harness)** — selbst gehostete Agent-Runtime mit persistenten Sitzungen, Sandbox-Isolation, Freigaben, Audit und Replay.
- **[SandBase Agent Skills](https://github.com/sandbaseai/sandbase-skills)** — 88 installierbare Skills für Recherche, Social Intelligence, Marketing und Geschäftsabläufe.

---

## Verifizierbarer Agent-Workflow

Bitte deinen Agenten nach dem Verbinden, diese nachvollziehbare Reihenfolge zu verwenden:

1. Mit `sandbase_discover` passende Modelle oder APIs suchen.
2. Mit `sandbase_inspect` Eingabeschema, aktuelle Preise und Anforderungen prüfen.
3. Endpunkt, Parameter und mögliche Kosten bestätigen, bevor `sandbase_run` ausgeführt wird.
4. Asynchrone Aufrufe mit `sandbase_run_get` und der zurückgegebenen `run_id` verfolgen.
5. Mit `sandbase_runs` Status und erfasste Kosten kürzlich ausgeführter Aufrufe prüfen.
6. Mit `sandbase_account` den aktuellen Kontostand prüfen.

Beginne zum Beispiel mit einer nicht abrechenbaren Suchanfrage:

> Finde Bildmodelle für eine quadratische Produktillustration. Vergleiche Eingaben und aktuelle Preise der zwei besten Kandidaten. Führe noch kein Modell aus.

Katalog, Preise, Latenz und Verfügbarkeit können sich ändern. Verwende daher die aktuelle Tool-Antwort statt statischer Beispielwerte.

---

## Unterstützte Clients (25 Ziele)

| Automatische Konfiguration | Manuelle Konfiguration |
|---------------------------|----------------------|
| Cursor, Claude Code, Codex | ChatGPT |
| Kiro IDE, Kiro CLI, Windsurf | Claude Desktop |
| Gemini CLI, Amp, Warp | |
| OpenCode, Qwen Code, Kimi CLI | |
| Hermes, OpenClaw | |

Möchtest du die Kompatibilität prüfen, bevor du dich anmeldest oder lokale Konfigurationen änderst? Mit dem schreibgeschützten Katalogbefehl kannst du die 25 unterstützten Clients überprüfen:

```sh
npx -y @sandbaseai/cli@latest catalog --json
```

Jedes GitHub-Release veröffentlicht seinen eigenen SHA-256, sodass du einen exakten Build pinnen und prüfen kannst.

```sh
npx -y @sandbaseai/cli@latest connect
npx -y @sandbaseai/cli@latest connect --client cursor
```

---

## Preise

- Daten-APIs (Suche, Social Media, Scraping, E-Commerce, Finanzen) werden pro Aufruf berechnet, zum Preis, den `sandbase inspect` anzeigt.
- Suchen, Inspizieren, Laufstatus, Guthaben und Datei-Upload sind kostenlos.
- Modelle (LLM, Bild, Video, Audio) werden pro Aufruf oder pro Million Tokens berechnet.

`sandbase inspect <tool>` zeigt immer den aktuellen Preis; Preise können sich ändern — verlasse dich auf die echte Antwort.

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
npx -y @sandbaseai/cli@latest connect
```

**[Konto erstellen →](https://sandbase.ai)**

Wenn SandBase dir Einrichtungszeit spart, [gib dem Projekt einen Star](https://github.com/sandbaseai/cli). So können weitere Agent-Nutzer es leichter entdecken.

## Praktische Anleitung

- [Claude Code und Codex: entdecken, Preis prüfen und ausführen](https://github.com/sandbaseai/cli/discussions/53)
- [Offizielle MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.sandbaseai%2Fcli)

## Lizenz

Apache-2.0
