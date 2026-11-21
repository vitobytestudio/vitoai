/**
 * THE AFTER EFFECTS HANDOFF — a project, not a partnership.
 *
 * Why a file instead of an MCP bridge: the bridge that exists in the wild is a
 * stdio server that writes `ae_command.json` into `~/Documents/ae-mcp-bridge`
 * and waits for a `.jsx` panel inside After Effects to poll it. It exposes
 * nineteen whitelisted verbs — create a comp, add a text layer, set a keyframe,
 * apply an effect. That is a remote control, not an editor: building one film
 * through it means hundreds of file-writes and polls, and every creative
 * decision still has to be made on this side.
 *
 * One `.jsx` does the same work in a single pass, inside the application, with
 * no daemon to keep alive, no panel to install, and no whitelist. So ULTRA
 * hands over a project that opens on a workstation and plays.
 *
 * The file below is written for ExtendScript — ES3, no arrow functions, no
 * const, no template strings — because that is what After Effects runs.
 */
import type { Decision } from "./brain";

const hex = (h: string) => {
  const s = (h || "#00FF88").replace("#", "");
  return [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255];
};

export const buildAEProject = (d: Decision): string => {
  const accent = hex(d.accent);
  const total = d.seconds;
  const beats = d.beats.map((b, i) => {
    const start = d.beats.slice(0, i).reduce((n, x) => n + x.seconds, 0);
    return {
      i,
      kind: b.kind,
      start: +start.toFixed(3),
      seconds: b.seconds,
      end: +(start + b.seconds).toFixed(3),
      head: (b.kind === "hook" ? d.headline : b.caption || "").replace(/\n/g, "\r"),
      line: (b.line || "").slice(0, 140),
      world: b.world || "",
    };
  });

  const data = JSON.stringify(
    { title: d.title, accent, total, beats, brand: "NEXUS", lang: d.language },
    null,
    0,
  );

  return `// =====================================================================
//  NEXUS · After Effects project — ${d.title}
//  ${beats.length} beats · ${total}s · 1080x1920 · 30fps
//
//  How to use: File ▸ Scripts ▸ Run Script File… and pick this file.
//  It builds a finished composition in the open project. Nothing is
//  fetched, nothing is installed, and Undo reverses all of it.
//
//  Arabic text: the layers inherit your default font. Set it once in
//  Edit ▸ Preferences ▸ Type, or select all text layers and pick a face
//  with Arabic glyphs (Cairo, IBM Plex Sans Arabic, Tajawal).
// =====================================================================

(function nexusBuild() {
  var D = ${data};
  var W = 1080, H = 1920, FPS = 30;

  if (!app.project) app.newProject();
  app.beginUndoGroup("NEXUS — " + D.title);

  // A scalar property takes a one-element ease array; a 2D or 3D property takes
  // two or three. Passing the wrong length throws and kills the build, so the
  // dimension is read from the property itself.
  function ease(prop, influence) {
    var i, k, n = prop.numKeys, inf = influence || 88, dims, arr;
    dims = (prop.value instanceof Array) ? prop.value.length : 1;
    for (i = 1; i <= n; i++) {
      prop.setInterpolationTypeAtKey(i, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
      arr = [];
      for (k = 0; k < dims; k++) arr.push(new KeyframeEase(0, inf));
      prop.setTemporalEaseAtKey(i, arr, arr);
    }
  }

  function solid(comp, name, color, w, h, x, y) {
    var s = comp.layers.addSolid(color, name, w || W, h || H, 1);
    s.property("Transform").property("Position").setValue([x === undefined ? W / 2 : x, y === undefined ? H / 2 : y]);
    return s;
  }

  function text(comp, str, size, color, x, y, tracking) {
    var t = comp.layers.addText(str);
    var td = t.property("Source Text").value;
    td.fontSize = size;
    td.fillColor = color;
    td.applyFill = true;
    td.applyStroke = false;
    td.justification = ParagraphJustification.CENTER_JUSTIFY;
    td.tracking = tracking || 0;
    t.property("Source Text").setValue(td);
    t.property("Transform").property("Position").setValue([x === undefined ? W / 2 : x, y === undefined ? H / 2 : y]);
    t.motionBlur = true;
    return t;
  }

  function fade(layer, a, b, c, e) {
    var op = layer.property("Transform").property("Opacity");
    op.setValueAtTime(a, 0);
    op.setValueAtTime(b, 100);
    if (c !== undefined) op.setValueAtTime(c, 100);
    if (e !== undefined) op.setValueAtTime(e, 0);
    ease(op);
  }

  function rise(layer, a, b, from, to) {
    var p = layer.property("Transform").property("Position");
    p.setValueAtTime(a, from);
    p.setValueAtTime(b, to);
    ease(p);
  }

  var comp = app.project.items.addComp("NEXUS — " + D.title, W, H, 1, D.total, FPS);
  comp.motionBlur = true;
  comp.workAreaDuration = D.total;

  // --- ground ---------------------------------------------------------
  var bg = solid(comp, "ground", [0.02, 0.031, 0.047]);
  bg.locked = false;

  // --- the camera does the breathing, so no layer has to -------------
  var cam = comp.layers.addCamera("camera", [W / 2, H / 2]);
  var zoom = cam.property("Camera Options").property("Zoom");
  zoom.setValueAtTime(0, 1500);
  zoom.setValueAtTime(D.total, 1380);
  ease(zoom);

  var beat = D.beats, b, i, start, end;

  for (i = 0; i < beat.length; i++) {
    b = beat[i];
    start = b.start;
    end = b.end;

    // an accent rule that draws itself across the frame
    var rule = solid(comp, "rule " + (i + 1), D.accent, 840, 3, W / 2, H * 0.62);
    rule.property("Transform").property("Scale").setValue([0, 100]);
    var sc = rule.property("Transform").property("Scale");
    sc.setValueAtTime(start + 0.1, [0, 100]);
    sc.setValueAtTime(start + 0.7, [100, 100]);
    ease(sc);
    fade(rule, start, start + 0.2, end - 0.3, end);

    if (b.head) {
      var h = text(comp, b.head, b.kind === "hook" ? 118 : 78, [0.94, 0.96, 1], W / 2, H * 0.52, b.kind === "hook" ? -40 : -20);
      fade(h, start + 0.05, start + 0.5, end - 0.35, end);
      rise(h, start + 0.05, start + 0.7, [W / 2, H * 0.52 + 70], [W / 2, H * 0.52]);
    }

    if (b.line) {
      var l = text(comp, b.line, 34, [0.55, 0.63, 0.72], W / 2, H * 0.68, 0);
      fade(l, start + 0.25, start + 0.8, end - 0.3, end);
    }

    // a marker per beat, so the timeline reads like a shot list
    var mk = new MarkerValue(b.kind + (b.world ? " · " + b.world : ""));
    comp.markerProperty.setValueAtTime(start, mk);
  }

  // --- the signature ------------------------------------------------
  var last = comp.layers.addText(D.brand);
  var ltd = last.property("Source Text").value;
  ltd.fontSize = 64;
  ltd.fillColor = [0.94, 0.96, 1];
  ltd.justification = ParagraphJustification.CENTER_JUSTIFY;
  ltd.tracking = 260;
  last.property("Source Text").setValue(ltd);
  last.property("Transform").property("Position").setValue([W / 2, H * 0.46]);
  fade(last, D.total - 1.4, D.total - 0.7, D.total, D.total);

  // --- grade --------------------------------------------------------
  // A mask drawn by moving Shape vertices is not portable ExtendScript, and an
  // effect by matchName depends on which plug-ins the workstation owns. So the
  // grade is the one thing that always exists: a uniform dim over the film,
  // which the colourist replaces with curves in one click.
  var dim = solid(comp, "grade · dim 12%", [0, 0, 0]);
  dim.adjustmentLayer = false;
  dim.property("Transform").property("Opacity").setValueAtTime(0, 12);
  dim.moveToBeginning();
  dim.locked = true;

  comp.openInViewer();
  app.endUndoGroup();
  alert("NEXUS · " + D.title + "\\n" + beat.length + " beats · " + D.total + "s · built.");
})();
`;
};
