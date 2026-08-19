# Contributing to SandBase CLI

Thanks for helping make AI tools easier to connect. Bug reports, client compatibility fixes, documentation improvements, and focused feature proposals are welcome.

## Before you start

- Search the existing issues and pull requests before opening a duplicate.
- Keep changes focused. Separate unrelated fixes into separate pull requests.
- Never include API keys, access tokens, credentials, or private configuration files in an issue, test fixture, or commit.

## Local development

SandBase CLI requires Node.js 20 or newer.

```sh
git clone https://github.com/sandbaseai/cli.git
cd cli
npm ci --ignore-scripts
npm run lint
npm test
npm run audit:package
```

The package audit verifies the exact files that would be included in the npm tarball. Run it whenever a change affects build output, package metadata, or release configuration.

## Pull requests

A useful pull request includes:

- a concise explanation of the user-facing problem;
- tests for behavior changes and regressions;
- documentation updates when commands, clients, or configuration change;
- confirmation that lint, tests, and the package audit pass locally.

Client adapters must preserve user-managed configuration, reject ambiguous ownership, and roll back only state created by SandBase. Do not weaken these guarantees to add a new client.

By contributing, you agree that your contribution is licensed under the repository's Apache-2.0 license.
