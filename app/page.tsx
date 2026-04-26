"use client";
import { useState, useEffect, useRef } from "react";

type Book = {
  id: string;
  title: string;
  author: string | null;
  rating: string | null;
  exclude_from_analysis: boolean;
  reading_status: "read" | "to_read";
  created_at: string;
};

type OLBook = {
  ol_key: string;
  title: string;
  author: string | null;
  year: number | null;
  publisher: string | null;
  cover_url: string | null;
  language: string | null;
};

export default function Home() {
  const [tab, setTab] = useState<"paste" | "search" | "csv">("paste");

  // ── paste tab ──
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // ── csv tab ──
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  // ── search tab ──
  const [query, setQuery] = useState("");
  const [olBooks, setOlBooks] = useState<OLBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── book list ──
  const [books, setBooks] = useState<Book[]>([]);
  const [listSearch, setListSearch] = useState("");
  const [bookTab, setBookTab] = useState<"read" | "to_read">("read");

  async function loadBooks() {
    const res = await fetch("/api/books");
    const data = await res.json();
    setBooks(data.books || []);
  }

  useEffect(() => { loadBooks(); }, []);

  async function deleteBook(id: string) {
    await fetch(`/api/books/${id}`, { method: "DELETE" });
    setBooks((prev) => prev.filter((b) => b.id !== id));
  }

  async function toggleExclude(id: string, current: boolean) {
    await fetch(`/api/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exclude_from_analysis: !current }),
    });
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, exclude_from_analysis: !current } : b))
    );
  }

  async function setRating(id: string, rating: string | null) {
    await fetch(`/api/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    });
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, rating } : b))
    );
  }

  async function markAsRead(id: string) {
    await fetch(`/api/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reading_status: "read" }),
    });
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, reading_status: "read" } : b))
    );
  }

  async function submit() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.inserted !== undefined) {
      setText("");
      const parts = [];
      if (data.inserted > 0) parts.push(`匯入 ${data.inserted} 本`);
      if (data.skipped_titles?.length > 0) {
        parts.push(`略過（已存在）：${data.skipped_titles.join("、")}`);
      }
      if (data.no_author_count > 0) parts.push(`⚠ ${data.no_author_count} 本未含作者，同名書可能導致推薦誤判`);
      setMessage(parts.join(" ／ ") || "完成");
      loadBooks();
    } else {
      setMessage(data.error ?? "匯入失敗");
    }
  }

  async function importCSV() {
    if (!csvFile) return;
    setCsvLoading(true);
    setCsvMessage(null);
    const form = new FormData();
    form.append("file", csvFile);
    const res = await fetch("/api/books/import", { method: "POST", body: form });
    const data = await res.json();
    setCsvLoading(false);
    if (res.ok) {
      const parts = [];
      if (data.inserted > 0) parts.push(`匯入 ${data.inserted} 本`);
      if (data.upgraded > 0) parts.push(`升級 ${data.upgraded} 本（待讀→已讀）`);
      if (data.skipped > 0) parts.push(`略過 ${data.skipped} 本（已存在）`);
      setCsvMessage(parts.join(" ／ ") || "完成（無新書）");
      setCsvFile(null);
      if (csvInputRef.current) csvInputRef.current.value = "";
      loadBooks();
    } else {
      setCsvMessage(`錯誤：${data.error ?? "匯入失敗"}`);
    }
  }

  function exportCSV() {
    const header = ["書名", "作者", "評價", "排除分析", "匯入時間"];
    const rows = books.map((b) => [
      b.title,
      b.author ?? "",
      b.rating ?? "",
      b.exclude_from_analysis ? "是" : "否",
      new Date(b.created_at).toLocaleDateString("zh-TW"),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `書單_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Open Library search (debounced 500ms)
  function handleQueryChange(v: string) {
    setQuery(v);
    setSearchMsg(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!v.trim()) { setOlBooks([]); return; }
    debounceRef.current = setTimeout(() => runSearch(v.trim()), 500);
  }

  async function runSearch(q: string) {
    setSearching(true);
    setOlBooks([]);
    try {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.books) {
        setOlBooks(data.books);
        if (data.books.length === 0) setSearchMsg("沒有找到相關書籍");
      } else {
        setSearchMsg(data.error ?? "搜尋失敗");
      }
    } catch {
      setSearchMsg("搜尋失敗，請稍後再試");
    } finally {
      setSearching(false);
    }
  }

  async function addOLBook(book: OLBook) {
    const line = book.author ? `${book.title} — ${book.author}` : book.title;
    const res = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: line }),
    });
    const data = await res.json();
    if (data.inserted !== undefined) {
      setAdded((prev) => new Set([...prev, book.ol_key]));
      loadBooks();
    }
  }

  const readBooks = books.filter((b) => b.reading_status === "read");
  const toReadBooks = books.filter((b) => b.reading_status === "to_read");
  const activeBooks = bookTab === "read" ? readBooks : toReadBooks;
  const q = listSearch.trim().toLowerCase();
  const filtered = q
    ? activeBooks.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.author?.toLowerCase().includes(q) ?? false)
      )
    : activeBooks;

  return (
    <div className="space-y-8">
      {/* ── import section ── */}
      <section>
        <h1 className="text-2xl font-bold mb-4">匯入書單</h1>

        {/* tab switcher */}
        <div className="flex border-b border-zinc-200 mb-4">
          {(["paste", "search", "csv"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                tab === t
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              {t === "paste" ? "貼上書單" : t === "search" ? "搜尋書目" : "Goodreads CSV"}
            </button>
          ))}
        </div>

        {/* paste tab */}
        {tab === "paste" && (
          <>
            <p className="text-sm text-zinc-600 mb-3">
              一行一本。<strong>建議帶作者</strong>（同名書不同作者會影響推薦準確度）。格式：<code className="px-1 bg-zinc-100">書名 — 作者</code>
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`1. 底層邏輯\n2. 原子習慣 — James Clear — liked\n3. 快思慢想 — Daniel Kahneman`}
              className="w-full h-48 p-3 border border-zinc-300 rounded font-mono text-sm bg-white"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={submit}
                disabled={loading || !text.trim()}
                className="px-4 py-2 bg-zinc-900 text-white rounded disabled:opacity-40"
              >
                {loading ? "匯入中..." : "匯入"}
              </button>
              {message && <span className="text-sm text-zinc-600">{message}</span>}
            </div>
          </>
        )}

        {/* csv tab */}
        {tab === "csv" && (
          <div className="space-y-4">
            <div className="text-sm text-zinc-600 space-y-1">
              <p>從 Goodreads 匯出 CSV 後直接上傳。會自動對應書架：</p>
              <ul className="list-disc pl-5 text-zinc-500 space-y-0.5">
                <li><strong>read</strong> shelf → 已讀</li>
                <li><strong>to-read / currently-reading</strong> shelf → 待讀</li>
                <li>評分 ★★★★☆ 以上 → 👍，★★★ → 😐，★★ 以下 → 👎</li>
              </ul>
              <p className="text-zinc-400 text-xs">匯出方式：Goodreads → My Books → Import and Export → Export Library</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="px-4 py-2 text-sm border border-zinc-300 rounded cursor-pointer hover:bg-zinc-50 shrink-0">
                選擇 CSV 檔案
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setCsvFile(f);
                    setCsvMessage(null);
                  }}
                />
              </label>
              {csvFile && (
                <span className="text-sm text-zinc-500 truncate min-w-0">{csvFile.name}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={importCSV}
                disabled={!csvFile || csvLoading}
                className="px-4 py-2 bg-zinc-900 text-white rounded text-sm disabled:opacity-40"
              >
                {csvLoading ? "匯入中..." : "匯入"}
              </button>
              {csvMessage && (
                <span className={`text-sm ${csvMessage.startsWith("錯誤") ? "text-red-600" : "text-zinc-600"}`}>
                  {csvMessage}
                </span>
              )}
            </div>
          </div>
        )}

        {/* search tab */}
        {tab === "search" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="輸入書名或作者…"
                className="flex-1 px-3 py-2 border border-zinc-300 rounded text-sm bg-white"
                autoFocus
              />
              <button
                onClick={() => query.trim() && runSearch(query.trim())}
                disabled={searching || !query.trim()}
                className="px-4 py-2 bg-zinc-900 text-white rounded text-sm disabled:opacity-40"
              >
                {searching ? "搜尋中…" : "搜尋"}
              </button>
            </div>

            {searchMsg && !searching && (
              <p className="text-sm text-zinc-400">{searchMsg}</p>
            )}

            {olBooks.length > 0 && (
              <ul className="divide-y divide-zinc-100 bg-white rounded border border-zinc-200">
                {olBooks.map((b) => {
                  const isAdded = added.has(b.ol_key);
                  return (
                    <li key={b.ol_key} className="flex items-center gap-3 px-3 py-2">
                      {b.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.cover_url}
                          alt={b.title}
                          className="w-8 h-12 object-cover rounded shrink-0 bg-zinc-100"
                        />
                      ) : (
                        <div className="w-8 h-12 rounded bg-zinc-100 shrink-0 flex items-center justify-center text-zinc-300 text-xs">
                          封面
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{b.title}</span>
                          {b.language && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-xs bg-zinc-100 text-zinc-500">
                              {b.language === "zh" ? "中文" : b.language === "en" ? "EN" : b.language}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">
                          {b.author ?? "作者不詳"}
                          {b.year && <span className="ml-2 text-zinc-400">{b.year}</span>}
                        </div>
                        {b.publisher && (
                          <div className="text-xs text-zinc-400 truncate">{b.publisher}</div>
                        )}
                      </div>
                      <button
                        onClick={() => addOLBook(b)}
                        disabled={isAdded}
                        className={`shrink-0 px-3 py-1 rounded text-xs font-medium transition ${
                          isAdded
                            ? "bg-zinc-100 text-zinc-400 cursor-default"
                            : "bg-zinc-900 text-white hover:bg-zinc-700"
                        }`}
                      >
                        {isAdded ? "已加入" : "+ 加入"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* ── book list ── */}
      <section>
        {/* 已讀 / 待讀 tab */}
        <div className="flex border-b border-zinc-200 mb-3">
          {([["read", "已讀", readBooks.length], ["to_read", "待讀", toReadBooks.length]] as const).map(
            ([tab, label, count]) => (
              <button
                key={tab}
                onClick={() => { setBookTab(tab); setListSearch(""); }}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                  bookTab === tab
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-400 hover:text-zinc-600"
                }`}
              >
                {label}
                <span className="ml-1.5 text-xs text-zinc-400">{count}</span>
              </button>
            )
          )}
          <div className="flex-1" />
          {activeBooks.length > 0 && (
            <div className="flex items-center gap-2 pb-1">
              <input
                type="text"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="搜尋書名 / 作者"
                className="px-3 py-1 text-sm border border-zinc-300 rounded w-40"
              />
              {bookTab === "read" && (
                <button
                  onClick={exportCSV}
                  className="px-3 py-1 text-sm border border-zinc-300 rounded hover:bg-zinc-50 shrink-0"
                  title="匯出 CSV"
                >
                  ↓ CSV
                </button>
              )}
            </div>
          )}
        </div>
        <ul className="divide-y divide-zinc-100 bg-white rounded border border-zinc-200">
          {filtered.map((b) => (
            <li
              key={b.id}
              className={`px-3 py-2 text-sm flex items-center justify-between group ${
                b.exclude_from_analysis && bookTab === "read" ? "bg-zinc-50" : ""
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {bookTab === "read" && (
                  <button
                    onClick={() => toggleExclude(b.id, b.exclude_from_analysis)}
                    title={b.exclude_from_analysis ? "目前排除分析，點擊納入" : "點擊排除分析"}
                    className={`shrink-0 w-4 h-4 rounded border transition ${
                      b.exclude_from_analysis
                        ? "bg-zinc-300 border-zinc-300"
                        : "border-zinc-300 hover:border-zinc-500"
                    }`}
                  />
                )}
                <div className={`min-w-0 ${b.exclude_from_analysis && bookTab === "read" ? "text-zinc-400" : ""}`}>
                  <span className="font-medium">{b.title}</span>
                  {b.author && <span className="text-zinc-500"> — {b.author}</span>}
                  {b.exclude_from_analysis && bookTab === "read" && (
                    <span className="ml-2 text-xs text-zinc-400">（排除分析）</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {bookTab === "to_read" ? (
                  <button
                    onClick={() => markAsRead(b.id)}
                    className="px-2 py-0.5 text-xs rounded border border-green-300 text-green-700 hover:bg-green-50 whitespace-nowrap"
                  >
                    讀完了
                  </button>
                ) : (
                  (["liked", "neutral", "disliked"] as const).map((r) => {
                    const emoji = r === "liked" ? "👍" : r === "neutral" ? "😐" : "👎";
                    const active = b.rating === r;
                    return (
                      <button
                        key={r}
                        onClick={() => setRating(b.id, active ? null : r)}
                        title={active ? "點擊取消" : r}
                        className={`text-sm transition ${
                          active ? "opacity-100" : "opacity-20 hover:opacity-60"
                        }`}
                      >
                        {emoji}
                      </button>
                    );
                  })
                )}
                <button
                  onClick={() => deleteBook(b.id)}
                  className="ml-1 text-zinc-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition text-xs"
                  title="刪除"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
          {filtered.length === 0 && activeBooks.length > 0 && (
            <li className="px-3 py-6 text-sm text-zinc-400 text-center">
              找不到「{listSearch}」
            </li>
          )}
          {activeBooks.length === 0 && (
            <li className="px-3 py-6 text-sm text-zinc-400 text-center">
              {bookTab === "to_read" ? "待讀清單是空的，從推薦頁加入想讀的書" : "還沒有書"}
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
