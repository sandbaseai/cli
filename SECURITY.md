# Security Policy

SandBase CLI configures MCP clients and stores local credentials, so security and configuration ownership are treated as product requirements.

## Supported versions

Security fixes are released in the latest version published under the `latest` npm tag. Upgrade before reporting an issue that may already be fixed:

```sh
npx -y @sandbaseai/cli@latest doctor
```

## Reporting a vulnerability

Open a minimal [security triage issue](https://github.com/sandbaseai/cli/issues/new) that describes the affected command and impact without including secrets, working exploit details, or private user data. A maintainer will move sensitive follow-up to a private channel.

For ordinary bugs that do not expose credentials or cross a security boundary, use the regular issue tracker and include reproducible steps.

## What to expect

We will acknowledge actionable reports, assess affected versions, and coordinate a fix and disclosure. Please give maintainers reasonable time to investigate before publishing exploit details.

Do not test against accounts, systems, or data you do not own or have explicit permission to use.
