# -*- coding: utf-8 -*-
"""每日 AI 新聞 — 純函式單元測試（stdlib unittest）
執行：python -m unittest test_news -v
"""
import sys
import os
import unittest
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


if __name__ == "__main__":
    unittest.main()
