# Security Policy

SandBase CLI configures MCP clients and stores local credentials, so security and configuration ownership are treated as product requirements.

## Supported versions

Security fixes are provided in the latest verified GitHub release. The npm `latest` tag may temporarily lag while trusted publishing is being enabled.

| Version | Supported |
| --- | --- |
| [v0.1.17](https://github.com/sandbaseai/cli/releases/tag/v0.1.17) | Yes |
| Earlier versions | No |

Install or diagnose the supported release from its immutable artifact:

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz doctor
```

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/sandbaseai/cli/security/advisories/new). Include the affected command and version, impact, reproduction steps, and sanitized diagnostic output.

Do not open a public Issue for vulnerabilities. Never include API keys, access tokens, credentials, private configuration, working exploit details, or user data in public discussions.

For ordinary bugs that do not expose credentials or cross a security boundary, use the [bug report form](https://github.com/sandbaseai/cli/issues/new?template=bug-report.yml).

## What to expect

Maintainers will acknowledge actionable reports, assess affected versions, and coordinate a fix and disclosure through the private advisory. Please allow reasonable time to investigate before publishing exploit details.

Do not test against accounts, systems, or data you do not own or have explicit permission to use.
