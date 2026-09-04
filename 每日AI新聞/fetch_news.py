# -*- coding: utf-8 -*-
"""每日 AI 新聞抓取器
抓取 RSS → 英文翻譯成中文 → 生成單一 HTML（每天覆蓋）
執行：python fetch_news.py
"""
import sys
import time
import html
import re
from urllib.parse import urlencode
from datetime import datetime, timedelta, timezone

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

import requests
import feedparser

OUT_FILE = "index.html"
TAIWAN_TZ = timezone(timedelta(hours=8))
HOURS_WINDOW = 30
MAX_PER_FEED = 6

BRANDS = [
    ("Gemini", ("gemini",)),
    ("ChatGPT", ("chatgpt", "openai", "gpt")),
    ("Claude", ("claude", "anthropic")),
    ("Copilot", ("copilot", "microsoft ai")),
    ("Grok", ("grok", "xai")),
    ("其他", ("perplexity", "manus", "deepseek", "doubao", "kimi", "文心一言", "豆包", "通義", "qwen")),
]

FEEDS = [
    {"name": "iThome",       "lang": "zh", "url": "https://www.ithome.com.tw/rss/cat/ai"},
    {"name": "科技新報",      "lang": "zh", "url": "https://technews.tw/category/ai/feed/"},
    {"name": "TechCrunch AI", "lang": "en", "url": "https://techcrunch.com/category/artificial-intelligence/feed/"},
    {"name": "MIT Technology Review", "lang": "en", "url": "https://www.technologyreview.com/feed/"},
]

AGENT_FEEDS = [
    {"name": "數位時代", "lang": "zh", "url": "https://rss.bnextmedia.com.tw/feed/bnext"},
]

CSS = """
    :root{--bg:#f4f6fb;--card:#fff;--ink:#1f2430;--muted:#6b7280;--line:#e5e7eb;
          --accent:#2563eb;--tag:#eef2ff;--tag-ink:#4338ca;}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:"Microsoft JhengHei","PingFang TC",system-ui,sans-serif;background:var(--bg);
         color:var(--ink);line-height:1.6;padding:32px 16px}
    .wrap{max-width:860px;margin:0 auto}
    header{margin-bottom:28px}
    h1{font-size:26px;letter-spacing:.5px}
    .date{color:var(--muted);font-size:14px;margin-top:6px}
    section{margin-bottom:34px}
    h2{font-size:18px;color:var(--accent);margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--line)}
    .card{background:var(--card);border:1px solid var(--line);border-radius:12px;
          padding:16px 18px;margin-bottom:12px;transition:box-shadow .15s}
    .card:hover{box-shadow:0 4px 14px rgba(31,36,48,.08)}
    .card a{text-decoration:none;color:var(--ink);font-weight:600;font-size:16px}
    .card a:hover{color:var(--accent)}
    .summary{color:var(--muted);font-size:14px;margin-top:6px}
    .meta{display:flex;gap:10px;align-items:center;margin-top:8px;font-size:12px;color:var(--muted)}
    .badge{background:var(--tag);color:var(--tag-ink);padding:2px 8px;border-radius:99px;font-size:11px}
    .count{font-size:13px;color:var(--muted)}
    .tabs{display:flex;gap:10px;margin-bottom:24px}
    .tab{background:var(--card);border:1px solid var(--line);border-radius:99px;padding:8px 22px;font-size:15px;cursor:pointer;color:var(--muted);font-family:inherit;transition:all .15s}
    .tab:hover{border-color:var(--accent);color:var(--accent)}
    .tab.active{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
    .panel{display:none}
    .panel.active{display:block}
    .tags{margin-bottom:6px}
    .brand-tag{background:#ecfdf5;color:#047857;padding:2px 9px;border-radius:99px;font-size:11px;margin-right:6px;display:inline-block}
    footer{color:var(--muted);font-size:12px;text-align:center;margin-top:40px}
    .orig{color:var(--muted);font-size:12px;margin-top:2px;line-height:1.4}
    """

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
}


def strip_html(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def is_english(text, threshold=0.5):
    """粗略判定文字是否以英文為主（拉丁字母比例 > threshold）。
    註：僅統計 ASCII 拉丁字母與基本 CJK（U+4E00–U+9FFF）；é、ü 等非 ASCII 拉丁字母不計入，對亞洲語料影響甚微。"""
    if not text:
        return False
    latin = sum(1 for ch in text if ch.isascii() and ch.isalpha())
    cjk = sum(1 for ch in text if "\u4e00" <= ch <= "\u9fff")
    total = latin + cjk
    if total == 0:
        return False
    return latin / total > threshold


def translate_if_english(item, lang="zh"):
    """將 item 的英文標題/摘要翻譯成中文，原文保留於 item['orig']。
    lang 決定門檻：en 來源用 0.5；zh/未知來源用 0.8，避免中文 Google News
    標題因「 - Publisher」英文出版者名而被誤判為英文。翻譯失敗不寫 orig。"""
    threshold = 0.5 if lang == "en" else 0.8
    orig = {}
    for field in ("title", "summary"):
        text = item.get(field) or ""
        if not is_english(text, threshold):
            continue
        trans = google_translate(text)
        if trans and trans != text:
            item[field] = trans
            orig[field] = text
    if orig:
        item["orig"] = orig
    return item


def summarize(text, limit=160):
    text = strip_html(text)
    if len(text) > limit:
        return text[:limit].rsplit(" ", 1)[0] + "…"
    return text


def match_brands(title, summary=""):
    """回傳標題/摘要中命中的品牌名稱清單（依 BRANDS 順序）。"""
    text = f"{title} {summary}"
    matched = []
    for label, kws in BRANDS:
        if any(re.search(re.escape(kw), text, re.IGNORECASE) for kw in kws):
            matched.append(label)
    return matched


def agent_query():
    parts = []
    for label, kws in BRANDS:
        if label == "其他":
            parts.extend(kws)
        else:
            parts.append(label)
    return " OR ".join(f'"{p}"' for p in parts)


def google_translate(text, src="en", dst="zh-TW"):
    if not text:
        return ""
    url = "https://translate.googleapis.com/translate_a/single"
    for client in ("dict-chrome-ex", "gtx"):
        params = {"client": client, "sl": src, "tl": dst, "dt": "t", "q": text}
        try:
            r = requests.get(url, params=params, headers=UA, timeout=15)
            r.raise_for_status()
            parts = r.json()[0]
            return "".join(p[0] for p in parts if p and p[0])
        except Exception:
            continue
    return text


def parse_ch_time(raw):
    """解析康健 API 時間字串（'2026-09-04 14:27:08'，台灣時區），失敗回 None。"""
    if not raw or not isinstance(raw, str):
        return None
    try:
        return datetime.strptime(raw, "%Y-%m-%d %H:%M:%S").replace(tzinfo=TAIWAN_TZ)
    except ValueError:
        return None


def parse_ch_article(item):
    """從康健 API item dict 抽出文章欄位；非 article 型別或無標題回 None。"""
    if not isinstance(item, dict) or item.get("type") != "article":
        return None
    title = strip_html(str(item.get("title") or "")).strip()
    if not title:
        return None
    return {
        "title": title,
        "link": item.get("link") or "",
        "summary": (item.get("preface") or "").strip(),
        "time": parse_ch_time(item.get("item_datetime")),
        "channel": item.get("channel_name") or "",
    }


def parse_time(entry):
    ts = entry.get("published_parsed") or entry.get("updated_parsed")
    if not ts:
        return None
    return datetime(*ts[:6], tzinfo=timezone.utc).astimezone(TAIWAN_TZ)


def fetch_feed(feed):
    name, lang = feed["name"], feed["lang"]
    try:
        d = feedparser.parse(feed["url"])
        if not d.entries:
            print(f"  [{name}] 0 則（解析失敗或無內容）")
            return []
    except Exception as e:
        print(f"  [{name}] 抓取失敗: {e}")
        return []

    now = datetime.now(TAIWAN_TZ)
    cutoff = now - timedelta(hours=HOURS_WINDOW)
    items = []
    for entry in d.entries[:15]:
        title = strip_html(entry.get("title", "")).strip()
        if not title:
            continue
        link = entry.get("link", "")
        summary = summarize(entry.get("summary") or entry.get("description") or "")
        published = parse_time(entry)
        if published and published < cutoff:
            continue
        items.append({"title": title, "link": link, "summary": summary, "time": published,
                      "source": name, "brands": match_brands(title, summary)})

    items.sort(key=lambda x: x["time"] or datetime.min.replace(tzinfo=TAIWAN_TZ), reverse=True)
    items = items[:MAX_PER_FEED]

    if lang == "en":
        print(f"  [{name}] {len(items)} 則（翻譯中…）")
        for it in items:
            translate_if_english(it, lang)
            time.sleep(0.6)
    else:
        print(f"  [{name}] {len(items)} 則")
        for it in items:
            translate_if_english(it, lang)

    return items


def merge_agent_items(items):
    """依 link 去重、只保留有品牌者、依時間降冪排序。"""
    seen = set()
    out = []
    for it in items:
        if not it.get("brands"):
            continue
        link = it.get("link", "")
        if link in seen:
            continue
        seen.add(link)
        out.append(it)
    out.sort(key=lambda x: x.get("time") or datetime.min.replace(tzinfo=TAIWAN_TZ), reverse=True)
    return out


def fetch_google_news():
    """用品牌關鍵字查 Google News RSS（中文 + 英文），回傳已配對品牌的 item 清單。"""
    configs = [
        {"hl": "zh-TW", "gl": "TW", "ceid": "TW:zh-Hant", "lang": "zh"},
        {"hl": "en-US", "gl": "US", "ceid": "US:en", "lang": "en"},
    ]
    all_items = []
    q = agent_query()
    for cfg in configs:
        url = "https://news.google.com/rss/search?" + urlencode(
            {"q": q, "hl": cfg["hl"], "gl": cfg["gl"], "ceid": cfg["ceid"]}
        )
        try:
            d = feedparser.parse(url, request_headers=UA)
        except Exception as e:
            print(f"  [Google News {cfg['hl']}] 抓取失敗: {e}")
            continue
        if not d.entries:
            print(f"  [Google News {cfg['hl']}] 0 則")
            continue
        now = datetime.now(TAIWAN_TZ)
        cutoff = now - timedelta(hours=HOURS_WINDOW)
        items = []
        for entry in d.entries[:30]:
            title = strip_html(entry.get("title", "")).strip()
            if not title:
                continue
            link = entry.get("link", "")
            summary = summarize(entry.get("summary") or entry.get("description") or "")
            published = parse_time(entry)
            if published and published < cutoff:
                continue
            brands = match_brands(title, summary)
            if not brands:
                continue
            items.append({"title": title, "link": link, "summary": summary, "time": published,
                          "source": "Google News", "brands": brands})
        items.sort(key=lambda x: x["time"] or datetime.min.replace(tzinfo=TAIWAN_TZ), reverse=True)
        items = items[:MAX_PER_FEED]
        if cfg["lang"] == "en":
            print(f"  [Google News {cfg['hl']}] {len(items)} 則（翻譯中…）")
            for it in items:
                translate_if_english(it, cfg["lang"])
                time.sleep(0.6)
        else:
            print(f"  [Google News {cfg['hl']}] {len(items)} 則")
            for it in items:
                translate_if_english(it, cfg["lang"])
        all_items.extend(items)
    return all_items


def fmt_time(dt):
    return dt.strftime("%m/%d %H:%M") if dt else ""


def agent_section_html(items):
    if not items:
        return "<p>今天沒有抓到品牌 AI 新聞，請稍後再試。</p>"
    sec = [f"<h2>🤖 AI Agent 品牌新聞 <span class='count'>({len(items)} 則)</span></h2>"]
    for it in items:
        tags = "".join(f"<span class='brand-tag'>{html.escape(b)}</span>" for b in it.get("brands", []))
        badge = f"<span class='badge'>{html.escape(it.get('source', ''))}</span>"
        t = fmt_time(it.get("time"))
        orig_title, orig_summary = orig_lines(it.get("orig", {}))
        sec.append(
            f"<div class='card'><div class='tags'>{tags}</div>"
            f"<a href='{html.escape(it.get('link', ''))}' target='_blank' rel='noopener'>{html.escape(it.get('title', ''))}</a>"
            f"{orig_title}"
            f"<div class='summary'>{html.escape(it.get('summary', ''))}</div>{orig_summary}"
            f"<div class='meta'>{badge}<span>{t}</span></div></div>"
        )
    return "\n".join(sec)


def orig_lines(orig):
    """把 item['orig']（若有）轉成 .orig 小字行 HTML，回傳 (標題行, 摘要行)。"""
    o = orig or {}
    t = f"<div class='orig'>{html.escape(o['title'])}</div>" if o.get("title") else ""
    s = f"<div class='orig'>{html.escape(o['summary'])}</div>" if o.get("summary") else ""
    return t, s


def build_page_html(results, agent_items, generated_at):
    cards = {f["name"]: f for f in FEEDS}
    general = []
    for name in [f["name"] for f in FEEDS]:
        items = results.get(name, [])
        if not items:
            continue
        sec = [f"<section><h2>{html.escape(name)} <span class='count'>({len(items)} 則)</span></h2>"]
        for it in items:
            badge = "<span class='badge'>翻譯</span>" if cards[name]["lang"] == "en" else ""
            t = fmt_time(it["time"])
            orig_title, orig_summary = orig_lines(it.get("orig", {}))
            sec.append(
                f"<div class='card'><a href='{html.escape(it['link'])}' target='_blank' rel='noopener'>"
                f"{html.escape(it['title'])}</a>{orig_title}"
                f"<div class='summary'>{html.escape(it['summary'])}</div>{orig_summary}"
                f"<div class='meta'>{badge}<span>{t}</span></div></div>"
            )
        sec.append("</section>")
        general.append("\n".join(sec))
    if not general:
        general = ["<p>今天沒有抓到新聞，請稍後再試。</p>"]
    agent = agent_section_html(agent_items)
    page = f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>每日 AI 新聞</title>
<style>{CSS}</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>📰 每日 AI 新聞</h1>
  <div class="date">更新時間：{html.escape(generated_at)}　｜　AI Agent 欄來源：Google News、數位時代 + 品牌關鍵字搜尋</div>
</header>
<div class="tabs">
  <button type="button" class="tab active" data-tab="ai-news" onclick="switchTab('ai-news')">AI 新聞</button>
  <button type="button" class="tab" data-tab="ai-agent" onclick="switchTab('ai-agent')">AI Agent</button>
</div>
<div id="ai-news" class="panel active">
{''.join(general)}
</div>
<div id="ai-agent" class="panel">
<section>{agent}</section>
</div>
<footer>由 fetch_news.py 自動產生　・　每日自動更新</footer>
</div>
<script>
function switchTab(id){{
  document.querySelectorAll('.tab').forEach(function(b){{b.classList.toggle('active', b.dataset.tab===id);}});
  document.querySelectorAll('.panel').forEach(function(p){{p.classList.toggle('active', p.id===id);}});
}}
</script>
</body>
</html>"""
    return page


def render_html(results, agent_items, generated_at):
    page = build_page_html(results, agent_items, generated_at)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        f.write(page)
    total = sum(len(v) for v in results.values()) + len(agent_items)
    print(f"✔ 已生成 {OUT_FILE}（共 {total} 則）")


def main():
    start = datetime.now(TAIWAN_TZ)
    print(f"[{start.strftime('%Y-%m-%d %H:%M')}] 開始抓取…")
    results = {}
    source_items = {}
    agent_pool = []
    for feed in FEEDS:
        print(f"▸ 抓取 {feed['name']}…")
        items = fetch_feed(feed)
        results[feed["name"]] = items
        source_items[feed["name"]] = items
        agent_pool.extend(items)
    for feed in AGENT_FEEDS:
        print(f"▸ 抓取 {feed['name']}…")
        items = fetch_feed(feed)
        source_items[feed["name"]] = items
        agent_pool.extend(items)
    print("▸ 抓取 Google News 品牌新聞…")
    google_items = fetch_google_news()
    source_items["Google News"] = google_items
    agent_pool.extend(google_items)
    agent_items = merge_agent_items(agent_pool)
    generated_at = datetime.now(TAIWAN_TZ).strftime("%Y-%m-%d %H:%M")
    render_html(results, agent_items, generated_at)

    sources = [f["name"] for f in FEEDS] + [f["name"] for f in AGENT_FEEDS] + ["Google News"]
    ok = sum(1 for name in sources if source_items.get(name))
    total = sum(len(v) for v in results.values()) + len(agent_items)
    line = f"[{generated_at}] 完成：{ok}/{len(sources)} 來源成功，共 {total} 則\n"
    with open("run_log.txt", "a", encoding="utf-8") as f:
        f.write(line)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"✖ 執行失敗: {e}", file=sys.stderr)
        sys.exit(1)
