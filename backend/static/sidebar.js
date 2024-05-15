$(function () {
  let menu_options = [...$('#menu-box').children()];
  let contents = [...$('#content').children()];
  let menu_chosed = 0;
  $(menu_options[menu_chosed]).addClass("sidebar-chosed");
  $(contents[menu_chosed]).removeClass("d-none");

  menu_options.forEach((elem, idx) => {
    $(elem).attr('menu-order', idx);
  })

  $('#menu-box').children().on("click", (e) => {
    $(menu_options[menu_chosed]).removeClass("sidebar-chosed");
    $(e.target).addClass("sidebar-chosed");
    menu_chosed = $(e.target).attr('menu-order');

    let menu_idx = $(e.target).attr('menu-order');
    contents.forEach((elem, idx) => {
      if (idx != menu_idx) {
        $(elem).addClass('d-none');
      }
      else {
        $(elem).removeClass('d-none');
        call_menu_open(idx);
      }
    })
  })

  call_menu_open(menu_chosed);
})


function call_menu_open(idx) {
  switch (idx) {
    case 0:
      on_train_opened();
      break;
    case 1:
      on_piano_opened();
      break;
    case 2:
      on_infer_opened();
      break;
    case 3:
      on_config_opened();
      break;
    default:
      break;
  }
}