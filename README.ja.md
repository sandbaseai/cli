# @sandbaseai/cli

[English](./README.md) | [中文](./README.zh-CN.md) | 日本語

たった1つのコマンドで、AIコーディングエージェントを [SandBase](https://sandbase.ai) に接続 — 2,000以上のAPI、モデル、データソースに統一されたMCPゲートウェイを通じてアクセスできます。

## SandBaseを選ぶ理由

SandBaseは、AIコーディングアシスタントと必要なツールを橋渡しする統合MCP（Model Context Protocol）ブリッジです：

- **2,000以上のツール** — Web検索、SNS、EC、暗号通貨、金融、天気、旅行など
- **200以上のAIモデル** — GPT-4o、Claude、Gemini、Llama、Qwen、画像/動画/音声生成
- **認証は一度だけ** — サービスごとのAPIキー管理は不要。CLIで一度認証するだけ
- **プライバシー重視** — シークレットがコマンドライン引数やURLに表示されることはありません

## クイックスタート

### 前提条件

- Node.js 20以降
- [SandBase](https://sandbase.ai) アカウント（無料枠あり）

### 1. クライアントを接続

```sh
npx -y @sandbaseai/cli connect
```

ブラウザでSandBaseの認証ページが開きます。承認後、CLIが検出されたすべてのクライアントのMCPを自動設定します。

特定のクライアントを指定する場合：

```sh
npx -y @sandbaseai/cli connect --client cursor
```

### 2. 接続を確認

```sh
npx -y @sandbaseai/cli doctor --client cursor
```

### 3. SandBaseツールを使い始める

接続されたクライアントで、自然言語で依頼するだけ：

> 「Next.js 15の最新機能をWeb検索して。」

> 「イーロン・マスクの最新10件のツイートを取得して。」

> 「サイバーパンク風の夜の都市画像を生成して。」

> 「stripe.comの料金ページをスクレイピングして要約して。」

---

## 接続後にできること

接続後、AIエージェントはMCPを通じてSandBaseの全ツールに透過的にアクセスできます。実際の使用例：

### Web検索・スクレイピング

```
あなた: "GPT-5のリリース時期について最新ニュースを検索して"

Agent: [SandBase Web検索を使用]
→ 直近1週間の10件の結果:
  1. "OpenAI、2025年Q3にGPT-5発表見込み" - TechCrunch
  2. "GPT-5ベンチマーク流出..." - The Verge
  ...
```

### SNSデータ

```
あなた: "TwitterでAIエージェントについてのトレンド投稿を取得して"

Agent: [SandBase Twitter APIを使用]
→ 24時間以内のトップ10投稿:
  1. @kaborshik: "AI agents are replacing entire SaaS workflows..." (12.4K いいね)
  2. @emollick: "The speed of agent improvement is remarkable..." (8.2K いいね)
  ...
```

### 画像・動画生成

```
あなた: "'ByteBrew'というカフェのロゴを生成して。ミニマルスタイルで"

Agent: [SandBase Flux画像生成を使用]
→ 生成画像: [bytebrew-logo.png]
  スタイル: ミニマル
  解像度: 1024x1024
  コスト: $0.003
```

### LLM推論（200以上のモデル）

```
あなた: "DeepSeekを使ってこのコードのセキュリティ脆弱性を分析して"

Agent: [SandBase DeepSeekモデルを使用]
→ 3つの潜在的な問題を発見:
  1. 42行目にSQLインジェクション - ユーザー入力が未サニタイズ
  2. 78行目にハードコードされたシークレット
  3. /api/authエンドポイントにレート制限なし
```

### 暗号通貨・金融

```
あなた: "ビットコインとイーサリアムの現在の価格は？"

Agent: [SandBase暗号通貨市場APIを使用]
→ BTC: $67,234.50 (+2.3% 24h)
→ ETH: $3,456.78 (+1.8% 24h)
  更新: 2分前
```

---

## 対応クライアント

| クライアント | モード | コマンド |
|-------------|--------|---------|
| Codex | 自動 | `npx -y @sandbaseai/cli connect --client codex` |
| Claude Code | 自動 | `npx -y @sandbaseai/cli connect --client claude-code` |
| Cursor | 自動 | `npx -y @sandbaseai/cli connect --client cursor` |
| Cursor CLI | 自動 | `npx -y @sandbaseai/cli connect --client cursor-cli` |
| Kiro IDE | 自動 | `npx -y @sandbaseai/cli connect --client kiro` |
| Kiro CLI | 自動 | `npx -y @sandbaseai/cli connect --client kiro-cli` |
| Windsurf | 自動 | `npx -y @sandbaseai/cli connect --client windsurf` |
| Gemini CLI | 自動 | `npx -y @sandbaseai/cli connect --client gemini-cli` |
| OpenCode | 自動 | `npx -y @sandbaseai/cli connect --client opencode` |
| Qwen Code | 自動 | `npx -y @sandbaseai/cli connect --client qwen-code` |
| Kimi CLI | 自動 | `npx -y @sandbaseai/cli connect --client kimi-cli` |
| Warp | 自動 | `npx -y @sandbaseai/cli connect --client warp` |
| Amp | 自動 | `npx -y @sandbaseai/cli connect --client amp` |
| Hermes | 自動 | `npx -y @sandbaseai/cli connect --client hermes` |
| OpenClaw | 自動 | `npx -y @sandbaseai/cli connect --client openclaw` |
| ChatGPT | 手動 | `npx -y @sandbaseai/cli connect --client chatgpt` |
| Claude Desktop | 手動 | `npx -y @sandbaseai/cli connect --client claude-desktop` |

`--client auto`（または `--client` を省略）で、検出されたすべてのクライアントを一度に設定します。

## コマンド

| コマンド | 説明 |
|---------|------|
| `sandbase connect [--client <name>]` | クライアントの認証とMCP設定 |
| `sandbase doctor [--client <name>]` | 接続状態と設定の健全性チェック |
| `sandbase unregister [--client <name>]` | ローカルSandBase設定の削除 |
| `sandbase catalog --json` | 対応クライアント一覧をJSON出力 |

## 仕組み

```
┌─────────────┐     ┌──────────────┐     ┌───────────────────┐
│  あなたの   │────▶│  MCP Bridge  │────▶│   SandBase API    │
│  Agent      │     │  (ローカル,  │     │  (2000+ ツール,   │
│  (Cursor,   │◀────│  オンデマンド)│◀────│   200+ モデル)    │
│   Claude...)│     └──────────────┘     └───────────────────┘
└─────────────┘
```

1. **認証** — CLIがdevice/PKCEフローを開始し、ブラウザで承認します。
2. **認証情報の保存** — APIキーが `0600` 権限でローカルに保存されます。
3. **MCP設定** — CLIがクライアントに適切なMCPサーバーエントリを書き込みます。
4. **ブリッジ** — 軽量なローカルNode.jsプロセスがクライアントとSandBase APIの間を仲介します。

バックグラウンドデーモンは不要です。MCPブリッジはクライアントがツールを呼び出す時にオンデマンドで起動します。

## ツールカテゴリ

| カテゴリ | 含まれるツール | ユースケース |
|---------|--------------|-------------|
| **検索** | Google、Exa、Tavily、Scholar | 調査、ファクトチェック、ドキュメント検索 |
| **SNS** | Twitter/X、Instagram、TikTok、YouTube、Reddit | トレンド分析、モニタリング |
| **Webスクレイピング** | Firecrawl、Exa content、URL fetch | データ抽出、競合分析 |
| **AIモデル** | GPT-4o、Claude、Gemini、DeepSeek、Qwen | 推論、分析、翻訳 |
| **画像生成** | Flux、DALL-E、Ideogram、Recraft | ロゴ、イラスト、モックアップ |
| **動画生成** | Kling、MiniMax、Runway、Luma | ショートクリップ、アニメーション |
| **音声** | ElevenLabs TTS、Whisper STT | ナレーション、文字起こし |
| **暗号通貨** | 相場データ、オンチェーン分析 | 価格照会、ウォレット分析 |
| **EC** | Taobao、Amazon商品データ | 商品調査、価格モニタリング |

## セキュリティ

- OAuth device flow + PKCE — シークレットがURLやCLI引数に表示されない
- 認証情報は `0600` 権限で保存
- 失敗時に自動ロールバック（認証情報、設定、MCP状態）
- クリーンアップトークンにより、エラー時に未処理の認証を確実に取り消し

## アクセス管理

CLIの認証情報は [SandBase Dashboard](https://sandbase.ai/console/keys) のAPI Keysからいつでも取り消せます。

## 開発

```sh
# 依存関係のインストール
npm ci

# ビルド
npm run build

# テスト実行
npm test

# リント
npm run lint
```

## リンク

- [SandBase プラットフォーム](https://sandbase.ai)
- [SandBase ダッシュボード](https://sandbase.ai/console)
- [SandBase ドキュメント](https://docs.sandbase.ai)
- [npm パッケージ](https://www.npmjs.com/package/@sandbaseai/cli)

## ライセンス

Apache-2.0
