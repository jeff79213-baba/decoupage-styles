"""translate 的離線純邏輯單元測試。

翻譯來源已從 Google（被限流）改為 MyMemory + dictionaryapi.dev，
網路呼叫不在此測試（避免離線/不穩定），只測可離線的判斷與清理邏輯。
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core import translate


class TestLooksChinese(unittest.TestCase):
    def test_english(self):
        self.assertFalse(translate._looks_chinese("apple"))

    def test_traditional_chinese(self):
        self.assertTrue(translate._looks_chinese("蘋果"))

    def test_simplified_chinese(self):
        self.assertTrue(translate._looks_chinese("苹果"))

    def test_mixed(self):
        self.assertTrue(translate._looks_chinese("good 你好"))


class TestWordRegex(unittest.TestCase):
    def test_single_word(self):
        self.assertRegex("apple", translate._WORD_RE)

    def test_with_apostrophe(self):
        self.assertRegex("don't", translate._WORD_RE)

    def test_phrase_not_word(self):
        self.assertIsNone(translate._WORD_RE.match("great day"))

    def test_chinese_not_word(self):
        self.assertIsNone(translate._WORD_RE.match("蘋果"))


class TestCleanMyMemory(unittest.TestCase):
    def test_simple(self):
        self.assertEqual(translate._clean_mymemory("蘋果"), "蘋果")

    def test_no_query(self):
        self.assertEqual(translate._clean_mymemory("NO QUERY SPECIFIED"), "")

    def test_empty(self):
        self.assertEqual(translate._clean_mymemory(""), "")
        self.assertEqual(translate._clean_mymemory(None), "")

    def test_multiple_parts(self):
        self.assertEqual(translate._clean_mymemory("美好的一天|美好"), "美好的一天 / 美好")


class TestResultStructure(unittest.TestCase):
    def test_default_words_empty_list(self):
        r = translate.TranslationResult(source_text="x")
        self.assertEqual(r.words, [])
        self.assertEqual(r.translated_text, "")
        self.assertEqual(r.phonetic, "")


if __name__ == "__main__":
    unittest.main()
