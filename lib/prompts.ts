// Structured-output tool definitions + prompt builders.
// The tools force Claude to return JSON via tool_use blocks — no markdown parsing, no regex.

export const ANALYSIS_TOOL = {
  name: "report_analysis",
  description: "回傳對使用者已讀書單的結構化分析",
  input_schema: {
    type: "object" as const,
    properties: {
      total_books: { type: "number" },
      categories: {
        type: "array",
        description: "5-8 個有意義的主題分類",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            count: { type: "number" },
            percentage: { type: "number" },
            books: {
              type: "array",
              items: { type: "string" },
              description: "該類別下的代表書名（最多 8 本）",
            },
          },
          required: ["name", "count", "percentage", "books"],
        },
      },
      patterns: {
        type: "array",
        description: "3-6 個交叉觀察（非顯而易見的模式）",
        items: { type: "string" },
      },
      blind_spots: {
        type: "array",
        description: "3-6 個明顯的閱讀盲區",
        items: { type: "string" },
      },
      sharp_observation: {
        type: "string",
        description: "一個直接、可能刺耳但值得說的觀察",
      },
    },
    required: [
      "total_books",
      "categories",
      "patterns",
      "blind_spots",
      "sharp_observation",
    ],
  },
};

export const RECOMMEND_TOOL = {
  name: "recommend_books",
  description:
    "根據使用者的已讀書單、指定方向、硬性過濾條件，推薦 N 本書",
  input_schema: {
    type: "object" as const,
    properties: {
      books: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "繁體中文書名（若無中文版給原文書名）",
            },
            title_original: {
              type: "string",
              description: "原文書名",
            },
            author: { type: "string" },
            author_nationality: {
              type: "string",
              description: "作者主要國籍；必須非 PRC（中國籍）",
            },
            reading_resistance: {
              type: "string",
              enum: ["low", "medium", "high"],
              description: "閱讀阻力：low / medium / high",
            },
            why_you: {
              type: "string",
              description:
                "說服性論述（不是觀察，是論點）：1) 點名這本書對應哪個閱讀盲區，2) 用讀者已讀書目中的具體書名做對照，說清楚為什麼那個盲區重要（例如：你讀了 X 本強調執行面，但缺少 Y 這個視角），3) 讀完後會對過去讀過的哪些書產生新的理解或連結",
            },
            core_concepts: {
              type: "string",
              description: "核心概念 / 讀完具體會得到什麼能力或視角（避免「很有價值」這類空話）",
            },
            estimated_read_hours: {
              type: "number",
              description: "預估閱讀時間（小時），作為時間投資參考",
            },
            next_book: {
              type: "string",
              description: "讀完這本後的下一步推薦（書名）",
            },
          },
          required: [
            "title",
            "author",
            "author_nationality",
            "reading_resistance",
            "why_you",
            "core_concepts",
          ],
        },
      },
      reading_order: {
        type: "array",
        items: { type: "string" },
        description: "建議閱讀順序的書名列表",
      },
      rationale_for_batch: {
        type: "string",
        description: "這批書的整體配比邏輯與選擇策略",
      },
    },
    required: ["books", "reading_order", "rationale_for_batch"],
  },
};

type Book = { title: string; author?: string | null; rating?: string | null; note?: string | null };

function formatBookList(books: Book[]): string {
  return books
    .map((b, i) => {
      let line = `${i + 1}. ${b.title}`;
      if (b.author) line += ` — ${b.author}`;
      if (b.rating) line += ` (${b.rating})`;
      if (b.note) line += ` // ${b.note}`;
      return line;
    })
    .join("\n");
}

export function analysisPrompt(books: Book[]): string {
  return `你是一位思考清晰、直言不諱的書籍推薦顧問。使用者已讀過以下書籍，請進行結構化分析：

${formatBookList(books)}

任務：
1. 把書歸類到 5-8 個有意義的主題（反映使用者實際的興趣走向，不要只貼標籤）
2. 每個類別給本數、百分比（相對於總數）、代表書名
3. 找出 3-6 個交叉觀察——非顯而易見的模式（例如「0 本小說但 X 本生產力書」這種結構性觀察）
4. 找出 3-6 個明顯的閱讀盲區
5. 給一個直接、可能刺耳但值得說的觀察（避免空話、避免讚美）

使用繁體中文。用 report_analysis 工具回傳結果。`;
}

type Analysis = {
  blind_spots?: string[];
  patterns?: string[];
  sharp_observation?: string;
};

export function recommendPrompt(opts: {
  books: Book[];
  directions: string[];
  count: number;
  excludedCountries: string[];
  excludedLanguages: string[];
  previousRecommendations?: string[];
  analysis?: Analysis;
}): string {
  const previous = opts.previousRecommendations?.length
    ? `\n\n已推薦過（不要重複）：\n${opts.previousRecommendations
        .map((t) => `- ${t}`)
        .join("\n")}`
    : "";

  const analysisContext = opts.analysis
    ? `\n\n先前分析診斷（直接引用這些結果來決定推薦方向與 why_you 的論點）：
閱讀盲區：
${(opts.analysis.blind_spots ?? []).map((s) => `- ${s}`).join("\n")}

交叉觀察：
${(opts.analysis.patterns ?? []).map((s) => `- ${s}`).join("\n")}

直接評語：${opts.analysis.sharp_observation ?? "無"}`
    : "";

  return `你是使用者的長期書籍推薦顧問。任務：基於下面的已讀書單、先前分析診斷、指定方向、硬性過濾條件，推薦 ${opts.count} 本書。

已讀書單：
${formatBookList(opts.books)}${analysisContext}

指定方向：${opts.directions.join("、")}

硬性過濾條件（違反會被拒絕）：
- 排除作者國籍：${opts.excludedCountries.join("、") || "無"}
- 排除語言版本：${opts.excludedLanguages.join("、") || "無"}（原文版或繁體中文版 OK）${previous}

推薦原則：
- why_you 必須是說服性論述，不是觀察。直接點名對應哪個盲區，用讀者已讀書目中的具體書名做對照，說清楚讀完後會對過去讀的哪些書產生新連結
- 避開已過量的主題（例如讀過 10+ 本生產力書就不要再推生產力書）
- 若他讀過多本某主題的衍生書，優先推該主題的原典
- 每本標示閱讀阻力（low/medium/high）與預估閱讀時間（小時）
- 給建議閱讀順序，並解釋這批書的整體配比邏輯

使用繁體中文。用 recommend_books 工具回傳結果。`;
}
