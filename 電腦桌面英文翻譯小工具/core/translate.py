"""免費翻譯介面：MyMemory 翻譯 + dictionaryapi.dev 音標。

原使用的 Google 免費介面（translate.googleapis.com/translate_a/single）
在此環境已被限流（HTTP 429），故改用：
- 翻譯：MyMemory（free，en<->zh-TW）
- 音標：dictionaryapi.dev（僅英文單字，best-effort）
兩者皆失敗時回傳空結果，不拋例外。
"""
import re
import threading
from dataclasses import dataclass
from typing import List, Optional
from urllib.parse import quote

import requests

_CJK = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf]")
_WORD_RE = re.compile(r"^[A-Za-z][A-Za-z'-]*$")


@dataclass
class Word:
    text: str
    definition: str
    phonetic: str = ""


@dataclass
class TranslationResult:
    source_text: str
    translated_text: str = ""
    phonetic: str = ""
    words: List[Word] = None

    def __post_init__(self):
        if self.words is None:
            self.words = []


_TIMEOUT = 10
_MY_MEMORY_URL = "https://api.mymemory.translated.net/get"
_DICT_API_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/"

# 重用連線（keep-alive），省下每次的 TLS 握手時間
_SESSION = requests.Session()
_SESSION.headers.update({"User-Agent": "Mozilla/5.0"})
_SESSION_LOCK = threading.Lock()


def _looks_chinese(text: str) -> bool:
    return bool(_CJK.search(text))


def _clean_mymemory(translated: str) -> str:
    """清理 MyMemory 回傳文字：處理多結果(|分隔)、空、錯誤訊息。"""
    if not translated or translated.startswith("NO QUERY"):
        return ""
    parts = [p.strip() for p in translated.split("|") if p.strip()]
    return " / ".join(parts) if parts else ""


def translate(text: str) -> TranslationResult:
    """翻譯文字，回傳翻譯（與英文單字的音標）。

    翻譯與音標以並行執行緒抓取，避免兩個 API 串行累加延遲。
    """
    text = (text or "").strip()
    result = TranslationResult(source_text=text)
    if not text:
        return result

    is_chinese = _looks_chinese(text)
    src = "zh-TW" if is_chinese else "en"
    tgt = "en" if is_chinese else "zh-TW"

    # 音標僅對英文單字有意義
    need_phonetic = (not is_chinese and _WORD_RE.match(text))

    results = {}
    threads = []
    threads.append(threading.Thread(
        target=lambda: results.__setitem__("trans", _translate_mymemory(text, src, tgt)),
        daemon=True))
    if need_phonetic:
        threads.append(threading.Thread(
            target=lambda: results.__setitem__("phon", _get_phonetic(text)),
            daemon=True))
    for th in threads:
        th.start()
    for th in threads:
        th.join()

    result.translated_text = results.get("trans", "")
    result.phonetic = results.get("phon", "")
    return result


def _translate_mymemory(text: str, src: str, tgt: str) -> str:
    # 多字詞以逗號分隔，MyMemory 支援以 |/分隔多句
    q = text.replace("\n", " ").strip()
    params = {"q": q, "langpair": f"{src}|{tgt}"}
    try:
        resp = _SESSION.get(_MY_MEMORY_URL, params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        result = data.get("responseData") or {}
        translated = result.get("translatedText") or ""
        return _clean_mymemory(translated)
    except Exception:
        return ""


def _get_phonetic(text: str) -> str:
    try:
        resp = _SESSION.get(_DICT_API_URL + quote(text), timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        if not isinstance(data, list) or not data:
            return ""
        entry = data[0]
        phonetic = (entry or {}).get("phonetic") or ""
        if not phonetic:
            for ph in ((entry or {}).get("phonetics") or []):
                if ph and ph.get("text"):
                    phonetic = ph["text"]
                    break
        return phonetic or ""
    except Exception:
        return ""


def get_phonetic(text: str) -> Optional[str]:
    """僅取得英文單字的音標（簡易）。"""
    result = translate(text)
    return result.phonetic or None
