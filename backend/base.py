import os
import pathlib
import shutil
from typing import Any, Callable, Union


class BetterPath(pathlib.Path):
    _flavour = type(pathlib.Path())._flavour

    def init(self, force: bool = False) -> "BetterPath":
        if force:
            if self.exists():
                shutil.rmtree(self)
            os.mkdir(self)
        elif not self.exists():
            os.mkdir(self)
        return self

    def rinit(self) -> "BetterPath":
        try:
            return self.init()
        except FileNotFoundError:
            self.parent.init()
            return self.init()

    def rmrf(self) -> "BetterPath":
        if self.exists():
            shutil.rmtree(self)
        return self

    def init_with(
        self,
        val: Any = "",
        func: Union[Callable[[], Any], None] = None,
        open_mode: str = "w",
        encoding: str = "utf-8",
        force: bool = False,
    ) -> "BetterPath":
        def _write_in() -> "BetterPath":
            if func is not None:
                res = func()
            else:
                res = val
            with open(self, mode=open_mode, encoding=encoding) as fp:
                fp.write(res)
            return self

        if force:
            return _write_in()
        if self.exists():
            return self
        else:
            return _write_in()


class ProjPath:
    root = BetterPath(__file__).parent
    storage = (root / "storage").init()
    core_datas = (root / "core_datas").init()
    temp = (root / "temp").init()

    @classmethod
    def get_space(cls, namespace: str):
        return (cls.storage / namespace).init()

    @classmethod
    def get_train_datas(cls, namespace: str):
        return (cls.get_space(namespace) / "train_datas").rinit()

    @classmethod
    def get_infer_datas(cls, namespace: str):
        return (cls.get_space(namespace) / "infer_datas").rinit()

    @classmethod
    def get_models(cls, namespace: str):
        return (cls.get_space(namespace) / "models").rinit()

    @classmethod
    def get_namespaces(cls) -> list[str]:
        return os.listdir(cls.storage)
