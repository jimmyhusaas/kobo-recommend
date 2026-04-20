# Kobo Recommend — 專案上下文

> 給任何在這個 repo 裡工作的 Claude agent（Claude Code / Cowork / subagent dispatch）讀的。
> 用來補齊 Cowork session memory 的缺口，讓 IDE 端的 agent 有同樣的判斷依據。

---

## 這是什麼

Jimmy 的 side project。表面功能是「讀完一本書後，幫我決定下一本看什麼」。
實際上是 **雙重目的**：

1. **個人工具** — 解決「看完一本書後想不到下一本」的痛點
2. **技術深度 channel 的載體** — 刻意用這個專案補職涯缺口（系統設計 / 架構實戰），而不是單純 LLM-wrap toy project

**重要原則：** 任何設計決策都要同時問「這讓系統更有工程深度嗎？」。如果只是把更多 LLM call 包起來，要刻意踩煞車。

---

## 使用者（Jimmy）

- 後端工程師，~5 年經驗，Java / REST / Docker / K8s / CI/CD
- 剛從待業回到職場（永聯），階段目標：**薪資成長 → 外商 / SaaS / Remote**
- 已知缺口：系統設計偏「應試」缺實戰、英文還沒到工作語言、注意力容易分散
- 這個專案要同時服務 #2 和 #3

---

## 書籍推薦的硬性過濾條件（⚠ 每次推薦必套用）

寫進 `users.preferences` jsonb，推薦 API 會讀取：

- **排除作者國籍：中國**（`exclude_countries: ["CN"]`）
- **排除簡體中文書**（`exclude_languages: ["zh-Hans"]`）

這是個人偏好，不要勸退，也不要「平衡觀點」之類的提議。直接遵守。

---

## 閱讀輪廓（2026-04，60 本歷史分析摘要）

- 已過量：生產力 / 自我優化 / 個人成長類
- **真正的盲區**：
  - 經典商業 / 策略（e.g. High Output Management）
  - 非虛構敘事 / 長週期視野（e.g. Thinking Fast and Slow、Antifragile）
  - 原文書（英文閱讀能力要同步拉）
  - 技術深度（系統設計 / 架構經典）
- 推薦配比傾向：1 經典商業 + 2 非虛構敘事，偶爾塞 1 本技術深度

---

## 技術棧（Phase 0 定案）

- Next.js 15（App Router、TypeScript）
- Postgres（Neon）+ `postgres` (npm) client
- Anthropic SDK + Claude Sonnet 4.6，用 `tool_use` 拿結構化輸出
- Tailwind
- 部署：Vercel
- 沒有 auth（schema 已 multi-user ready，單人版用 `DEFAULT_USER_ID`）

**不要引入的東西**（除非有明確工程理由）：
- ORM（Prisma / Drizzle）— 這個規模 raw SQL 更清楚
- 狀態管理（Zustand / Redux）— `useState` + route-level fetch 就夠
- 多餘的 UI library — Tailwind 手刻

---

## 目前已完成

見 `docs/ROADMAP.md`。大致：

- Phase 0：匯入書單、Claude 分析、結構化推薦、推薦歷史 `/history`、成本追蹤 `/cost`
- Phase 1：刪除 / 重複防護 / 自訂方向 / 一鍵加入書單 / 書單搜尋
- Phase 2（進行中）：上次分析時間提示、書單變動 banner、`exclude_from_analysis` toggle

---

## 接下來要做什麼（戰略排序，不只是功能清單）

依 Jimmy 的職涯目標，後續功能應該刻意選 **能放進履歷且非 LLM-wrap** 的：

1. **Rate limit + quota** — 真實的 middleware 練習（Redis / DB-based token bucket）
2. **Job queue** — 把重推薦改成非同步（pg-boss / Inngest / 自己刻）
3. **Eval harness** — 自動測不同 prompt 的輸出品質，做 A/B
4. **Observability** — 加 tracing / 結構化 log，能回答「為什麼這次推薦這麼慢」
5. **Retrieval 層** — 未來書量變大時，從「全部塞 prompt」升級成 embedding + 檢索

Phase 2~4 的純 UX 改善（見 ROADMAP）可以並行做，但不要只做那些。

---

## 寫 code 時的偏好

- 繁中註解 + 英文變數，不要混
- 錯誤處理寫實在，不吞錯
- 重 refactor 不問、碰資料 schema / API 合約要先說
- commit 訊息用繁中，單一 commit 單一功能
- 上線前在本機完整跑一次

---

## 目錄速查

```
app/
  page.tsx                    書單（首頁，含 Open Library 搜尋 + 匯入）
  analysis/                   分析頁（含書單漂移 banner）
  recommend/                  推薦頁（含方向選擇 + 三種狀態）
  history/                    推薦歷史
  cost/                       API 成本
  api/
    books/                    書單 CRUD
    analysis/                 觸發分析 + 拉最新結果
    recommendations/          推薦批次 + 單筆狀態更新
lib/
  db.ts                       postgres.js client，export sql + DEFAULT_USER_ID
  claude.ts                   Anthropic client + calcCost + MODEL
  prompts.ts                  ANALYSIS_TOOL / RECOMMEND_TOOL schema + prompt builders
db/schema.sql                 建表 + seed default user（帶過濾條件）
docs/ROADMAP.md               PM 版路線圖
```

---

## 給接手 agent 的最後一句

這是一個 **要刻意做得比需要的更「工程」** 的專案。
如果某個需求三行 prompt 就能搞定，但能順手練一個工程 primitive，**選練那個**。
