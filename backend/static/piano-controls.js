piano_paint(20, 96, originXUnit, originYUnit, 4, 4);

function on_piano_opened() {
  axios.get('/groups').then(resp => {
    $('#piano-save-space').html();

    let html_str = '';
    groups_info = resp.data;

    for (let k in groups_info) {
      html_str += `<option value="${k}">${k}</option>`
    }
    $('#piano-save-space').html(html_str);

    let _ = $('#piano-open-space');
    _.html(html_str);
    html_str = '';

    groups_info[_[0].value]['infer_datas'].forEach((v, idx) => {
      html_str += `<option value="${v}">${v}</option>`;
    });
    $('#piano-open-name').html(html_str);
  })
    .catch(err => {
      console.log(err);
      float_alert(`获取组名信息失败，错误：${err.response.status}`, false)
    })
}


$('#piano-open-space').on('change', (e) => {
  let group_name = e.target.value;
  let html_str = '';

  groups_info[group_name]['infer_datas'].forEach((v, idx) => {
    html_str += `<option value="${v}">${v}</option>`
  })
  $('#piano-open-name').html(html_str);
})


$('#piano-open-btn').on('click', () => {
  let groupName = $('#piano-open-space')[0].value;
  let fileName = $('#piano-open-name')[0].value;

  axios.post('/infer_get', {
    group: groupName,
    filename: fileName
  })
    .then(resp => {
      let bars = piano_import(resp.data);
      $("#beat-unit")[0].value = beat_unit;
      $("#bpm")[0].value = Bpm;
      $("#piano-bars")[0].value = bars;
    })
    .catch(err => {
      float_alert(`保存失败，错误：${err.response.status}，${err.response.data}`, false)
    })
})


$('#piano-save-btn').on('click', () => {
  let res = piano_export();

  if (res.status === 0) {
    float_alert(res.msg, false);
    return
  }

  let saveName = $('#piano-save-name')[0].value;
  if (saveName === '') {
    float_alert("保存名称不能为空", false);
    return
  }

  function save(force = false) {
    axios.post('/infer_upload', {
      ...res,
      group: $('#piano-save-space')[0].value,
      name: saveName,
      force: force
    })
      .then(resp => {
        groups_info[$('#piano-save-space')[0].value]['infer_datas'].push(saveName);
        if (!force) {
          $('#piano-open-space').trigger("change");
        }
        float_alert("保存成功");
        $('#piano-save-name')[0].value = '';
      })
      .catch(err => {
        if (err.response.data !== '文件已存在') {
          float_alert(`保存失败，错误：${err.response.status}，${err.response.data}`, false);
        }

        if (confirm("文件已存在，是否覆盖？")) {
          save(force = true)
        }
        else {
          float_alert("保存操作已取消", true);
        }
      })
  }
  save(false);
})


$('#piano-clear').on("click", () => {
  piano_clear();
})

$('#piano-zoom-in').on("click", () => {
  switch ($('#zoom-direction')[0].value) {
    case 'x':
      piano_zoom_in(true, false);
      break;

    case 'y':
      piano_zoom_in(false, true);
      break;

    default:
      piano_zoom_in();
  }
})

$('#piano-zoom-out').on("click", () => {
  switch ($('#zoom-direction')[0].value) {
    case 'x':
      piano_zoom_out(true, false);
      break;

    case 'y':
      piano_zoom_out(false, true);
      break;

    default:
      piano_zoom_out();
  }
})


$('#piano-zoom-default').on("click", () => {
  piano_zoom_default();
})


$("#piano-bars")[0].value = 4;
$("#piano-bars").on("change", (e) => {
  if (e.target.value <= 0) e.target.value = '1';
  if (e.target.value > 10) e.target.value = '10';
  piano_paint(bar_beats * parseInt(e.target.value), YRange, XUnit, YUnit, beat_unit, bar_beats);
})

$("#beat-unit")[0].value = 4;
$("#beat-unit").on("change", (e) => {
  if (e.target.value <= 0) e.target.value = '1';
  beat_unit = parseInt(e.target.value);
})

$("#bar-beats")[0].value = 4;
$("#bar-beats").on("change", (e) => {
  if (e.target.value <= 0) e.target.value = '1';
  piano_paint(XRange, YRange, XUnit, YUnit, beat_unit, parseInt(e.target.value));
})

$("#bpm")[0].value = Bpm;
$("#bpm").on("change", (e) => {
  if (e.target.value < 60) e.target.value = 60;
  if (e.target.value > 300) e.target.value = 300;
  Bpm = parseInt(e.target.value);
})
