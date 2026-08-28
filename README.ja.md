<p align="center">
  <h1 align="center">@sandbaseai/cli</h1>
  <p align="center">
    <strong>AIエージェントに超能力を。1コマンドで2,000以上のAIモデルとAPI。</strong>
  </p>
  <p align="center">
    <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a> | 日本語 | <a href="./README.ko.md">한국어</a> | <a href="./README.es.md">Español</a> | <a href="./README.fr.md">Français</a> | <a href="./README.de.md">Deutsch</a> | <a href="./README.pt-BR.md">Português</a>
  </p>
  <p align="center">
    <a href="https://github.com/sandbaseai/cli/releases/latest"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/sandbaseai/cli"></a>
    <a href="https://github.com/sandbaseai/cli/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sandbaseai/cli/actions/workflows/ci.yml/badge.svg"></a>
    <a href="https://github.com/sandbaseai/cli/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/sandbaseai/cli"></a>
    <a href="https://github.com/sandbaseai/cli/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/sandbaseai/cli?style=social"></a>
  </p>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/sandbaseai/cli/main/.github/assets/sandbase-cli-hero.webp" alt="SandBase CLI MCP bridge" width="100%">
</p>

---

あなたのAIコーディングアシスタントは優秀ですが、箱の中に閉じ込められています。Web検索もSNS確認も画像生成もリアルタイムデータ取得も — 自分で各APIを接続しない限りできません。

**SandBaseがそれを変えます。** 1コマンドで、[Model Context Protocol](https://modelcontextprotocol.io)を通じてエージェントを2,000以上のAIモデルとAPIに接続。APIキー管理不要。設定の手間なし。

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect
```

これだけ。あなたのエージェントはすべてにアクセスできるようになりました。

## SandBase オープンソーススタック

- **[SandBase Harness](https://github.com/sandbaseai/sandbase-harness)** — 永続セッション、サンドボックス分離、承認、監査、リプレイを備えたセルフホスト型エージェントランタイム。
- **[SandBase Agent Skills](https://github.com/sandbaseai/sandbase-skills)** — リサーチ、ソーシャルインテリジェンス、マーケティング、ビジネス向けのインストール可能な 88 Skills。

---

## 検証可能なエージェントワークフロー

接続後、エージェントに次の監査可能な手順を実行させます。

1. `sandbase_discover` でタスクに適したモデルや API を検索します。
2. `sandbase_inspect` で入力スキーマ、現在の料金、実行要件を確認します。
3. `sandbase_run` を呼び出す前に、エンドポイント、パラメータ、想定コストを確認します。
4. 非同期タスクは、返された `run_id` を使って `sandbase_run_get` で追跡します。
5. `sandbase_runs` で最近の実行状態と記録されたコストを確認します。
6. `sandbase_account` で現在のアカウント残高を確認します。

たとえば、課金されない検索リクエストから始めます。

> 正方形の商品イラストに適した画像モデルを探し、上位 2 候補の必須入力と現在の料金を比較してください。まだモデルは実行しないでください。

カタログ、料金、レイテンシ、可用性は変わる可能性があります。固定された例ではなく、現在のセッションで得られたツール応答を使用してください。

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

## 対応クライアント（25ターゲット）

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

サインインやファイル変更なしで、完全な互換性カタログを確認できます：

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz catalog --json
```

このコマンドは変更されない GitHub `v0.1.17` リリースアーカイブを使用します。SHA-256：
`1ad535b2899ca460b57b3c268aef278fee28fd28e649a89b92951514fd71fffa`

npm の `latest` は現在も v0.1.14 のため、Trusted Publishing が有効になるまでは上記のバージョン固定 GitHub URL を使用してください。

```sh
# 検出されたすべてのクライアントを一度に接続
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect

# 特定のクライアントを指定
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect --client cursor
```

---

## 仕組み

```
┌─────────────────┐         ┌───────────────┐         ┌────────────────────┐
│  あなたのAgent  │  MCP    │ ローカルBridge │  HTTPS  │    SandBase API     │
│  (Cursorなど)   │────────▶│ (オンデマンド) │────────▶│ 2,000+ モデル/API  │
│                 │◀────────│               │◀────────│                    │
└─────────────────┘         └───────────────┘         └────────────────────┘
```

1. `connect`実行 → ブラウザ認証 → 承認
2. APIキーをローカル保存（権限 `0600`）
3. クライアントにMCP設定を自動書き込み
4. エージェントがオンデマンドでツール呼び出し。デーモンなし。

---

## コマンド

### CLIコマンド

```sh
sandbase connect [--client <name>]    # 認証 + 設定
sandbase doctor [--client <name>]     # ヘルスチェック
sandbase unregister [--client <name>] # 設定削除
sandbase catalog --json               # 対応クライアント一覧
```

### MCPツール（接続後にエージェントが使用可能）

| ツール | 用途 |
|--------|------|
| `sandbase_discover` | 2,000以上の利用可能なモデルとAPIを検索 |
| `sandbase_inspect` | 入力スキーマ、料金、実行テンプレートを取得 |
| `sandbase_run` | モデルまたはAPIエンドポイントを実行 |
| `sandbase_run_get` | 非同期タスクのステータス/結果をポーリング |
| `sandbase_runs` | 最近のAPI呼び出しとコストを一覧表示 |
| `sandbase_account` | アカウント残高を確認（無料） |

**エージェントが自動的に従うワークフロー：**

```
discover → inspect → run
```

```
1. sandbase_discover(q: "twitter search")        → マッチするツールを検索
2. sandbase_inspect(name: "twitter_timeline")    → スキーマ + 料金を取得
3. sandbase_run(name: "twitter_timeline", ...)   → 実行してデータを返す
```

---

## セキュリティ

- **URLやCLI引数にシークレットなし** — OAuth device flow + PKCE
- **制限されたファイル権限** — 認証情報は `0600` で保存
- **所有権を認識した更新** — 既存の JSONC コメントとユーザー管理の MCP エントリを保持
- **正確なロールバック** — 失敗時や `unregister` 実行時には、SandBase が作成した設定だけを削除
- **いつでも取り消し** — [SandBase Dashboard](https://sandbase.ai/console/keys)でワンクリック

---

## 始めよう

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect
```

そして、エージェントに今までできなかったことを頼んでみてください。

**[無料アカウント作成 →](https://sandbase.ai)**

SandBase でセットアップ時間を短縮できたら、[リポジトリに Star を付けてください](https://github.com/sandbaseai/cli)。より多くのエージェントユーザーがこのプロジェクトを見つけやすくなります。

---

## リンク

- [SandBase プラットフォーム](https://sandbase.ai)
- [ドキュメント](https://www.sandbase.ai/docs/)
- [Claude Code・Codex向け実践チュートリアル](https://github.com/sandbaseai/cli/discussions/49)
- [公式 MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.sandbaseai%2Fcli/versions/0.1.17)
- [npm パッケージ](https://www.npmjs.com/package/@sandbaseai/cli)
- [ダッシュボード](https://sandbase.ai/console)

## ライセンス

Apache-2.0
