import json
import shutil
from typing import Any

import toml
from base import ProjPath

with open(ProjPath.core_datas / "config.toml", encoding="utf-8") as fp:
    CONFIG_TEMPLATE: dict = toml.load(fp)


class ConfigManager:
    def __init__(self, namespace: str) -> None:
        self.namespace = namespace
        self.config_path = (ProjPath.get_space(namespace) / "config.json").init_with(
            func=self._gen_config
        )
        self._config_keys = self._get_config_keys()
        self._config_buf: list[tuple[str, str, Any]] = []

    def _get_config_keys(self):
        res: dict[str, list[str]] = {}
        for k in CONFIG_TEMPLATE.keys():
            res[k] = []
            for v in CONFIG_TEMPLATE[k].keys():
                res[k].append(v)
        return res

    def _gen_config(self) -> str:
        template = CONFIG_TEMPLATE.copy()
        template["train"]["save_dir"] = str(ProjPath.get_models(self.namespace))
        template["data"]["data_dir"] = str(ProjPath.get_train_datas(self.namespace))
        return json.dumps(template, ensure_ascii=False, indent=2)

    def config_get(self) -> dict:
        with open(self.config_path, encoding="utf-8") as fp:
            return json.load(fp)

    def config_modify(self, key: tuple[str, str], val: Any) -> None:
        k1, k2 = key
        if k1 not in self._config_keys.keys():
            raise RuntimeError(f"尝试修改的配置键 {k1} 不存在")
        if k2 not in self._config_keys[k1]:
            raise RuntimeError(f"尝试修改的配置键 {k1} {k2} 不存在")
        self._config_buf.append((k1, k2, val))

    def config_flush(self) -> None:
        with open(self.config_path, encoding="utf-8") as fp:
            config: dict = json.load(fp)
        new = {}
        for k in self._config_keys.keys():
            new[k] = {}
        for k1, k2, v in self._config_buf:
            new[k1][k2] = v
        for k in config.keys():
            config[k].update(new[k])
        with open(self.config_path, "w", encoding="utf-8") as fp:
            json.dump(config, fp, ensure_ascii=False, indent=2)

    def space_clear(self) -> None:
        space_folder = ProjPath.get_space(self.namespace)
        if space_folder.exists():
            shutil.rmtree(space_folder)


if __name__ == "__main__":
    manager = ConfigManager("test")
    print(manager.config_get())
    # print()
    # manager.modify(("train", "log_interval"), 3000)
    # manager.modify(("data", "n_fft"), 1024)
    # manager.flush()
