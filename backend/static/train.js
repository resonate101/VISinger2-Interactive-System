function on_train_opened() {
  axios.get('/groups').then(resp => {
    groups_info = resp.data;
    let html_str = '';
    for (let k in groups_info) {
      html_str += `<option value="${k}">${k}</option>`;
    }
    $('#train-group-chose').html(html_str);
    $('#train-data-add-group').html(html_str);
    $('#train-group-chose').trigger('change');

    html_str = '';
    for (let k in groups_info) {
      if (groups_info[k].train_running)
        html_str += `<option value="${k}">${k}</option>`
    }
    $("#current-group").html(html_str);
  })
}


function round(number, precision) {
  return Math.round(+number + "e" + precision) / Math.pow(10, precision);
}


$(function () {
  $('#current-max-line')[0].value = 15;

  $('#train-group-chose').on('change', (e) => {
    let group = e.target.value;
    let preprocessNum = groups_info[group].train_info.preprocess;
    let filesNum = groups_info[group].train_info.files;
    let runFlag = groups_info[group].train_running;
    let matched = groups_info[group].train_info.matched;
    $('#preprocess-progress-box').hide();
    $("#preprocess-progress").parent().parent().hide();
    $('#preprocess-progress').html("0%").css("width", "0%");
    $('#train-run-preprocess')[0].disabled = false;

    let html_str = `
      <p>是否正在训练：${runFlag}</p>
      <p>已预处理的训练数据：${preprocessNum}</p>
      <p>已保存的训练数据：${filesNum}</p>
    `;

    if (filesNum === 0) {
      html_str += '<p style="color:red;">提示：需要先添加训练数据，再执行预训练</p>'
    }
    else if (preprocessNum === 0) {
      html_str += '<p style="color:red;">提示：需要执行预训练</p>'
    }
    else if (!matched) {
      html_str += '<p style="color:red;">提示：数量不匹配，需要执行预训练</p>'
    }
    else {
      html_str += '<p style="color:green;">提示：无需再次执行预训练</p>'
    }
    $('#train-group-info').html(html_str);
  })

  let preprocessing = false;
  $('#train-run-preprocess').on('click', (e) => {
    if (!preprocessing) {
      preprocessing = true;
      e.target.disabled = true;
    }
    else return;

    let group = $('#train-group-chose')[0].value;
    let sse = new EventSource(`/train_preprocess/${group}`);
    $('#preprocess-progress-box').show();
    $("#preprocess-progress").parent().parent().show();
    let pro = null;

    sse.addEventListener('message', (e) => {
      if (e.data === 'end') {
        sse.close();
        pro = '100%';
        float_alert("预处理完成", true);
        setTimeout(() => {
          on_train_opened();
        }, 1000);
        preprocessing = false;
      }
      else {
        pro = `${round(parseFloat(e.data), 3) * 100}%`;
      }
      $('#preprocess-progress').html(pro).css("width", pro);
    })
  })

  $("#train-run-process").on('click', (e) => {
    let group = $('#train-group-chose')[0].value;
    axios.get(`/train_run/${group}?status=on`).then(resp => {
      console.log(resp);
      float_alert("已启动训练", true);
      on_train_opened();
    })
  })

  $("#train-stop-process").on("click", (e) => {
    let group = $('#train-group-chose')[0].value;
    axios.get(`/train_run/${group}?status=off`).then(resp => {
      console.log(resp);
      float_alert("已停止训练", true);
      on_train_opened();
    })
  })

  $("#current-open").on('click', (e) => {
    let group = $('#current-group')[0].value;
    let curOut = $("#current-output");
    let sse = new EventSource(`/train_forward/${group}?status=on`);
    curOut.html("");
    let contents = [];
    let maxlen = parseInt($("#current-max-line")[0].value);

    sse.addEventListener('message', (e) => {
      if (e.data == 'end') {
        sse.close();
        curOut.html("未选中正在训练的组。选择一个正在训练的组，从而输出训练信息。");
        return;
      }

      if (contents.length >= maxlen) {
        contents = contents.slice(1);
        contents.push(e.data);
      }
      else {
        contents.push(e.data);
      }
      curOut.html(contents.join('\n'));
    })
  })

  $("#current-close").on('click', (e) => {
    let group = $('#current-group')[0].value;
    axios.get(`/train_forward/${group}?status=off`).then(resp => {
      console.log(resp);
      float_alert("已关闭转发", true);
    })
  })

  $('#train-data-add').on('click', (e) => {
    let file_elem = $("#train-data-file")[0];
    let file_path = file_elem.value;
    let file_ext = file_path.substr(file_path.lastIndexOf('.') + 1, file_path.length);
    let file = file_elem.files[0];
    let file_name;

    if (file !== undefined)
      file_name = file.name.split('.')[0];
    else
      file_name = '';

    let fdata = new FormData(document.forms.TrainDataForm);
    fdata.append("ext", file_ext);
    fdata.append("file_name", file_name);

    for (let [k, v] of fdata) {
      if (v == '') {
        float_alert("表单存在空字段，请补充完整再添加", false);
      }
    }

    axios.post('/train_add', fdata).then(resp => {
      float_alert("添加成功");
      on_train_opened();
    })
      .catch(err => {
        console.log(err);
        float_alert(`添加训练数据失败，错误：${err.response.data}`, false)
      })
  })
})
