# Kobo Recommend

> 讀完一本書後，幫你決定下一本看什麼——不是推薦「相似的書」，而是診斷你的閱讀缺口，找出你該補但一直沒補的那個象限。

## 跟其他書籍推薦工具有什麼不同

市面上的推薦工具（Goodreads、StoryGraph、Librarian.ai 等）都在問同一個問題：
> 「你喜歡什麼？我找相似的。」

這個系統問的是另一個問題：
> 「你的閱讀史有什麼盲區？你的下一本應該補什麼缺口？」

具體差異：

| | 一般推薦工具 | Kobo Recommend |
|---|---|---|
| 推薦邏輯 | 相似度匹配 | 缺口診斷為主，口味校準為輔 |
| 輸入 | 你喜歡的書 | 你讀過的所有書（含評價）|
| 輸出 | 更多你會喜歡的書 | 填補你閱讀盲區、且符合你閱讀風格的書 |
| 個人化深度 | 類型 / 標籤過濾 | 可設定排除條件（作者國籍、語言）、自訂推薦方向 |
| 透明度 | 黑盒推薦 | 每本推薦都附 rationale，顯示 Claude 分析成本 |

舉例：如果你讀了大量生產力書，系統不會繼續推同類書，而是從你的閱讀歷史識別出「經典商業策略」這個空白，再從中找出跟你閱讀口味最搭的那本。

**Stack**：Next.js 15 (App Router, TS) · Postgres (Neon) · Claude API (tool_use) · Tailwind · Vercel

## 前置

- Node.js 18+
- 一個 Neon 帳號（免費 tier 夠用）：<https://neon.tech/>
- 一把 Anthropic API key：<https://console.anthropic.com/>

## 本機啟動（從零到跑起來）

```bash
# 1. 安裝依賴
npm install

# 2. 建立 .env.local 並填入三個值
cp .env.example .env.local
# 編輯 .env.local：
#   DATABASE_URL=<從 Neon 拿到的 connection string>
#   ANTHROPIC_API_KEY=<從 Anthropic Console 拿到>
#   DEFAULT_USER_ID=00000000-0000-0000-0000-000000000001

# 3. 跑 schema migration（Phase 0 沒有 migration 工具，直接 psql）
npm run db:migrate
# 或手動：psql $DATABASE_URL -f db/schema.sql

# 4. 啟動 dev server
npm run dev
# 打開 http://localhost:3000
```

## 核心流程

```
書單（/）→ 分析（/analysis）→ 推薦（/recommend）
```

1. **`/`（書單）**：匯入你讀過的書，可標評價（liked / neutral / disliked）、可將工作必讀書標記排除分析
2. **`/analysis`（分析）**：Claude 讀取整份書單，輸出閱讀輪廓：類型分佈、高頻主題、口味偏好、以及**你的閱讀盲區**（你讀少或沒讀的重要象限）
3. **`/recommend`（推薦）**：基於上一步的分析，依你選的方向產出 N 本推薦，每本附推薦理由，可標「加入書單 / 已讀 / 跳過」

## 書單匯入格式

一行一本，支援三種寫法：

```
底層邏輯
原子習慣 — James Clear
快思慢想 — Daniel Kahneman — liked
1. 反脆弱 — Nassim Taleb — neutral
```

- 行首編號（`1. ` / `1) ` / `1、`）會自動去掉
- 分隔符支援 em-dash `—` / en-dash `–` / hyphen `-`（前後需有空白）
- rating 只接受 `liked` / `neutral` / `disliked`（其他會忽略）

## Deploy to Vercel

```bash
# 1. 推到 GitHub
git init && git add . && git commit -m "Phase 0"
git remote add origin <your-repo>
git push -u origin main

# 2. 在 Vercel import 這個 repo
# 3. 在 Vercel project settings 設 env vars：
#    - DATABASE_URL
#    - ANTHROPIC_API_KEY
#    - DEFAULT_USER_ID
# 4. Deploy
```

## 架構總覽

```
app/
  api/
    books/route.ts              POST 匯入 / GET 列表
    analysis/route.ts           POST 跑分析 / GET 最新結果
    recommendations/
      route.ts                  POST 產推薦
      [id]/route.ts             PATCH 更新狀態
  page.tsx                      /       書單
  analysis/page.tsx             /analysis
  recommend/page.tsx            /recommend
lib/
  db.ts                         postgres.js client（singleton）
  claude.ts                     Anthropic SDK
  prompts.ts                    Tool definitions + prompt builders
db/
  schema.sql                    一次性 migration
```

LLM 呼叫用 **tool_use** 強制 JSON 輸出（見 `lib/prompts.ts` 的 `ANALYSIS_TOOL` 與 `RECOMMEND_TOOL`），避免 parse markdown 的地雷。

## Phase 0 刻意不做的事

這些都留給 Phase 1+ 的獨立工程題：

- ❌ Auth / 多用戶（hardcode `DEFAULT_USER_ID`）
- ❌ Book metadata 查詢（Open Library / Google Books）
- ❌ 作者國籍自動抓取（目前靠 LLM 自己填，會有錯）
- ❌ 推薦後的 hallucination 驗證（LLM 可能推不存在的書）
- ❌ Embedding-based pre-filter / pgvector
- ❌ Prompt caching / LLM cost optimization
- ❌ 觀測性（logs、metrics、traces）
- ❌ 推薦品質的離線評估
- ❌ 單元測試 / E2E 測試
- ❌ Rate limiting
- ❌ Error boundary / 漂亮的錯誤頁

## 已知限制（Phase 0 就是會有的）

1. 作者國籍靠 LLM 填，會有誤判（例如把華裔美國人標成中國人）。Phase 1 要用 Wikipedia + 規則驗證取代。
2. LLM 會推薦不存在的書或書名寫錯。Phase 1 要加 Open Library 驗證 + retry。
3. 沒有 cache，每次 `/analysis` POST 都會呼叫一次 Claude。成本一次約 $0.01–0.05 USD（Sonnet）。
4. DB schema 的 `rationale` 欄位存的是 jsonb，但 Phase 0 前端沒有讀回來——只有新產出的那批才有完整資訊。Phase 1 要加 `GET /api/recommendations?batch_id=...`。

## Phase 1 建議優先順序

1. Book metadata ingestion pipeline（Open Library + fuzzy match + cache）
2. 作者國籍驗證（Wikidata + LLM extraction fallback）
3. Single-user auth（但 schema 已經 multi-user ready）
4. 基礎 observability（結構化 log + request 計數 + LLM token 消耗追蹤）
5. `GET /api/recommendations?batch_id` 端點，讓前端可以載入歷史 batch
