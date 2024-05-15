function on_infer_opened() {
  axios.get('/groups').then(resp => {
    groups_info = resp.data;
    let html_str = '';
    let infer_group_box = $(".infer-group-box");

    for (let k in groups_info) {
      html_str += `<button type="button" class="list-group-item list-group-item-action">${k}</button>`;
    }
    infer_group_box.html(html_str);
    let temp = $(infer_group_box.children()[0]);
    temp.addClass('active');
    group_change();
    temp.trigger('click');
    $("#infer-audio-box").hide();
  })
}


function group_change() {
  $(".infer-group-box button").on('click', (e) => {
    let infer_group_box = $(".infer-group-box");
    infer_group_box.children().removeClass("active");
    $(e.target).addClass("active");

    let group = e.target.innerHTML;
    let html_str = '';
    groups_info[group].infer_datas.forEach(v => {
      html_str += `<button type="button" group="${group}" class="list-group-item list-group-item-action">${v}</button>`;
    })
    $('.infer-files-box').html(html_str);
    $('#infer-file-output').html("从左侧选择一个推理文件，以预览推理参数。");
    file_chagne();
  })
}


function file_chagne() {
  $(".infer-files-box button").on('click', (e) => {
    let infer_files_box = $(".infer-files-box");
    infer_files_box.children().removeClass("active");
    $(e.target).addClass("active");

    let group = $(e.target).attr("group");
    let filename = e.target.innerHTML;
    axios.post("/infer_get", {
      group: group,
      filename: filename
    })
      .then(resp => {
        let data = resp.data;
        let output = '';
        output += `节拍：${data.bpm}\n`;
        data.notes.forEach((v, idx) => {
          output += `\n音高：${v.pitch === undefined ? "<无音高>" : v.pitch}\n`;
          output += `文本：${v.text !== 'SP' && v.text !== "AP" ? v.text : "<停顿>"}\n`;
          output += `音符单位：${v.unit}分音符\n`;
          output += `持续时长：${v.unit}分音符 * ${v.length}\n`;
        })
        $("#infer-file-output").html(output);
      })
  })
}


$(function () {
  $("#infer-run").on('click', (e) => {
    let chosed_file = $(".infer-files-box .active");
    if (chosed_file.length == 0) {
      float_alert("未选中任何推理文件，无法进行推理", false);
      return;
    }

    let group = chosed_file.attr('group');
    let filename = chosed_file.html();
    float_alert("正在运行推理，请稍后...", true);
    axios.get(`/infer_run/${group}/${filename}`)
      .then(resp => {
        float_alert("推理完成，已返回结果");
        $("#infer-audio-box").show();
        $("#infer-audio-box").html(`<audio controls src="${resp.data}"></audio>`);
      })
      .catch(err => {
        console.log(err);
        float_alert(`推理失败，错误：${err.response.data}`, false)
      })
  })
})