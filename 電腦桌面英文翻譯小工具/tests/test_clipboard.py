"""clipboard 擷取邏輯的單元測試（不觸發真實 Ctrl+C）。"""
import sys
import os
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core import clipboard


class TestCaptureSelection(unittest.TestCase):
    @mock.patch.object(clipboard, "send_copy")
    @mock.patch.object(clipboard, "read")
    def test_returns_text_when_changed(self, mock_read, mock_send):
        # prev="old"；模擬 Ctrl+C 後剪貼簿變成 "hello"
        mock_read.side_effect = ["old", "hello", "hello"]
        result = clipboard.capture_selection("old", timeout=0.2)
        self.assertEqual(result, "hello")

    @mock.patch.object(clipboard, "send_copy")
    @mock.patch.object(clipboard, "read")
    def test_returns_none_when_unchanged(self, mock_read, mock_send):
        mock_read.return_value = "old"
        result = clipboard.capture_selection("old", timeout=0.1)
        self.assertIsNone(result)

    @mock.patch.object(clipboard, "send_copy")
    @mock.patch.object(clipboard, "read")
    def test_none_when_empty(self, mock_read, mock_send):
        mock_read.return_value = ""
        result = clipboard.capture_selection("old", timeout=0.1)
        self.assertIsNone(result)


class TestRestore(unittest.TestCase):
    @mock.patch.object(clipboard.pyperclip, "copy")
    def test_restore(self, mock_copy):
        clipboard.restore("original")
        mock_copy.assert_called_once_with("original")


if __name__ == "__main__":
    unittest.main()
