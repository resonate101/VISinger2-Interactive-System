var canvas = new fabric.Canvas('pianoroll', {
  selection: false,
  fireRightClick: true,
  stopContextMenu: true,
  preserveObjectStacking: true,
});


var firstLoaded = true;
canvas.on('after:render', () => {
  if (firstLoaded) {
    setTimeout(() => {
      $('.canvas-container')[0].scrollTop = canvas.height * 0.36;
    }, 100);
    firstLoaded = false;
  }
})


canvas.on('object:moving', function (options) {
  if (options.target === null) {
    return;
  }

  if (options.target._otype === 'note_char') {
    let textbox = options.target;
    textbox.set({
      left: textbox._note.left + 0.1 * XUnit,
      top: textbox._note.top + 0.25 * YUnit
    })
    return;
  }

  if (options.target._otype !== 'note') {
    return;
  }

  let note = options.target;
  let cur_left = note.left;
  let cur_top = note.top;
  let cur_right = cur_left + note.width * note.scaleX;
  let cur_btm = cur_top + note.height * note.scaleY;

  let next_l = note.left, next_t = note.top;
  if (cur_left < XUnit) next_l = XUnit;
  if (cur_top < 0) next_t = 0;
  if (cur_right > canvasWidth) next_l = canvasWidth - note.width * note.scaleX;
  if (cur_btm > canvasHeight) next_t = canvasHeight - note.height * note.scaleY;

  note.set({
    left: Math.round(next_l / XUnit) * XUnit,
    top: Math.round(next_t / YUnit) * YUnit
  });
  note._textbox.set({
    left: (Math.round(next_l / XUnit) * XUnit) + 0.1 * XUnit,
    top: (Math.round(next_t / YUnit) * YUnit) + 0.25 * YUnit
  })
  let textbox = note._textbox;
  canvas.remove(textbox).add(textbox);
});


canvas.on('object:modified', function (options) {
  if (options.target === null || options.target._otype !== 'note') {
    return;
  }

  let note = options.target;
  let newWidth = (Math.round(note.width * note.scaleX / XUnit)) * XUnit;
  let newHeight = (Math.round(note.height * note.scaleY / YUnit)) * YUnit;
  newWidth = newWidth == 0 ? XUnit : newWidth;
  newHeight = newHeight == 0 ? YUnit : newHeight;
  lastNoteWidth = newWidth;

  note.set({
    width: newWidth,
    height: newHeight,
    scaleX: 1,
    scaleY: 1
  });

  note._textbox.set({
    width: newWidth * 0.3 >= XUnit ? XUnit : newWidth * 0.3,
    height: 0.5 * YUnit,
    scaleX: 1,
    scaleY: 1
  })
});


var lastScrollLeft = 0;
$('.canvas-container').scroll(() => {
  let canvasScrollLeft = $('.canvas-container').scrollLeft();
  if (lastScrollLeft != canvasScrollLeft) {

    labelList.forEach((label, idx) => {
      label.set({
        left: canvasScrollLeft,
        top: label.top
      });
      canvas.bringToFront(label);
      let labelText = label._text;
      labelText.set({
        left: canvasScrollLeft,
        top: label.top + 0.25 * YUnit
      })
      canvas.bringToFront(labelText);
    })
    canvas.renderAll();

    lastScrollLeft = canvasScrollLeft;
  }
});


canvas.on("mouse:down", function (options) {
  if (options.e.button == 2) {
    clearingMode = true;
    canvas.discardActiveObject().renderAll();
  }
  else if (options.target === null || (options.target._otype !== 'note' && options.target._otype !== 'note_char' && options.target._otype !== 'label')) {
    piano_add_note(options.e.offsetX, options.e.offsetY, undefined, undefined, true);
  }
})


canvas.on("mouse:move", function (options) {
  if (options.target === null || options.target._otype !== 'note') {
    return;
  }
  if (clearingMode && options.target._otype == 'note') {
    piano_remove_note(options.target);
  }
})


canvas.on("mouse:up", function (options) {
  if (options.e.button == 2) {
    clearingMode = false;
  }
})


var noteList = [];
var clearingMode = false;
var XRange = -1;
var YRange = -1;
var XUnit = -1;
var YUnit = -1;
var canvasWidth = -1;
var canvasHeight = -1;
var lastNoteWidth = -1;

var labelList = [];
var labelTexts = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
var beat_unit = -1;
var bar_beats = -1;

function piano_paint(xr, yr, xu, yu, bu, bbs) {
  clearingMode = false;
  let exported_notes = undefined;
  if (noteList.length !== 0) {
    exported_notes = piano_export_notes();
    noteList = [];
  }
  labelList = [];
  canvas.clear();

  XRange = xr;
  YRange = yr;
  XUnit = xu;
  YUnit = yu;
  lastNoteWidth = xu;
  beat_unit = bu;
  bar_beats = bbs;

  canvasWidth = XUnit * (XRange + 1);
  canvasHeight = YUnit * YRange;
  canvas.setWidth(canvasWidth);
  canvas.setHeight(canvasHeight);

  for (let i = 1; i <= YRange; i++) {
    let text = labelTexts[(i - 1) % 12] + Math.ceil(i / 12);
    let label = new fabric.Rect({
      left: 0,
      top: YUnit * (YRange - i),
      width: XUnit,
      height: YUnit,
      type: 'rectangle',
      fill: text[1] == '#' ? "#222" : "#fff",
      originX: 'left',
      originY: 'top',
      stroke: '#ccc',
      strokeWidth: 1,
      lockRotation: true,
      centeredRotation: false,
      controls: false,
      selectable: false,
      hoverCursor: "default"
    })
    let labelText = new fabric.Textbox(text, {
      width: XUnit,
      height: YUnit,
      top: YUnit * (YRange - i) + 0.25 * YUnit,
      left: 0,
      originX: 'left',
      originY: 'top',
      fontSize: 0.5 * YUnit,
      textAlign: 'center',
      fill: text[1] == '#' ? "#fff" : "#222",
      controls: false,
      selectable: false,
      hoverCursor: "default"
    });
    labelText._pitch = text;
    label._text = labelText;

    if (text[1] == '#') {
      let _ = new fabric.Rect({
        left: XUnit,
        top: YUnit * (YRange - i),
        width: XUnit * XRange,
        height: YUnit,
        type: 'rectangle',
        fill: '#ddd',
        originX: 'left',
        originY: 'top',
        lockRotation: true,
        centeredRotation: false,
        controls: false,
        selectable: false,
        hoverCursor: "default"
      })
      canvas.add(_);
    }
    label._otype = 'label';
    labelText._otype = 'label';

    canvas.add(label);
    canvas.add(labelText);
    labelList.push(label);
  }

  for (let i = 0; i < XRange + 1; i++) {
    canvas.add(new fabric.Line(
      [i * XUnit, 0, i * XUnit, canvasHeight],
      {
        type: 'line',
        stroke: '#ccc',
        strokeWidth: ((i - 1) % bar_beats == 0 && i != 1) ? 3 : 1,
        selectable: false,
        hoverCursor: "default"
      }
    ));
  }

  for (let i = 0; i < YRange; i++) {
    canvas.add(new fabric.Line(
      [0, i * YUnit, canvasWidth, i * YUnit],
      {
        type: 'line',
        stroke: '#ccc',
        strokeWidth: 1,
        selectable: false,
        hoverCursor: "default"
      }
    ))
  }

  if (exported_notes !== undefined) {
    piano_restore_notes(exported_notes);
  }

  canvas.renderAll();
}


function piano_add_note(x, y, w, text = "_", align = false) {
  let positionX = align ? Math.floor(x / XUnit) * XUnit : x;
  let positionY = align ? Math.floor(y / YUnit) * YUnit : y;
  let noteLength = w === undefined ? lastNoteWidth : w;

  let note = new fabric.Rect({
    left: positionX,
    top: positionY,
    width: noteLength,
    height: YUnit,
    rx: YUnit * 0.25,
    ry: YUnit * 0.25,
    type: 'rectangle',
    fill: '#39c5aa',
    stroke: '#888',
    strokeWidth: 2,
    originX: 'left',
    originY: 'top',
    lockRotation: true,
    centeredRotation: false
  })
  note._otype = 'note';
  note.setControlsVisibility({
    mt: false,
    mb: false,
    bl: false,
    br: false,
    tl: false,
    tr: false,
    ml: false,
    mtr: false,
  });
  let textbox = new fabric.Textbox(text, {
    width: noteLength * 0.3 >= XUnit ? XUnit : noteLength * 0.3,
    height: 0.5 * YUnit,
    top: positionY + 0.25 * YUnit,
    left: positionX + 0.1 * XUnit,
    originX: 'left',
    originY: 'top',
    fontSize: 0.5 * YUnit,
    textAlign: 'left'
  });
  textbox._otype = 'note_char';
  textbox.setControlsVisibility({
    mt: false,
    mb: false,
    bl: false,
    br: false,
    ml: false,
    mr: false,
    tl: false,
    tr: false,
    mtr: false,
  });
  note._textbox = textbox;
  textbox._note = note;

  canvas.add(note);
  canvas.add(textbox);
  noteList.push(note);
}


function piano_remove_note(obj) {
  canvas.remove(obj);
  canvas.remove(obj._textbox);
  noteList.splice(noteList.indexOf(obj), 1);
}


function piano_clear() {
  noteList.forEach(v => {
    canvas.remove(v);
    canvas.remove(v._textbox);
  })
  noteList = [];
  canvas.renderAll();
}


function piano_export_notes() {
  let list = [];
  noteList.forEach((v, idx) => {
    list.push({
      x: Math.round(v.left / XUnit),
      y: Math.round(v.top / YUnit),
      w: Math.round(v.width / XUnit),
      text: v._textbox.text
    })
  })
  return list;
}


function piano_export() {
  let notes = [];
  let positionNotes = piano_export_notes();
  if (positionNotes.length === 0) {
    return { status: 0, msg: "钢琴窗上没有音符，无法保存" };
  }


  positionNotes.sort((a, b) => {
    return a.x - b.x;
  });

  for (let i = 0; i < positionNotes.length; i++) {
    let v = positionNotes[i], nv = positionNotes[i + 1];
    if (i === 0 && v.x != 1) {
      let len = v.x - 1;
      notes.push({
        text: len <= 1 ? "SP" : "AP",
        pitch: null,
        length: len,
        unit: beat_unit,
        x: -1,
        y: -1
      })
    }

    if (v.text.length > 1) {
      return { status: 0, msg: "部分音符标记为词，而不是字。请手动修正" };
    }
    if (v.text === '_') {
      return { status: 0, msg: "部分音符未标记，请手动修正" };
    }

    notes.push({
      text: v.text,
      pitch: labelTexts[(YRange - v.y - 1) % 12] + Math.ceil((YRange - v.y) / 12),
      length: v.w,
      unit: beat_unit,
      x: v.x,
      y: v.y
    })

    if (nv !== undefined && v.x + v.w > nv.x) {
      return { status: 0, msg: "时间轴上有音符重叠，请手动修正" };
    }
    else if (nv !== undefined && v.x + v.w < nv.x) {
      let len = nv.x - (v.x + v.w);
      notes.push({
        text: len <= 1 ? "SP" : "AP",
        pitch: null,
        length: len,
        unit: beat_unit,
        x: -1,
        y: -1
      })
    }
  }

  return {
    status: 1,
    bpm: Bpm,
    notes: notes,
  }
}


function piano_import(piano_info) {
  clearingMode = false;
  let { bpm, notes } = piano_info
  Bpm = bpm;
  beat_unit = notes[0].unit;

  let notes_list = [];
  let x_edge = -1;
  notes.forEach((v, idx) => {
    if (v.text === "SP" || v.text === "AP") { }
    else {
      notes_list.push({
        x: v.x,
        y: v.y,
        w: v.length,
        text: v.text
      })
    }
    if (v.x + v.length - 1 > x_edge) {
      x_edge = v.x + v.length - 1;
    }
  })

  if (noteList.length > 0)
    piano_clear();
  piano_restore_notes(notes_list);

  let bars = Math.ceil(x_edge / bar_beats);
  piano_paint(bars * bar_beats, YRange, XUnit, YUnit, beat_unit, bar_beats);
  return bars;
}


function piano_restore_notes(exported_list) {
  clearingMode = false;
  exported_list.forEach((v, idx) => {
    let { x, y, w, text } = v;
    piano_add_note(x * XUnit, y * YUnit, w * XUnit, text);
  })
}


var originXUnit = -1;
var originYUnit = -1;
var currentScale = 1;

function piano_zoom_out(x = true, y = true) {
  currentScale -= 0.1;
  let xu = x ? originXUnit * currentScale : XUnit;
  let yu = y ? originYUnit * currentScale : YUnit;
  piano_paint(XRange, YRange, xu, yu, beat_unit, bar_beats);
}

function piano_zoom_in(x = true, y = true) {
  currentScale += 0.1;
  let xu = x ? originXUnit * currentScale : XUnit;
  let yu = y ? originYUnit * currentScale : YUnit;
  piano_paint(XRange, YRange, xu, yu, beat_unit, bar_beats);
}

function piano_zoom_default() {
  currentScale = 1;
  piano_paint(XRange, YRange, originXUnit, originYUnit, beat_unit, bar_beats);
}

originXUnit = 64;
originYUnit = 28;
var Bpm = 120;
