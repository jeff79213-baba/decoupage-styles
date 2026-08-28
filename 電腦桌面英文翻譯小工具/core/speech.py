"""發音朗讀（離線 Windows TTS）。"""
import threading

try:
    import pyttsx3
    _HAS_TTS = True
except Exception:  # pragma: no cover
    _HAS_TTS = False

_lock = threading.Lock()


def speak(text: str, lang: str = "en") -> None:
    """在背景執行緒朗讀指定文字。"""
    if not _HAS_TTS:
        return
    if not text.strip():
        return

    def _run():
        try:
            with _lock:
                engine = pyttsx3.init()
                voices = engine.getProperty("voices")
                rate = engine.getProperty("rate")
                engine.setProperty("rate", rate - 20)
                selected = False
                for v in voices:
                    name = (v.name or "").lower()
                    ident = (getattr(v, "id", "") or "").lower()
                    if lang == "en":
                        if "english" in name or "en-" in ident or "david" in name or "zira" in name:
                            engine.setProperty("voice", v.id)
                            selected = True
                            break
                    else:
                        if ("chinese" in name or "zh-" in ident or "tracy" in name or "hanhan" in name):
                            engine.setProperty("voice", v.id)
                            selected = True
                            break
                if not selected:
                    engine.setProperty("voice", voices[0].id if voices else None)
                engine.say(text)
                engine.runAndWait()
                engine.stop()
        except Exception:
            pass

    threading.Thread(target=_run, daemon=True).start()
