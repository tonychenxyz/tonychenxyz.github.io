// Shared setup for the hand-drawn engine (video/anim): fonts, plus the Claude mark and provider logos
// as outline points. The outlines are traced once ahead of time (tools/trace_shapes.mjs ->
// data/anim_shapes.json); tracing them in the page took ~7 s per canvas. Data comes from the
// data/*.js script files (SB_DATA) so the page also works from file://. Paths are relative to
// blog/index.html.
// Every file the page needs goes through asset(): the single-file build (tools/build_single.py) fills
// SB_ASSETS with data: URLs keyed by these relative paths.
const asset = p => (window.SB_ASSETS && SB_ASSETS[p]) || p;
const ANIM_FONTS = [
  ['Waiting for the Sunrise', 'WaitingfortheSunrise.ttf'], ['Covered By Your Grace', 'CoveredByYourGrace.ttf'],
  ['Shadows Into Light Two', 'ShadowsIntoLightTwo-Regular.ttf'], ['Reenie Beanie', 'ReenieBeanie.ttf'],
  ['Patrick Hand', 'PatrickHand-Regular.ttf'], ['Gaegu', 'Gaegu-Bold.ttf', 700], ['Gaegu', 'Gaegu-Regular.ttf', 400],
];
async function bootAnim({ scenes = false } = {}) {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');   // initScenes measures text
  await Promise.all(ANIM_FONTS.map(async ([fam, file, weight = 400]) => {
    const f = new FontFace(fam, `url(${asset('fonts/' + file)})`, { weight: String(weight) });
    document.fonts.add(await f.load());
  }));
  CLAUDE_PTS = SB_DATA.anim_shapes.claude;
  Object.assign(LOGOS, SB_DATA.anim_shapes.logos);
  if (scenes) {
    TL = SB_DATA.timeline; TASKS = SB_DATA.tasks;
    IMG.focal = new Image(); IMG.focal.src = asset('anim/assets/focal-fail.png'); await IMG.focal.decode();
    initScenes();
  }
}
