<p align="center">
  <h1 align="center">@sandbaseai/cli</h1>
  <p align="center">
    <strong>Donnez des super-pouvoirs à votre agent IA. Une commande. 2 000+ outils.</strong>
  </p>
  <p align="center">
    <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a> | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a> | <a href="./README.es.md">Español</a> | Français | <a href="./README.de.md">Deutsch</a> | <a href="./README.pt-BR.md">Português</a>
  </p>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/sandbaseai/cli/main/.github/assets/sandbase-cli-hero.webp" alt="SandBase CLI MCP bridge" width="100%">
</p>

---

Votre assistant de codage IA est intelligent, mais il est enfermé dans une boîte. Il ne peut pas chercher sur le web, consulter les réseaux sociaux, générer des images ou accéder aux données en temps réel — sauf si vous connectez chaque API vous-même.

**SandBase change la donne.** Une commande connecte votre agent à 2 000+ outils et 200+ modèles IA via le [MCP](https://modelcontextprotocol.io). Pas de clés API à gérer. Pas de prise de tête.

```sh
npx -y @sandbaseai/cli connect
```

C'est tout. Votre agent a maintenant accès à tout.

---

## En Action

### "Cherche les tendances IA sur Twitter"

```
Agent → SandBase Twitter API → Top 10 publications
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. @karpathy: "LLMs are the new CPUs..." (45K ❤️)
2. @emollick: "Agent benchmarks just crossed..." (12K ❤️)
...
```

### "Génère un logo minimaliste pour 'NightOwl'"

```
Agent → SandBase Flux → PNG 1024x1024
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Généré : nightowl-logo.png
  Coût : 0,003 $ | Temps : 2,1 s
```

---

## Clients Supportés (17+)

| Configuration auto | Configuration manuelle |
|-------------------|----------------------|
| Cursor, Claude Code, Codex | ChatGPT |
| Kiro IDE, Kiro CLI, Windsurf | Claude Desktop |
| Gemini CLI, Amp, Warp | |
| OpenCode, Qwen Code, Kimi CLI | |

```sh
npx -y @sandbaseai/cli connect
npx -y @sandbaseai/cli connect --client cursor
```

---

## Commandes

```sh
sandbase connect [--client <name>]    # Autoriser + configurer
sandbase doctor [--client <name>]     # Vérification
sandbase unregister [--client <name>] # Supprimer la configuration
sandbase catalog --json               # Lister les clients
```

### Outils MCP (disponibles après connexion)

| Outil | Usage |
|-------|-------|
| `sandbase_discover` | Rechercher parmi 2 000+ modèles et APIs |
| `sandbase_inspect` | Obtenir le schéma, les prix et le modèle d'exécution |
| `sandbase_run` | Exécuter un modèle ou une API |
| `sandbase_run_get` | Vérifier le statut des tâches asynchrones |
| `sandbase_runs` | Voir les appels récents et les coûts |
| `sandbase_account` | Vérifier le solde (gratuit) |

---

## Sécurité

- **Zéro secret dans les URLs ou arguments** — OAuth device flow + PKCE
- **Permissions de fichier restreintes** — Identifiants en `0600`
- **Rollback automatique** — En cas d'échec, tout est restauré
- **Révocation à tout moment** — [Dashboard SandBase](https://sandbase.ai/console/keys)

---

## Commencer

```sh
npx -y @sandbaseai/cli connect
```

**[Créer un compte gratuit →](https://sandbase.ai)**

## Licence

Apache-2.0
