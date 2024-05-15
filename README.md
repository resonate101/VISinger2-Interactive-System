# VISinger2-Interactive-System
The Implementation of a Interactive Singing Voice Synthesis System Based on [VISinger2](https://github.com/zhangyongmao/VISinger2).

Unfortunately, there's no plan for multiple languages support. So only chinese available.

## How to use

Just run the command on your shell.

```shell
pip3 install -r requirements.txt
pip3 install flask
```

Then run the `main.py` and turn to http://127.0.0.1:9980 on your browser.

Prefering another port? It's ok to change.

```python
# app.py lineno 218
app.run("127.0.0.1", <your custom port>, debug=True)
```

## License

The code from [VISinger2](https://github.com/zhangyongmao/VISinger2) keeps original copyright.

Remaining part of repository published under AGPL3.
