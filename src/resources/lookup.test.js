import {BGM} from "./generated/asset-dictionary"
import {LocateBGM} from "./lookup"

const folder = (name, version) => (LocateBGM(name, version) || "").split("/")[3]

test("LocateBGM finds a version of every track for every setting", () => {
  // the PS2-only tracks (bgm63, demo01…) used to loop forever with Original
  Object.keys(BGM).forEach(name => {
    ["vita", "ps2", "classic", "original"].forEach(version => {
      // name and version are in the array only so that a failure says which track it was
      expect([name, version, folder(name, version)]).toEqual([name, version, expect.stringMatching(/^(vita|ps2|classic|original)$/)])
    })
  })
})

test("LocateBGM prefers vita, then ps2, then original", () => {
  expect(folder("bgm63", "original")).toBe("ps2")
  expect(folder("bgm01", "vita")).toBe("vita") // ov
  expect(folder("bgm01", "ps2")).toBe("original")
  expect(folder("bgm01", "original")).toBe("original")
  const noVita = Object.keys(BGM).find(name => BGM[name] === "op") // a track with only original and ps2 versions
  expect(folder(noVita, "vita")).toBe("ps2")
  expect(LocateBGM("no-such-track", "vita")).toBeUndefined()
})
