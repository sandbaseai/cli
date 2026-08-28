<p align="center">
  <h1 align="center">@sandbaseai/cli</h1>
  <p align="center">
    <strong>AI 에이전트에 초능력을. 한 줄 명령어로 2,000개 이상의 AI 모델과 API.</strong>
  </p>
  <p align="center">
    <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a> | <a href="./README.ja.md">日本語</a> | 한국어 | <a href="./README.es.md">Español</a> | <a href="./README.fr.md">Français</a> | <a href="./README.de.md">Deutsch</a> | <a href="./README.pt-BR.md">Português</a>
  </p>
  <p align="center">
    <a href="https://github.com/sandbaseai/cli/releases/latest"><img alt="GitHub 릴리스" src="https://img.shields.io/github/v/release/sandbaseai/cli"></a>
    <a href="https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.sandbaseai%2Fcli"><img alt="공식 MCP Registry" src="https://img.shields.io/badge/MCP%20Registry-listed-5a67d8"></a>
    <a href="https://github.com/sandbaseai/cli/blob/main/LICENSE"><img alt="라이선스" src="https://img.shields.io/github/license/sandbaseai/cli"></a>
    <a href="https://github.com/sandbaseai/cli/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/sandbaseai/cli?style=social"></a>
  </p>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/sandbaseai/cli/main/.github/assets/sandbase-cli-hero.webp" alt="SandBase CLI MCP bridge" width="100%">
</p>

---

AI 코딩 어시스턴트는 똑똑하지만 상자 안에 갇혀 있습니다. 웹 검색, SNS 확인, 이미지 생성, 실시간 데이터 접근 — 직접 각 API를 연결하지 않으면 불가능합니다.

**SandBase가 이를 바꿉니다.** 한 줄 명령어로 에이전트를 2,000개 이상의 AI 모델과 API에 [MCP](https://modelcontextprotocol.io)를 통해 연결합니다. API 키 관리 불필요. 설정 고민 없음.

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect
```

이게 전부입니다. 에이전트가 이제 모든 것에 접근할 수 있습니다.

## SandBase 오픈 소스 스택

- **[SandBase Harness](https://github.com/sandbaseai/sandbase-harness)** — 영구 세션, 샌드박스 격리, 승인, 감사 및 재생을 제공하는 셀프 호스팅 에이전트 런타임입니다.
- **[SandBase Agent Skills](https://github.com/sandbaseai/sandbase-skills)** — 리서치, 소셜 인텔리전스, 마케팅 및 비즈니스 워크플로를 위한 설치형 Skills 88개입니다.

---

## 검증 가능한 에이전트 워크플로

연결 후 에이전트가 다음과 같이 확인 가능한 순서를 따르도록 요청하세요.

1. `sandbase_discover`로 작업에 맞는 모델이나 API를 찾습니다.
2. `sandbase_inspect`로 입력 스키마, 현재 가격, 실행 요구사항을 확인합니다.
3. `sandbase_run`을 호출하기 전에 endpoint, 파라미터, 예상 비용을 확인합니다.
4. 비동기 작업은 반환된 `run_id`로 `sandbase_run_get`을 조회합니다.
5. `sandbase_runs`로 최근 실행 상태와 기록된 비용을 검토합니다.
6. `sandbase_account`로 현재 계정 잔액을 확인합니다.

예를 들어 과금되지 않는 검색 요청부터 시작하세요.

> 정사각형 제품 일러스트에 적합한 이미지 모델을 찾고, 상위 두 후보의 필수 입력과 현재 가격을 비교해 줘. 아직 모델을 실행하지 마.

카탈로그, 가격, 지연 시간, 가용성은 바뀔 수 있습니다. 고정된 예시 값 대신 현재 세션의 도구 응답을 사용하세요.

---

## 지원 클라이언트 (25개 대상)

| 자동 설정 | 수동 설정 |
|----------|----------|
| Cursor, Claude Code, Codex | ChatGPT |
| Kiro IDE, Kiro CLI, Windsurf | Claude Desktop |
| Gemini CLI, Amp, Warp | |
| OpenCode, Qwen Code, Kimi CLI | |
| Hermes, OpenClaw | |

로그인하거나 로컬 설정을 변경하지 않고 먼저 호환성만 확인하려면 읽기 전용 카탈로그 명령으로 현재 지원되는 25개 클라이언트를 확인하세요:

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz catalog --json
```

이 명령은 변경되지 않는 GitHub `v0.1.17` 릴리스 아카이브를 사용합니다. SHA-256:
`1ad535b2899ca460b57b3c268aef278fee28fd28e649a89b92951514fd71fffa`

npm의 `latest` 태그는 아직 v0.1.14이므로 Trusted Publishing이 활성화될 때까지 위의 버전 고정 GitHub URL을 사용하세요.

```sh
# 감지된 모든 클라이언트 한번에 연결
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect

# 특정 클라이언트 지정
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect --client cursor
```

---

## 명령어

### CLI 명령어

```sh
sandbase connect [--client <name>]    # 인증 + 설정
sandbase doctor [--client <name>]     # 상태 확인
sandbase unregister [--client <name>] # 설정 제거
sandbase catalog --json               # 지원 클라이언트 목록
```

### MCP 도구 (연결 후 에이전트가 사용)

| 도구 | 용도 |
|------|------|
| `sandbase_discover` | 2,000+ AI 모델 및 API 검색 |
| `sandbase_inspect` | 입력 스키마, 가격, 실행 템플릿 확인 |
| `sandbase_run` | 모델 또는 API 실행 |
| `sandbase_run_get` | 비동기 작업 상태/결과 조회 |
| `sandbase_runs` | 최근 API 호출 및 비용 확인 |
| `sandbase_account` | 계정 잔액 확인 (무료) |

---

## 보안

- **URL이나 CLI 인수에 시크릿 없음** — OAuth device flow + PKCE
- **제한된 파일 권한** — 인증 정보 `0600`으로 저장
- **자동 롤백** — 실패 시 모든 것이 깨끗하게 복원
- **언제든 취소** — [SandBase Dashboard](https://sandbase.ai/console/keys)에서 원클릭

---

## 시작하기

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect
```

**[무료 계정 만들기 →](https://sandbase.ai)**

## 실전 가이드

- [Claude Code·Codex: 모델/API 탐색, 가격 확인, 실행](https://github.com/sandbaseai/cli/discussions/51)
- [공식 MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.sandbaseai%2Fcli/versions/0.1.17)

## 라이선스

Apache-2.0
