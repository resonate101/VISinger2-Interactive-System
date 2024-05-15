import glob
import os
import toml
import subprocess

from base import ProjPath
from lyric import Lyric, Note


class Inferencer:
    def __init__(self, namespace: str) -> None:
        self.space_dir = ProjPath.get_space(namespace)
        self.models_dir = ProjPath.get_models(namespace)
        self.infer_datas_dir = ProjPath.get_infer_datas(namespace)
        self.output_dir = (self.space_dir / "outputs").init()
        self.works_dir = (self.space_dir / "temp").init()
        self.process: subprocess.CompletedProcess[bytes] | None = None

    @property
    def data_names(self) -> list[str]:
        return [name[:-5] for name in os.listdir(self.infer_datas_dir)]

    def get(self, name: str) -> tuple[dict, bool]:
        if f"{name}.toml" not in os.listdir(self.infer_datas_dir):
            return {}, False

        with open(self.infer_datas_dir / f"{name}.toml", encoding="utf-8") as fp:
            data = toml.load(fp)
        return data, True

    def save(self, data: dict) -> bool:
        data.pop("status")
        data.pop("group")
        filename = data["name"]
        if f"{filename}.toml" in os.listdir(self.infer_datas_dir) and not data["force"]:
            return False

        with open(self.infer_datas_dir / f"{filename}.toml", "w", encoding="utf-8") as fp:
            toml.dump(data, fp)
        return True

    def infer(
        self, work_id: str, output_name: str, lyric: Lyric, rand_range: float = 0.1
    ) -> None:
        if self.process is not None:
            raise RuntimeError("推理正在运行中")

        models_path = glob.glob(str(self.models_dir / "G_*.pth"))
        if len(models_path) == 0:
            raise RuntimeError("可用的生成模型不存在，无法进行推理")
        infer_str = f"{output_name}|{lyric.get_infer_str(rand_range)}"
        work_file_path = (self.works_dir / f"{work_id}.txt").init_with(
            infer_str + "\n", force=True
        )

        env = os.environ.copy()
        env["PYTHONPATH"] = "E:/projects/Python/deep-learning/visinger2"
        env["PYTHONIOENCODING"] = "UTF-8"
        self.process = subprocess.run(
            [
                "python",
                "-X",
                "utf8",
                "E:/projects/Python/deep-learning/visinger2/egs/visinger2/inference.py",
                "--model_dir",
                self.models_dir,
                "--input_dir",
                work_file_path,
                "--output_dir",
                self.output_dir,
            ],
            env=env,
            cwd="E:/projects/Python/deep-learning/visinger2",
        )
        self.process = None


if __name__ == "__main__":
    i = Inferencer("test")
    notes = [
        Note("C4", length=1),
        Note("C4", length=1),
        Note("rest", length=1, len_unit=32),
        Note("D#4", length=1),
        Note("G#4", length=2),
        Note("G#4", length=2),
        Note("rest", length=1, len_unit=16),
        Note("rest", length=3, len_unit=16),
    ]
    texts = ["天", "气", "SP", "真", "好", "啊", "SP", "AP"]
    l = Lyric(texts, notes, 135)
    i.infer("00001", "final_output", l)
