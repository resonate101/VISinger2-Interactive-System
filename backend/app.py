import os
import time
import traceback
from http import HTTPStatus
from functools import wraps

from base import ProjPath
from config import ConfigManager
from flask import Flask, Response, jsonify, render_template, request, send_from_directory
from lyric import Lyric, Note
from infer import Inferencer
from train import Trainer


app = Flask(
    __name__,
    template_folder="./templates",
    static_folder="./static",
    static_url_path="/static",
)


class Model:
    def __init__(self, namespace: str) -> None:
        self.namespace = namespace
        self.configer = ConfigManager(namespace)
        self.trainer = Trainer(namespace)
        self.inferencer = Inferencer(namespace)
        self.inferencer.works_dir.init(force=True)

        self.trainer.gen_train()
        self.inferencer.works_dir.init(force=True)

    def dispose(self) -> None:
        ProjPath.get_space(self.namespace).rmrf()


MODELS: dict[str, Model] = {g: Model(g) for g in os.listdir(ProjPath.storage)}


def route_err_handle(func):
    @wraps(func)
    def wrapped_router(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            print("=" * 20)
            print(e)
            traceback.print_exc()
            print("=" * 20)
            return Response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)

    return wrapped_router


@app.route("/")
@route_err_handle
def index():
    return render_template("index.html")


@app.route("/groups", methods=["GET"])
@route_err_handle
def groups():
    return jsonify(
        {
            model_name: {
                "infer_datas": model.inferencer.data_names,
                "train_info": model.trainer.get_info(),
                "train_running": model.trainer.process is not None,
                "config": model.configer.config_get(),
            }
            for model_name, model in MODELS.items()
        }
    )


@app.route("/group_modify", methods=["POST"])
@route_err_handle
def group_modify():
    data = request.get_json()
    group = data.pop("group")
    new_config = data

    for k1 in new_config.keys():
        for k2, v2 in new_config[k1].items():
            MODELS[group].configer.config_modify((k1, k2), v2)
    MODELS[group].configer.config_flush()
    return Response("ok", status=HTTPStatus.OK)


@app.route("/group_add/<group>")
@route_err_handle
def group_add(group):
    if group in MODELS.keys():
        return Response("指定的配置组已存在", status=HTTPStatus.FORBIDDEN)

    MODELS[group] = Model(group)
    return Response("ok", status=HTTPStatus.OK)


@app.route("/group_del/<group>")
@route_err_handle
def group_del(group):
    if group not in MODELS.keys():
        return Response("指定的配置组不存在，无法删除", status=HTTPStatus.FORBIDDEN)

    MODELS[group].dispose()
    MODELS.pop(group)
    return Response("ok", status=HTTPStatus.OK)


@app.route("/infer_upload", methods=["POST"])
@route_err_handle
def infer_upload():
    data = request.get_json()
    if MODELS[data["group"]].inferencer.save(data):
        return Response(status=HTTPStatus.OK)
    else:
        return Response("文件已存在", status=HTTPStatus.FORBIDDEN)


@app.route("/infer_get", methods=["POST"])
@route_err_handle
def infer_get():
    data = request.get_json()
    group = data["group"]
    filename = data["filename"]
    data, status = MODELS[group].inferencer.get(filename)
    if status:
        return jsonify(data)
    else:
        return Response("文件不存在，无法打开", status=HTTPStatus.NOT_FOUND)


@app.route("/infer_run/<group>/<filename>")
@route_err_handle
def infer_run(group, filename):
    ifer = MODELS[group].inferencer
    data, status = ifer.get(filename)
    if not status:
        return Response("文件不存在，无法打开", status=HTTPStatus.NOT_FOUND)

    notes = []
    texts = []
    for note in data["notes"]:
        notes.append(
            Note(
                pitch=note.get("pitch", "rest"),
                length=note["length"],
                len_unit=note["unit"],
            )
        )
        texts.append(note["text"])
    lyric = Lyric(texts, notes, data["bpm"])

    ifer.infer(str(time.time_ns()), filename, lyric)
    return f"/files/{group}/{filename}.wav?t={time.time_ns()}"


@app.route("/files/<group>/<file>")
@route_err_handle
def file_get(group, file):
    return send_from_directory(MODELS[group].inferencer.output_dir, file)


@app.route("/train_preprocess/<group>")
@route_err_handle
def train_preprocess(group):
    return Response(MODELS[group].trainer.preprocess(), mimetype="text/event-stream")


@app.route("/train_forward/<group>")
@route_err_handle
def train_forward(group):
    status = request.args["status"]
    if status == "on":
        return Response(MODELS[group].trainer.forward(), mimetype="text/event-stream")
    else:
        MODELS[group].trainer.forward_stop()
        return Response("ok", status=HTTPStatus.OK)


@app.route("/train_run/<group>")
@route_err_handle
def train_run(group):
    status = request.args["status"]
    if status == "on":
        MODELS[group].trainer.train()
    else:
        MODELS[group].trainer.train_stop()
    return Response("ok", status=HTTPStatus.OK)


@app.route("/train_add", methods=["POST"])
@route_err_handle
def train_add():
    str_to_floats = lambda x: list(map(float, x.split(" ")))

    try:
        data = dict(request.form.items())
        data["audio"] = request.files.get("audio").stream.read()
        data["texts"] = list(data["texts"])
        data["phones"] = data["phones"].split()
        data["pitches"] = data["pitches"].split()
        data["note_durs"] = str_to_floats(data["note_durs"])
        data["phone_durs"] = str_to_floats(data["phone_durs"])

        group = data.pop("group")
        MODELS[group].trainer.data_manager.save(**data)
        MODELS[group].trainer.data_manager.flush()
        return Response("ok", HTTPStatus.OK)
    except Exception as e:
        return Response(str(e), HTTPStatus.INTERNAL_SERVER_ERROR)


if __name__ == "__main__":
    app.run("127.0.0.1", 9980, debug=True)
