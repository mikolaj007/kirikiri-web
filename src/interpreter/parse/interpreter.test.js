import Tokenize from "./tokenize"

const classic = {gtext: "classic", gmature: 1, ghentai: 0, rinGermanChant: 0}

const texts = (file, sf) => {
  const tokens = []
  Tokenize(tokens, {macros: {}, sf, stackFrame: {storage: "test", file, fileIndex: 0}})
  return tokens.filter(token => token.type === "t").map(token => token.text.trim()).filter(text => text)
}

test("@if shows only the branch whose condition holds", () => {
  const file = `
@if exp="sf.gtext=='realta'"
Realta.
@elsif exp="sf.gtext=='mixed'"
Mixed.
@else
Classic.
@endif
@if exp="sf.gmature"
Mature.
@if exp="sf.ghentai"
Hentai.
@else
Not hentai.
@endif
@endif
@if exp="!sf.gmature"
Not mature.
@if exp="sf.gtext=='classic'"
Hidden too.
@endif
@endif
End.
`
  expect(texts(file, classic)).toEqual(["Classic.", "Mature.", "Not hentai.", "End."])
  expect(texts(file, {gtext: "mixed", gmature: 0, ghentai: 0})).toEqual(["Mixed.", "Not mature.", "End."])
  expect(texts(file, {gtext: "classic", gmature: 0, ghentai: 0})).toEqual(["Classic.", "Not mature.", "Hidden too.", "End."])
  expect(texts(file, {gtext: "realta", gmature: 1, ghentai: 1})).toEqual(["Realta.", "Mature.", "Hentai.", "End."])
})

test("@if on macro state keeps every branch, as before", () => {
  const file = `
@macro name=m
@if exp="mp.a=='1'"
One.
@else
Other.
@endif
@endmacro
@m a=1
`
  expect(texts(file, classic)).toEqual(["One.", "Other."])
})

test("a skipped @iscript still skips its script", () => {
  const file = `
@if exp="sf.ghentai"
@iscript
var a = %[];
@endscript
@endif
End.
`
  expect(texts(file, classic)).toEqual(["End."])
})
