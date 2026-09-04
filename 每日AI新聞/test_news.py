# -*- coding: utf-8 -*-
"""每日 AI 新聞 — 純函式單元測試（stdlib unittest）
執行：python -m unittest test_news -v
"""
import sys
import os
import unittest
from unittest import mock
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_news as fn

TW = timezone(timedelta(hours=8))


class TestMatchBrands(unittest.TestCase):
    def test_gemini(self):
        self.assertEqual(fn.match_brands("Gemini 新功能上線", ""), ["Gemini"])

    def test_chatgpt_openai(self):
        self.assertEqual(fn.match_brands("ChatGPT 推出新版本", ""), ["ChatGPT"])

    def test_case_insensitive(self):
        self.assertEqual(fn.match_brands("GEMINI 大更新", ""), ["Gemini"])

    def test_claude(self):
        self.assertEqual(fn.match_brands("Claude 3.7", ""), ["Claude"])

    def test_multiple_brands(self):
        got = set(fn.match_brands("Gemini vs ChatGPT", ""))
        self.assertEqual(got, {"Gemini", "ChatGPT"})

    def test_match_in_summary(self):
        self.assertEqual(fn.match_brands("某標題", "Anthropic 發表新模型"), ["Claude"])

    def test_no_match(self):
        self.assertEqual(fn.match_brands("台積電先進製程", ""), [])

    def test_other_brands(self):
        self.assertEqual(fn.match_brands("DeepSeek 發布新模型", ""), ["其他"])


class TestMergeAgentItems(unittest.TestCase):
    def item(self, title, link, time, brands, source="S"):
        return {"title": title, "link": link, "summary": "", "time": time,
                "brands": brands, "source": source}

    def test_dedupe_by_link(self):
        a = self.item("A", "http://x", None, ["Gemini"])
        b = self.item("B", "http://x", None, ["Claude"])
        self.assertEqual(len(fn.merge_agent_items([a, b])), 1)

    def test_sort_by_time_desc(self):
        old = self.item("old", "http://1", datetime(2026, 8, 14, 10, 0, tzinfo=TW), ["Gemini"])
        new = self.item("new", "http://2", datetime(2026, 8, 15, 10, 0, tzinfo=TW), ["ChatGPT"])
        out = fn.merge_agent_items([old, new])
        self.assertEqual([i["title"] for i in out], ["new", "old"])

    def test_skips_non_brand_items(self):
        it = self.item("台積電", "http://1", None, [])
        self.assertEqual(fn.merge_agent_items([it]), [])


class TestAgentQuery(unittest.TestCase):
    def test_contains_brand_keywords(self):
        q = fn.agent_query()
        self.assertIn("Gemini", q)
        self.assertIn("ChatGPT", q)
        self.assertIn("Claude", q)
        self.assertIn(" OR ", q)
        self.assertNotIn('"其他"', q)
        self.assertIn("deepseek", q.lower())


class TestIsEnglish(unittest.TestCase):
    def test_english_detected(self):
        self.assertTrue(fn.is_english("Neocloud Lambda secures $1B in debt to buy more chips"))
        self.assertTrue(fn.is_english("An Anthropic researcher just gave us a peek at self-improving AI"))

    def test_chinese_not_detected(self):
        self.assertFalse(fn.is_english("台積電先進製程 晶圓代工增溫，需求回溫"))

    def test_mixed_chinese_title_not_detected(self):
        self.assertFalse(fn.is_english("ChatGPT續宰AI流量龍頭 泰國全球排名第26"))

    def test_mixed_openai_title_not_detected(self):
        self.assertFalse(fn.is_english("OpenAI提出網路集體防禦行動，獲Google、Anthropic及微軟等上百家企業呼應"))

    def test_empty_false(self):
        self.assertFalse(fn.is_english(""))

    def test_zh_google_news_title_with_publisher_suffix(self):
        title = "創作者因推廣Claude慘遭「微取消」，她說使用AI正成社會禁忌 - Business Insider Taiwan"
        self.assertTrue(fn.is_english(title, 0.5))
        self.assertFalse(fn.is_english(title, 0.8))


class TestTranslateIfEnglish(unittest.TestCase):
    def test_translates_english_keeps_orig(self):
        item = {"title": "Neocloud secures $1B", "summary": "English summary here", "link": "http://x"}
        with mock.patch("fetch_news.google_translate", return_value="中文翻譯") as mt:
            fn.translate_if_english(item, "en")
        self.assertEqual(item["title"], "中文翻譯")
        self.assertEqual(item["summary"], "中文翻譯")
        self.assertEqual(item["orig"], {"title": "Neocloud secures $1B", "summary": "English summary here"})
        self.assertEqual(mt.call_count, 2)

    def test_zh_item_with_publisher_suffix_untouched(self):
        item = {"title": "創作者因推廣Claude慘遭「微取消」，她說使用AI正成社會禁忌 - Business Insider Taiwan",
                "summary": "她說使用AI正成社會禁忌 Business Insider Taiwan", "link": "http://x"}
        with mock.patch("fetch_news.google_translate", side_effect=AssertionError("不應呼叫翻譯")):
            fn.translate_if_english(item, "zh")
        self.assertEqual(item["title"], "創作者因推廣Claude慘遭「微取消」，她說使用AI正成社會禁忌 - Business Insider Taiwan")
        self.assertNotIn("orig", item)

    def test_pure_english_title_translated_even_in_zh_feed(self):
        item = {"title": "Researcher shows how Claude Code can be tricked by asking it to summarize a website",
                "summary": "A short English summary here.", "link": "http://x"}
        with mock.patch("fetch_news.google_translate", return_value="中文翻譯") as mt:
            fn.translate_if_english(item, "zh")
        self.assertEqual(item["title"], "中文翻譯")
        self.assertEqual(item["orig"]["title"], "Researcher shows how Claude Code can be tricked by asking it to summarize a website")

    def test_translation_failure_no_orig(self):
        item = {"title": "Neocloud secures $1B", "summary": "English summary here", "link": "http://x"}
        with mock.patch("fetch_news.google_translate", side_effect=lambda s: s):
            fn.translate_if_english(item)
        self.assertEqual(item["title"], "Neocloud secures $1B")
        self.assertNotIn("orig", item)

    def test_chinese_item_untouched(self):
        item = {"title": "台積電先進製程 需求回溫", "summary": "晶圓代工出貨成長", "link": "http://x"}
        with mock.patch("fetch_news.google_translate", side_effect=AssertionError("不應呼叫翻譯")):
            fn.translate_if_english(item)
        self.assertEqual(item["title"], "台積電先進製程 需求回溫")
        self.assertNotIn("orig", item)


class TestGoogleTranslate(unittest.TestCase):
    def test_falls_back_when_first_client_blocked(self):
        calls = []

        def fake_get(url, params=None, headers=None, timeout=None):
            calls.append(params["client"])

            class R:
                pass

            r = R()
            if params["client"] == "dict-chrome-ex":
                r.raise_for_status = lambda: (_ for _ in ()).throw(
                    Exception("429 Too Many Requests")
                )
            else:
                r.raise_for_status = lambda: None
                r.json = lambda: [[["你好世界", "Hello world", None, None]]]
            return r

        with mock.patch("fetch_news.requests.get", side_effect=fake_get):
            result = fn.google_translate("Hello world")
        self.assertEqual(result, "你好世界")
        self.assertEqual(calls, ["dict-chrome-ex", "gtx"])

    def test_returns_original_on_all_fail(self):
        with mock.patch("fetch_news.requests.get", side_effect=Exception("network down")):
            self.assertEqual(fn.google_translate("Hello world"), "Hello world")


class TestChTime(unittest.TestCase):
    def test_parses_valid_datetime(self):
        dt = fn.parse_ch_time("2026-09-04 14:27:08")
        self.assertEqual(dt, datetime(2026, 9, 4, 14, 27, 8, tzinfo=TW))

    def test_invalid_returns_none(self):
        self.assertIsNone(fn.parse_ch_time("not a date"))
        self.assertIsNone(fn.parse_ch_time(""))
        self.assertIsNone(fn.parse_ch_time(None))


class TestChArticle(unittest.TestCase):
    def _raw(self, **over):
        base = {"id": 1, "type": "article", "item_id": 94534,
                "title": "兩大癲癇藥成做菜辛香料？",
                "preface": "前言摘要", "item_datetime": "2026-09-04 14:27:08",
                "channel_name": "生活智慧", "link": "https://www.commonhealth.com.tw/article/94534"}
        base.update(over)
        return base

    def test_parses_article_fields(self):
        a = fn.parse_ch_article(self._raw())
        self.assertEqual(a["title"], "兩大癲癇藥成做菜辛香料？")
        self.assertEqual(a["link"], "https://www.commonhealth.com.tw/article/94534")
        self.assertEqual(a["summary"], "前言摘要")
        self.assertEqual(a["channel"], "生活智慧")
        self.assertEqual(a["time"], datetime(2026, 9, 4, 14, 27, 8, tzinfo=TW))

    def test_skips_non_article_type(self):
        expert = {"id": 1, "type": "expert", "title": "專家", "link": "http://x"}
        self.assertIsNone(fn.parse_ch_article(expert))

    def test_skips_missing_title(self):
        self.assertIsNone(fn.parse_ch_article(self._raw(title="   ")))

    def test_bad_time_gives_none(self):
        a = fn.parse_ch_article(self._raw(item_datetime="bad"))
        self.assertIsNone(a["time"])


class TestChApi(unittest.TestCase):
    def test_latest_failure_returns_empty(self):
        with mock.patch("fetch_news.ch_api_get", return_value={}):
            self.assertEqual(fn.fetch_ch_latest(), [])

    def test_latest_parses_filters_and_sorts(self):
        data = {"items": {"list": [
            {"type": "article", "title": "舊新聞", "preface": "p",
             "item_datetime": "2026-09-03 10:00:00", "channel_name": "醫療", "link": "http://a"},
            {"type": "article", "title": "新新聞", "preface": "q",
             "item_datetime": "2026-09-04 10:00:00", "channel_name": "運動", "link": "http://b"},
            {"type": "expert", "title": "要跳過", "preface": "", "id": 99},
        ]}}
        with mock.patch("fetch_news.ch_api_get", return_value=data):
            items = fn.fetch_ch_latest()
        self.assertEqual([i["title"] for i in items], ["新新聞", "舊新聞"])
        self.assertEqual(items[0]["channel"], "運動")

    def test_theme_failure_returns_empty_tuple(self):
        with mock.patch("fetch_news.ch_api_get", return_value={}):
            self.assertEqual(fn.fetch_ch_theme(), (None, None, []))

    def test_theme_parses(self):
        data = {"items": {"title": "AI上工你準備好了嗎？", "description": "主題描述",
                          "items": [
                              {"type": "article", "title": "主題文", "preface": "s",
                               "item_datetime": "2026-04-15 16:30:25", "channel_name": "醫療",
                               "link": "http://t"}]}}
        with mock.patch("fetch_news.ch_api_get", return_value=data):
            title, desc, items = fn.fetch_ch_theme()
        self.assertEqual(title, "AI上工你準備好了嗎？")
        self.assertEqual(desc, "主題描述")
        self.assertEqual([i["title"] for i in items], ["主題文"])


class TestBuildHealthHtml(unittest.TestCase):
    def _item(self, title, channel="營養", time=None):
        return {"title": title, "link": "http://c", "summary": "摘要",
                "time": time, "channel": channel}

    def test_latest_section(self):
        html = fn.build_health_html([self._item("健康文章")], None, None, [])
        self.assertIn("最新健康內容", html)
        self.assertIn("健康文章", html)
        self.assertIn("康健", html)
        self.assertIn("營養", html)

    def test_theme_section(self):
        html = fn.build_health_html([], "AI上工你準備好了嗎？", "主題描述",
                                    [self._item("主題文章", "運動")])
        self.assertIn("熱門話題：AI上工你準備好了嗎？", html)
        self.assertIn("主題文章", html)
        self.assertIn("主題描述", html)

    def test_empty_state(self):
        html = fn.build_health_html([], None, None, [])
        self.assertIn("今天抓不到康健內容，請稍後再試。", html)
        self.assertIn("今天抓不到熱門話題，請稍後再試。", html)


class TestBuildPageHtml(unittest.TestCase):
    def test_page_has_tabs_and_agent_badges(self):
        results = {
            "iThome": [{"title": "一般新聞", "link": "http://a", "summary": "", "time": None,
                        "source": "iThome", "brands": []}],
        }
        agent = [{"title": "Gemini 更新", "link": "http://b", "summary": "", "time": None,
                  "brands": ["Gemini"], "source": "Google News"}]
        html = fn.build_page_html(results, agent, "2026-08-15 00:00")
        self.assertIn('data-tab="ai-news"', html)
        self.assertIn('data-tab="ai-agent"', html)
        self.assertIn("switchTab('ai-news')", html)
        self.assertIn("brand-tag", html)
        self.assertIn("Gemini", html)
        self.assertIn("Google News", html)
        self.assertIn("一般新聞", html)

    def test_empty_agent_message(self):
        html = fn.build_page_html({}, [], "2026-08-15 00:00")
        self.assertIn("今天沒有抓到品牌 AI 新聞", html)

    def test_bilingual_item_renders_orig(self):
        results = {
            "TechCrunch AI": [{"title": "中文標題", "summary": "中文摘要", "link": "http://a",
                               "time": None, "source": "TechCrunch AI", "brands": [],
                               "orig": {"title": "English title", "summary": "English summary"}}],
        }
        html = fn.build_page_html(results, [], "2026-08-29 00:00")
        self.assertIn("class='orig'", html)
        self.assertIn("English title", html)
        self.assertIn("English summary", html)

    def test_chinese_item_no_orig_line(self):
        results = {
            "iThome": [{"title": "一般新聞", "summary": "一般摘要", "link": "http://a",
                        "time": None, "source": "iThome", "brands": []}],
        }
        html = fn.build_page_html(results, [], "2026-08-29 00:00")
        self.assertNotIn("class='orig'", html)

    def test_agent_bilingual_renders_orig(self):
        agent = [{"title": "中文標題", "summary": "中文摘要", "link": "http://b", "time": None,
                  "brands": ["Gemini"], "source": "Google News",
                  "orig": {"title": "English title", "summary": "English summary"}}]
        html = fn.build_page_html({}, agent, "2026-08-29 00:00")
        self.assertIn("English title", html)
        self.assertIn("English summary", html)


if __name__ == "__main__":
    unittest.main()
