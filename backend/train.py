import io
import os
import subprocess
import sys
import threading
from concurrent.futures import ProcessPoolExecutor
from functools import partial
from multiprocessing import cpu_count
from time import sleep
import time
from typing import Iterable, Literal, Optional, TypeVar

import toml

sys.path.append("..")
from base import ProjPath
from config import ConfigManager
from pydub import AudioSegment

from preprocess.preprocess import process_utterance
from utils.utils import get_hparams_from_file

T = TypeVar("T")


class DataManager:
    def __init__(self, namespace: str) -> None:
        self.space_dir = ProjPath.get_space(namespace)
        self.train_datas_dir = ProjPath.get_train_datas(namespace)
        self.wav_dir = (self.train_datas_dir / "wavs").init()
        self.records_file = (self.space_dir / "trainset.toml").init_with(toml.dumps({}))
        self.records_buf = {}

        self._records: dict | None = None

    @property
    def records(self) -> dict:
        if self._records is None:
            self._records = self._read_records()
        return self._records

    def _read_records(self) -> dict:
        with open(self.records_file, encoding="utf-8") as fp:
            return toml.load(fp)

    def _write_records(self, records: dict) -> None:
        with open(self.records_file, "w", encoding="utf-8") as fp:
            toml.dump(records, fp)

    def save(
        self,
        audio: bytes,
        ext: Literal["flac", "wav", "mp3"],
        file_name: str,
        texts: str,
        phones: list[str],
        pitches: list[str],
        note_durs: list[float],
        phone_durs: list[float],
        slurs: Optional[list[Literal[0, 1]]] = None,
    ) -> None:
        """保存音频文件"""
        file_path = self.wav_dir / f"{file_name}.{ext}"
        audio_in = io.BytesIO(audio)
        audio_out = io.BytesIO()

        if ext not in ["flac", "wav", "mp3"]:
            raise RuntimeError("音频扩展名不支持")

        if ext != "wav":
            audio = AudioSegment.from_file(audio_in, format=ext)
            audio.export(audio_out, format="wav")
        else:
            audio_out.write(audio)
        with open(file_path, "wb") as fp:
            fp.write(audio_out.getvalue())

        if file_name in self.records_buf.keys():
            raise RuntimeError("文件名重复，重复的文件名为", file_name)
        self.records_buf[file_name] = {
            "texts": texts,
            "phones": phones,
            "pitches": pitches,
            "note_durs": note_durs,
            "phone_durs": phone_durs,
            "slurs": (
                slurs if slurs is not None else [0 for i in range(len(phone_durs))]
            ),
        }

    def flush(self, ignore_same: bool = False) -> None:
        try:
            records = self._read_records()
            for fn in self.records_buf.keys():
                if not ignore_same and fn in records.keys():
                    raise RuntimeError("文件名重复，重复的文件名为", fn)
            records.update(self.records_buf)
            self._records = records
            self._write_records(records)
        finally:
            self.records_buf.clear()


class Trainer:
    def __init__(self, namespace: str) -> None:
        self.data_manager = DataManager(namespace)
        self.config_manager = ConfigManager(namespace)
        self.train_datas_dir = ProjPath.get_train_datas(namespace)
        self.mel_dirs = self.train_datas_dir / "mels"
        self.pitch_dirs = self.train_datas_dir / "pitch"

        self.process: subprocess.Popen[bytes] | None = None
        self.p_forward = threading.Event()

    @property
    def records(self) -> dict:
        return self.data_manager.records

    @property
    def splited_records(self) -> tuple[dict, dict]:
        return map(dict, self._split(list(self.records.items()), (0.75, 0.25)))

    def get_info(self) -> dict:
        files_num = len(os.listdir(self.mel_dirs.init()))
        audio_num = len(self.records)
        return {
            "preprocess": files_num,
            "files": audio_num,
            "matched": files_num == audio_num,
        }

    def gen_train(self, new: bool = False) -> None:
        self.train_recs, self.test_recs = self.splited_records

        (self.train_datas_dir / "file.list").init_with(
            func=lambda: "\n".join(self.records.keys()) + "\n", force=new
        )
        (self.train_datas_dir / "train.list").init_with(
            func=lambda: "\n".join(self.train_recs.keys()) + "\n", force=new
        )
        (self.train_datas_dir / "test.list").init_with(
            func=lambda: "\n".join(self.test_recs.keys()) + "\n", force=new
        )
        (self.train_datas_dir / "transcription.txt").init_with(
            func=lambda: "\n".join(
                [self._gen_txt_line(k, v) for k, v in self.records.items()]
            )
            + "\n",
            force=new,
        )
        (self.train_datas_dir / "trainset.txt").init_with(
            func=lambda: "\n".join(
                [self._gen_txt_line(k, v) for k, v in self.train_recs.items()]
            )
            + "\n",
            force=new,
        )
        (self.train_datas_dir / "testset.txt").init_with(
            func=lambda: "\n".join(
                [self._gen_txt_line(k, v) for k, v in self.test_recs.items()]
            )
            + "\n",
            force=new,
        )

    def preprocess(self):
        self.gen_train(True)
        self.mel_dirs.init()
        self.pitch_dirs.init()

        file_list_file = self.train_datas_dir / "file.list"
        if not file_list_file.exists():
            with open(file_list_file, "w") as out_file:
                for f in os.listdir(self.train_datas_dir / "wavs"):
                    out_file.write(f.strip().split(".")[0] + "\n")

        metadata = [item.strip() for item in open(file_list_file).readlines()]
        executor = ProcessPoolExecutor(max_workers=cpu_count() // 2)
        futs = []
        hps = get_hparams_from_file(self.config_manager.config_path)
        for item in metadata:
            futs.append(
                executor.submit(
                    partial(process_utterance, hps, self.train_datas_dir, item)
                )
            )

        timestamp = time.time()
        for idx, task in enumerate(futs):
            task.result()
            progress = (idx + 1) / len(futs)

            if time.time() - timestamp >= 0.3:
                timestamp = time.time()
                yield f"data: {progress:.4f}\n\n"

        yield "data: end\n\n"

    def train(self) -> None:
        if self.process is not None:
            raise RuntimeError("训练正在运行中")

        env = os.environ.copy()
        env["PYTHONPATH"] = "E:/projects/Python/deep-learning/visinger2"
        env["PYTHONIOENCODING"] = "UTF-8"
        self.process = subprocess.Popen(
            [
                "python",
                "-X",
                "utf8",
                "E:/projects/Python/deep-learning/visinger2/egs/visinger2/train.py",
                "-c",
                self.config_manager.config_path,
            ],
            env=env,
            cwd="E:/projects/Python/deep-learning/visinger2",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

    def forward(self):
        if self.process is None:
            raise RuntimeError("尚未开始训练，无法转发")
        self.p_forward.set()

        def outputer():
            while True:
                if not self.p_forward.is_set():
                    yield "data: end\n\n"
                    return
                else:
                    line = self.process.stdout.readline().decode()
                    yield f"data: {line}\n\n"
                    sleep(0.25)

        return outputer()

    def forward_stop(self) -> None:
        self.p_forward.clear()

    def train_stop(self) -> None:
        if self.process is None:
            raise RuntimeError("未进行训练，无需停止")

        self.forward_stop()
        self.process.terminate()
        self.process.wait(timeout=5)
        if self.process.returncode is None:
            self.process.kill()
        self.process = None

    def _split(
        self, seq: Iterable[T], ratio: tuple[float]
    ) -> tuple[Iterable[T], Iterable[T]]:
        if not all(ratio) or abs(sum(ratio) - 1) > 1e-6:
            raise ValueError("比例之和必须为1")
        cnt = len(seq)
        split_point = int(cnt * ratio[0])
        first = seq[:split_point]
        second = seq[split_point:]
        return first, second

    def _gen_txt_line(self, filename: str, info: dict) -> str:
        return "|".join(
            (
                filename,
                "".join(info["texts"]),
                " ".join(info["phones"]),
                " ".join(info["pitches"]),
                " ".join(map(str, info["note_durs"])),
                " ".join(map(str, info["phone_durs"])),
                " ".join(map(str, info["slurs"])),
            )
        )


if __name__ == "__main__":
    t = Trainer("test")
    # base_path = r"E:/projects/Python/deep-learning/visinger2/backend/temp/train_datas"
    # with open(os.path.join(base_path, "transcriptions.txt"), encoding="utf-8") as fp:
    #     data_list = list(filter(lambda x: x != "", fp.read().splitlines()))
    # for idx, data in enumerate(data_list):
    #     data_list[idx] = data.split("|")

    # for info in data_list:
    #     filename = info[0]
    #     with open(base_path + rf"/wavs/{filename}.wav", "rb") as fp:
    #         audio = fp.read()
    #     t.data_manager.save(
    #         audio,
    #         "wav",
    #         filename,
    #         info[1],
    #         info[2].split(),
    #         info[3].split(),
    #         list(map(float, info[4].split())),
    #         list(map(float, info[5].split())),
    #     )
    # t.data_manager.flush()
    # t.gen_train()
    # t.preprocess()

    for item in t.preprocess():
        print(item)
