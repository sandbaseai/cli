<p align="center">
  <h1 align="center">@sandbaseai/cli</h1>
  <p align="center">
    <strong>AIエージェントに超能力を。1コマンドで2,000以上のツール。</strong>
  </p>
  <p align="center">
    <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a> | 日本語
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/@sandbaseai/cli"><img alt="npm version" src="https://img.shields.io/npm/v/%40sandbaseai%2Fcli"></a>
    <a href="https://www.npmjs.com/package/@sandbaseai/cli"><img alt="npm downloads" src="https://img.shields.io/npm/dm/%40sandbaseai%2Fcli"></a>
    <a href="https://github.com/sandbaseai/cli/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sandbaseai/cli/actions/workflows/ci.yml/badge.svg"></a>
    <a href="https://github.com/sandbaseai/cli/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/sandbaseai/cli"></a>
    <a href="https://github.com/sandbaseai/cli/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/sandbaseai/cli?style=social"></a>
  </p>
</p>

---

あなたのAIコーディングアシスタントは優秀ですが、箱の中に閉じ込められています。Web検索もSNS確認も画像生成もリアルタイムデータ取得も — 自分で各APIを接続しない限りできません。

**SandBaseがそれを変えます。** 1コマンドで、[Model Context Protocol](https://modelcontextprotocol.io)を通じてエージェントを2,000以上のツールと200以上のAIモデルに接続。APIキー管理不要。設定の手間なし。

```sh
npx -y @sandbaseai/cli connect
```

これだけ。あなたのエージェントはすべてにアクセスできるようになりました。

---

## 実際の動作

接続後は、自然言語でエージェントに依頼するだけ。

### 「React 19の新機能を検索して」

```
Agent → SandBase Web Search → 0.8秒で10件の結果
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. "React 19 is Here: What's New" — react.dev
2. "React 19 Compiler Deep Dive" — Dan Abramov
3. "Migrating to React 19" — Vercel Engineering
...
```

### 「TwitterでAIについてのトレンド投稿を取得して」

```
Agent → SandBase Twitter API → トップ10投稿
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. @karpathy: "LLMs are the new CPUs..." (45K ❤️)
2. @emollick: "Agent benchmarks just crossed..." (12K ❤️)
3. @swyx: "The MCP ecosystem is growing fast..." (8K ❤️)
...
```

### 「'NightOwl'というスタートアップのミニマルなロゴを作って」

```
Agent → SandBase Flux画像生成 → 1024x1024 PNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 生成完了: nightowl-logo.png
  スタイル: ミニマル、ダークテーマ
  コスト: $0.003
  所要時間: 2.1秒
```

### 「linear.appの料金表をスクレイピングして」

```
Agent → SandBase Firecrawlスクレイパー → 構造化データ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 3つのプランを抽出:
  Free: $0/月 — 250件まで
  Standard: $8/ユーザー/月 — 無制限
  Plus: $14/ユーザー/月 — 高度な機能 + 分析
```

### 「GPT-4oでこのPRをレビューして」

```
Agent → SandBase GPT-4o → 分析完了
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2つの問題を発見:
  ⚠️  useEffectに競合状態あり (42行目)
  ⚠️  非同期コンポーネントにError Boundaryなし
  ✓  型安全性は良好
  ✓  テストカバレッジは十分
```

---

## 含まれるツール

| カテゴリ | ツール | できること |
|---------|--------|-----------|
| **Web検索** | Google、Exa、Tavily、Scholar | リアルタイムで何でも検索 |
| **SNS** | Twitter/X、YouTube、Reddit、Instagram、TikTok | トレンド監視、投稿取得、分析 |
| **スクレイピング** | Firecrawl、Exa Content | 任意の公開ページからデータ抽出 |
| **AIモデル** | GPT-4o、Claude、Gemini、DeepSeek、Qwen | キー管理なしで任意モデルを実行 |
| **画像生成** | Flux、DALL-E、Ideogram、Recraft | ロゴ、イラスト、モックアップ |
| **動画生成** | Kling、MiniMax、Runway、Luma | ショートクリップ、アニメーション |
| **音声** | ElevenLabs、Whisper | テキスト→音声、音声→テキスト |
| **EC** | Taobao、Amazon | 商品調査、価格比較 |
| **金融** | 株式データ、企業情報 | 市場調査と分析 |

---

## 対応クライアント (17+)

すべての主要AIコーディングツールで動作：

| 自動設定 | 手動設定 |
|---------|---------|
| Cursor、Cursor CLI | ChatGPT |
| Claude Code | Claude Desktop |
| Codex | |
| Kiro IDE、Kiro CLI | |
| Windsurf | |
| Gemini CLI | |
| Amp | |
| Warp | |
| OpenCode、Qwen Code、Kimi CLI | |
| Hermes、OpenClaw | |

```sh
# 検出されたすべてのクライアントを一度に接続
npx -y @sandbaseai/cli connect

# 特定のクライアントを指定
npx -y @sandbaseai/cli connect --client cursor
```

---

## 仕組み

```
┌─────────────────┐         ┌───────────────┐         ┌────────────────────┐
│  あなたのAgent  │  MCP    │ ローカルBridge │  HTTPS  │    SandBase API     │
│  (Cursorなど)   │────────▶│ (オンデマンド) │────────▶│  2,000+ ツール     │
│                 │◀────────│               │◀────────│  200+ AIモデル     │
└─────────────────┘         └───────────────┘         └────────────────────┘
```

1. `connect`実行 → ブラウザ認証 → 承認
2. APIキーをローカル保存（権限 `0600`）
3. クライアントにMCP設定を自動書き込み
4. エージェントがオンデマンドでツール呼び出し。デーモンなし。

---

## コマンド

```sh
sandbase connect [--client <name>]    # 認証 + 設定
sandbase doctor [--client <name>]     # ヘルスチェック
sandbase unregister [--client <name>] # 設定削除
sandbase catalog --json               # 対応クライアント一覧
```

---

## セキュリティ

- **URLやCLI引数にシークレットなし** — OAuth device flow + PKCE
- **制限されたファイル権限** — 認証情報は `0600` で保存
- **自動ロールバック** — 失敗時はすべてクリーンに復元
- **いつでも取り消し** — [SandBase Dashboard](https://sandbase.ai/console/keys)でワンクリック

---

## 始めよう

```sh
npx -y @sandbaseai/cli connect
```

そして、エージェントに今までできなかったことを頼んでみてください。

**[無料アカウント作成 →](https://sandbase.ai)**

---

## リンク

- [SandBase プラットフォーム](https://sandbase.ai)
- [ドキュメント](https://docs.sandbase.ai)
- [npm パッケージ](https://www.npmjs.com/package/@sandbaseai/cli)
- [ダッシュボード](https://sandbase.ai/console)

## ライセンス

Apache-2.0
