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
    params = {"client": "gtx", "sl": src, "tl": dst, "dt": "t", "q": text}
    try:
        r = requests.get(url, params=params, headers=UA, timeout=15)
        r.raise_for_status()
        parts = r.json()[0]
        return "".join(p[0] for p in parts if p and p[0])
    except Exception:
        return text


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
            it["title"] = google_translate(it["title"]) or it["title"]
            if it["summary"]:
                it["summary"] = google_translate(it["summary"]) or it["summary"]
            time.sleep(0.6)
    else:
        print(f"  [{name}] {len(items)} 則")

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
    out.sort(key=lambda x: x["time"] or datetime.min.replace(tzinfo=TAIWAN_TZ), reverse=True)
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
                it["title"] = google_translate(it["title"]) or it["title"]
                if it["summary"]:
                    it["summary"] = google_translate(it["summary"]) or it["summary"]
                time.sleep(0.6)
        else:
            print(f"  [Google News {cfg['hl']}] {len(items)} 則")
        all_items.extend(items)
    return all_items


def fmt_time(dt):
    return dt.strftime("%m/%d %H:%M") if dt else ""


def render_html(results, generated_at):
    css = """
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
    footer{color:var(--muted);font-size:12px;text-align:center;margin-top:40px}
    """
    cards = {f["name"]: f for f in FEEDS}
    body = []
    for name in [f["name"] for f in FEEDS]:
        items = results.get(name, [])
        if not items:
            continue
        sec = [f"<section><h2>{name} <span class='count'>({len(items)} 則)</span></h2>"]
        for it in items:
            badge = "<span class='badge'>翻譯</span>" if cards[name]["lang"] == "en" else ""
            t = fmt_time(it["time"])
            sec.append(
                f"<div class='card'><a href='{html.escape(it['link'])}' target='_blank' rel='noopener'>"
                f"{html.escape(it['title'])}</a>"
                f"<div class='summary'>{html.escape(it['summary'])}</div>"
                f"<div class='meta'>{badge}<span>{t}</span></div></div>"
            )
        sec.append("</section>")
        body.append("\n".join(sec))

    if not body:
        body = ["<p>今天沒有抓到新聞，請稍後再試。</p>"]

    page = f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>每日 AI 新聞</title>
<style>{css}</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>📰 每日 AI 新聞</h1>
  <div class="date">更新時間：{generated_at}　｜　來源：iThome、科技新報、TechCrunch AI、MIT Technology Review</div>
</header>
{''.join(body)}
<footer>由 fetch_news.py 自動產生　・　每日自動更新</footer>
</div>
</body>
</html>"""
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        f.write(page)
    total = sum(len(v) for v in results.values())
    print(f"✔ 已生成 {OUT_FILE}（共 {total} 則）")


def main():
    start = datetime.now(TAIWAN_TZ)
    print(f"[{start.strftime('%Y-%m-%d %H:%M')}] 開始抓取…")
    results = {}
    agent_pool = []
    for feed in FEEDS:
        print(f"▸ 抓取 {feed['name']}…")
        items = fetch_feed(feed)
        results[feed["name"]] = items
        agent_pool.extend(items)
    for feed in AGENT_FEEDS:
        print(f"▸ 抓取 {feed['name']}…")
        agent_pool.extend(fetch_feed(feed))
    print("▸ 抓取 Google News 品牌新聞…")
    agent_pool.extend(fetch_google_news())
    agent_items = merge_agent_items(agent_pool)
    generated_at = datetime.now(TAIWAN_TZ).strftime("%Y-%m-%d %H:%M")
    render_html(results, agent_items, generated_at)

    total = sum(len(v) for v in results.values())
    ok = sum(1 for v in results.values() if v)
    line = f"[{generated_at}] 完成：{ok}/4 來源成功，共 {total} 則\n"
    with open("run_log.txt", "a", encoding="utf-8") as f:
        f.write(line)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"✖ 執行失敗: {e}", file=sys.stderr)
        sys.exit(1)
