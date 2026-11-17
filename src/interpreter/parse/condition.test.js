import EvalCondition from "./condition"

test("reads macro argument conditions", () => {
  expect(EvalCondition("mp.c!=void||mp.center!=void", {mp: {c: "x"}}, true)).toBe(true)
  expect(EvalCondition("mp.c!=void||mp.center!=void", {mp: {l: "x"}}, true)).toBe(false)
  expect(EvalCondition("mp.erase!='false'", {mp: {}}, true)).toBe(true)
  expect(EvalCondition("mp.erase!='false'", {mp: {erase: "false"}}, true)).toBe(false)
  expect(EvalCondition("mp.pos==''", {mp: {}}, true)).toBe(true)
  expect(EvalCondition("mp.a==1&&mp.b==2", {mp: {a: "1", b: "3"}}, true)).toBe(false)
  // state the renderer doesn't track can't be told
  expect(EvalCondition("f.layer_image['0']!=''", {mp: {}}, true)).toBeUndefined()
})

const classic = {gtext: "classic", gmature: 1, ghentai: 0, rinGermanChant: 0}

test("reads the settings the scripts test", () => {
  expect(EvalCondition("sf.gmature", {sf: classic})).toBe(true)
  expect(EvalCondition("sf.ghentai", {sf: classic})).toBe(false)
  expect(EvalCondition("!sf.ghentai", {sf: classic})).toBe(true)
  expect(EvalCondition("sf.gtext=='classic'", {sf: classic})).toBe(true)
  expect(EvalCondition("sf.gtext!='realta'", {sf: classic})).toBe(true)
  expect(EvalCondition("sf.gtext=='mixed'", {sf: classic})).toBe(false)
  expect(EvalCondition("sf.gtext == 'classic' && !sf.voiceSetting['士郎'][1]", {sf: classic})).toBe(true)
  expect(EvalCondition("sf['g桜クリア']&&sf.gtext!='realta'", {sf: classic})).toBe(false)
  expect(EvalCondition("(sf.gtext=='realta'||sf.gmature)", {sf: classic})).toBe(true)
  // names it doesn't know are void, as in TJS
  expect(EvalCondition("singleRoute||sf.gtext!='mixed'", {sf: classic})).toBe(true)
  expect(EvalCondition("playVitaOp", {sf: classic})).toBe(false)
  expect(EvalCondition("typeof(global.staffroll_object) == 'undefined'", {sf: classic})).toBeUndefined()
  // unless strict: then they can't be told
  expect(EvalCondition("mp.current!=mp.new", {sf: classic}, true)).toBeUndefined()
  expect(EvalCondition("f.superpose_on", {sf: classic}, true)).toBeUndefined()
})
