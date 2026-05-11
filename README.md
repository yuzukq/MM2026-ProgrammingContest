## 開発参加手順（pnpm）
Node.js / pnpm のセットアップがまだの場合は下記を先に行ってね

<details>
<summary>macOS: Node.js / pnpm セットアップ手順</summary>

1. Node.js（LTS）をインストール  
   `brew install node`
2. Corepack を有効化して pnpm を使えるようにする  
   `corepack enable`
3. 動作確認  
   `node -v`  
   `pnpm -v`

</details>

<details>
<summary>Windows: Node.js / pnpm セットアップ手順</summary>

1. Node.js（LTS）をインストール  
   https://nodejs.org/ja
2. PowerShell を開いて Corepack を有効化  
   `corepack enable`
3. 動作確認 (もしパスが通ってなかったら各自で設定して)
   `node -v`  
   `pnpm -v`

</details>

1. このリポジトリをクローンする  
   `git clone <repository-url>`
2. プロジェクトディレクトリへ移動する  
   `cd MM2026-ProgrammingContest`
3. 依存パッケージをインストールする  
   `pnpm install`
4. 開発サーバーを起動する  
   `pnpm dev`
5. local で開発中のページを確認する  
   `http://localhost:5173`



## コードフォーマット（Prettier）

時間的にci整備は厳しいのでローカルでjsのコーディングルールをある程度揃えたい。 [Prettier](https://prettier.io/) 

### エディタ設定（保存時に自動フォーマット）

<details>
<summary>Zed</summary>

設定ファイル（`~/.config/zed/settings.json`）に以下を追加：
```json
{
  "formatter": "prettier",
  "format_on_save": "on"
}
```

</details>

<details>
<summary>VS Code</summary>

1. 拡張機能 [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) をインストール
2. `.vscode/settings.json`（なければ作成）に以下を追加：
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true
}
```

</details>

### 手動フォーマット

```bash
pnpm format        # src/ 以下を一括フォーマット
pnpm format:check  # フォーマットのチェックのみ（変更なし）
```

---

## 参考リンク
- **3Dモデルの描画**：three.js
  - リファレンス：https://threejs.org/manual/#ja/fundamentals
  - 日本語チュートリアル：https://ics.media/tutorial-three/quickstart/
- **歌詞・音楽連携**：TextAlive App API
  - リファレンス：https://developer.textalive.jp/packages/textalive-app-api/#md:textalive-app-api

- **企画書と設計，タスク等**
  - notion: https://www.notion.so/MM2026-PG-3591989ac2648059889cd45f709b317d?source=copy_link
