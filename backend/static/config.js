function on_config_opened() {
  axios.get('/groups').then(resp => {
    groups_info = resp.data;
    let html_str = '';
    for (let k in groups_info) {
      html_str += `<option value="${k}">${k}</option>`;
    }
    $('#config-group-list').html(html_str);
    $('#config-group-list').trigger('change');
  })
}

$(function () {
  $('#config-group-list').on('change', (e) => {
    let group = e.target.value;
    let config = groups_info[group].config;

    let log_int_config = config.train.log_interval;
    let rand_seed_config = config.train.seed;
    let train_epoch_config = config.train.epochs;
    let train_lr_config = config.train.learning_rate;
    let train_batch_config = config.train.batch_size;
    let train_fp16_config = config.train.fp16_run;

    $("#log-interval").val(log_int_config);
    $("#rand-seed").val(rand_seed_config);
    $("#train-epoch").val(train_epoch_config);
    $("#train-lr").val(train_lr_config);
    $("#train-batch-size").val(train_batch_config);
    $("#enable-fp16").val(`${train_fp16_config}`);
  })

  $("#config-save").on("click", (e) => {
    let group = $('#config-group-list').val();
    let config = groups_info[group].config;

    config.train.log_interval = parseInt($("#log-interval").val());
    config.train.seed = parseInt($("#rand-seed").val());
    config.train.epochs = parseInt($("#train-epoch").val());
    config.train.learning_rate = parseFloat($("#train-lr").val());
    config.train.batch_size = parseInt($("#train-batch-size").val());
    config.train.fp16_run = JSON.parse($("#enable-fp16").val());

    axios.post("/group_modify", { ...config, group: group })
      .then(resp => {
        float_alert("配置修改成功", true);
      })
      .catch(err => {
        console.log(err);
        float_alert(`配置修改失败，错误：${err.response.data}`, false)
      })
  })

  $("#config-new-add").on('click', (e) => {
    let group = $("#config-new-group").val();
    if (group === '') {
      float_alert("新建组时，组名不能为空", false);
      return;
    }

    axios.get(`/group_add/${group}`)
      .then(resp => {
        float_alert(`配置组 ${group} 新建成功`);
      })
      .catch(err => {
        console.log(err);
        float_alert(`配置组添加失败，错误：${err.response.data}`, false);
      })
  })

  $("#config-del").on("click", (e) => {
    let group = $("#config-group-list").val();
    if (confirm(`是否确认删除配置组 ${group}？`)) {
      axios.get(`/group_del/${group}`)
        .then(resp => {
          float_alert(`配置组 ${group} 数据已经清空`, true);
        })
        .catch(err => {
          console.log(err);
          float_alert(`配置组清除失败，错误：${err.response.data}`, false);
        })
    }
  })
})