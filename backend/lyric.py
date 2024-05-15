import random as rd
from typing import Any, Generator, Iterable, TypeVar

import toml
from base import ProjPath
from pypinyin import lazy_pinyin

T = TypeVar("T")

EQUALS_MAP = {"C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb"}
with open(ProjPath.core_datas / "phones.toml", encoding="utf-8") as fp:
    PHONES_MAP: dict[str, list[str]] = toml.load(fp)


def rand_v(val: float, freq: float = 0.1) -> float:
    stat = rd.randint(0, 1)
    if stat:
        return val + rd.random() * freq * val
    else:
        return val - rd.random() * freq * val


class Note:
    def __init__(
        self,
        pitch: str,
        length: int,
        len_unit: int = 4,
    ) -> None:
        self.pitch = pitch
        self.length = length
        self.len_unit = len_unit
        self.pitch_str = self._pitch_str()

    def _pitch_str(self) -> str:
        if self.pitch[-2] == "#":
            return "{}/{}{}".format(
                self.pitch, EQUALS_MAP[self.pitch[:-1]], self.pitch[-1]
            )
        else:
            return self.pitch

    def get_time(self, bpm: int, beat_unit: int = 4) -> float:
        beats = 1 / self.len_unit * self.length / (1 / beat_unit)
        t = 60 / bpm * beats
        return round(t, 6)


class Lyric:
    def __init__(
        self, texts: list[str], notes: list[Note], bpm: int, beat_unit: int = 4
    ) -> None:
        if len(notes) != len(texts):
            raise RuntimeError("音符数和字数不对应")

        self.texts = texts
        self.texts: list[str] = []
        for text in texts:
            if text == "SP":
                self.texts.append("-")
            elif text == "AP":
                self.texts.append("=")
            else:
                self.texts.append(text)

        self.bpm = bpm
        self.beat_unit = beat_unit
        self.notes = notes
        self.phones, self.repeat_map = self._extract_phones(self.texts)

    def _extract_phones(self, texts: list[str]) -> tuple[list[str], list[int]]:
        all_phones: list[str] = []
        repeats: list[int] = []
        pys = lazy_pinyin("".join(texts))

        for py in pys:
            if py[0] not in ("-", "="):
                phones = PHONES_MAP[py]
                all_phones.extend(phones)
                repeats.append(len(phones))
                continue
            for char in py:
                if char == "-":
                    all_phones.append("SP")
                elif char == "=":
                    all_phones.append("AP")
                else:
                    raise RuntimeError(f"预期外的符号类型：{char}")
                repeats.append(1)
        return all_phones, repeats

    def _phone_align(self, seq: Iterable[T]) -> Generator[T, Any, None]:
        for idx, elem in enumerate(seq):
            for _ in range(self.repeat_map[idx]):
                yield elem

    def get_texts(self) -> list[str]:
        return list(map(lambda x: "" if x in ("-", "=") else x, self.texts))

    def get_phones(self) -> list[str]:
        return self.phones

    def get_pitches(self) -> list[str]:
        return list(map(lambda x: x.pitch_str, self._phone_align(self.notes)))

    def get_times(self, rand_range: float = 0.1) -> list[float]:
        ts = map(
            lambda x: x.get_time(self.bpm, self.beat_unit),
            self._phone_align(self.notes),
        )
        return list(map(lambda x: round(rand_v(x, rand_range), 6), ts))

    def get_infer_str(self, rand_range: float = 0.1) -> str:
        slist = (
            "".join(self.get_texts()),
            " ".join(self.get_phones()),
            " ".join(self.get_pitches()),
            " ".join(map(str, self.get_times(rand_range))),
            " ".join("0" for _ in range(sum(self.repeat_map))),
            " ".join("0" for _ in range(sum(self.repeat_map))),
        )
        return "|".join(slist)


if __name__ == "__main__":
    notes = [
        Note("C4", length=1),
        Note("C4", length=1),
        Note("rest", length=1, len_unit=32),
        Note("D#4", length=1),
        Note("G#4", length=2),
        Note("rest", length=1, len_unit=32),
        Note("G#4", length=2),
        Note("rest", length=1, len_unit=16),
        Note("rest", length=3, len_unit=16),
    ]
    texts = ["天", "气", "SP", "真", "好", "SP", "啊", "SP", "AP"]
    l = Lyric(texts, notes, 135)
    print(l.get_infer_str())
