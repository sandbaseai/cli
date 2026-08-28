<p align="center">
  <h1 align="center">@sandbaseai/cli</h1>
  <p align="center">
    <strong>Donnez des super-pouvoirs à votre agent IA. Une commande. 2 000+ modèles IA et APIs.</strong>
  </p>
  <p align="center">
    <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a> | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a> | <a href="./README.es.md">Español</a> | Français | <a href="./README.de.md">Deutsch</a> | <a href="./README.pt-BR.md">Português</a>
  </p>
  <p align="center">
    <a href="https://github.com/sandbaseai/cli/releases/latest"><img alt="Version GitHub" src="https://img.shields.io/github/v/release/sandbaseai/cli"></a>
    <a href="https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.sandbaseai%2Fcli"><img alt="Registre MCP officiel" src="https://img.shields.io/badge/MCP%20Registry-listed-5a67d8"></a>
    <a href="https://github.com/sandbaseai/cli/blob/main/LICENSE"><img alt="Licence" src="https://img.shields.io/github/license/sandbaseai/cli"></a>
    <a href="https://github.com/sandbaseai/cli/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/sandbaseai/cli?style=social"></a>
  </p>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/sandbaseai/cli/main/.github/assets/sandbase-cli-hero.webp" alt="SandBase CLI MCP bridge" width="100%">
</p>

---

Votre assistant de codage IA est intelligent, mais il est enfermé dans une boîte. Il ne peut pas chercher sur le web, consulter les réseaux sociaux, générer des images ou accéder aux données en temps réel — sauf si vous connectez chaque API vous-même.

**SandBase change la donne.** Une commande connecte votre agent à 2 000+ modèles IA et APIs via le [MCP](https://modelcontextprotocol.io). Pas de clés API à gérer. Pas de prise de tête.

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect
```

Ou installez la formule Homebrew officielle sur macOS ou Linux :

```sh
brew install sandbaseai/tap/sandbaseai-cli
sandbase connect
```

C'est tout. Votre agent a maintenant accès à tout.

## Stack open source SandBase

- **[SandBase Harness](https://github.com/sandbaseai/sandbase-harness)** — runtime d'agents auto-hébergé avec sessions persistantes, isolation, approbations, audit et relecture.
- **[SandBase Agent Skills](https://github.com/sandbaseai/sandbase-skills)** — 88 Skills installables pour la recherche, la veille sociale, le marketing et les workflows métier.

---

## Workflow agent vérifiable

Après la connexion, demandez à votre agent de suivre cette séquence vérifiable :

1. Utiliser `sandbase_discover` pour trouver les modèles ou API adaptés.
2. Utiliser `sandbase_inspect` pour lire le schéma d’entrée, les tarifs actuels et les prérequis.
3. Confirmer l’endpoint, les paramètres et le coût potentiel avant d’appeler `sandbase_run`.
4. Pour les tâches asynchrones, interroger `sandbase_run_get` avec le `run_id` retourné.
5. Utiliser `sandbase_runs` pour vérifier l’état et le coût enregistré des exécutions récentes.
6. Utiliser `sandbase_account` pour consulter le solde actuel.

Commencez, par exemple, par une recherche non facturable :

> Trouve des modèles d’image adaptés à une illustration produit carrée. Compare les entrées requises et les tarifs actuels des deux meilleurs candidats. Ne lance encore aucun modèle.

Le catalogue, les prix, la latence et la disponibilité peuvent évoluer. Utilisez la réponse actuelle des outils plutôt que des valeurs d’exemple statiques.

---

## Clients pris en charge (25 cibles)

| Configuration auto | Configuration manuelle |
|-------------------|----------------------|
| Cursor, Claude Code, Codex | ChatGPT |
| Kiro IDE, Kiro CLI, Windsurf | Claude Desktop |
| Gemini CLI, Amp, Warp | |
| OpenCode, Qwen Code, Kimi CLI | |
| Hermes, OpenClaw | |

Vous voulez vérifier la compatibilité avant de vous connecter ou de modifier la configuration locale ? Exécutez le catalogue en lecture seule pour confirmer les 25 clients pris en charge :

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz catalog --json
```

Cette commande utilise l’archive immuable de la version GitHub `v0.1.17`. SHA-256 :
`1ad535b2899ca460b57b3c268aef278fee28fd28e649a89b92951514fd71fffa`

Le tag npm `latest` pointe encore vers la v0.1.14 ; jusqu’à l’activation de Trusted Publishing, utilisez l’URL GitHub versionnée ci-dessus.

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect --client cursor
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
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect
```

**[Créer un compte gratuit →](https://sandbase.ai)**

Si SandBase vous fait gagner du temps de configuration, [ajoutez une étoile au projet](https://github.com/sandbaseai/cli). Cela aidera d’autres utilisateurs d’agents à le découvrir.

## Guide pratique

- [Claude Code et Codex : découvrir, vérifier le prix, puis exécuter](https://github.com/sandbaseai/cli/discussions/52)
- [Registre MCP officiel](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.sandbaseai%2Fcli/versions/0.1.17)

## Licence

Apache-2.0
