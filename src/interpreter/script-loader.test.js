import {fireEvent, render, screen, wait} from "@testing-library/react"
import React from "react"
import {Provider} from "../reader/debug"
import ScriptLoader from "./script-loader"

// answers fetch with a tiny macro file, and with scene() for the scene
const mockFetch = scene => {
  global.fetch = jest.fn(url => {
    if (url.includes("マクロ")) {
      return Promise.resolve({ok: true, text: () => Promise.resolve("@return\n")})
    }
    return scene()
  })
}
const ok = text => Promise.resolve({ok: true, text: () => Promise.resolve(text)})

const show = () => render(<Provider value={{lang: "eng", debugLevel: 0}}><ScriptLoader storage="test" onPageReady={() => {}}/></Provider>)

afterEach(() => {
  delete global.fetch
})

test("a scene that can't be fetched says so and can be retried", async () => {
  let online = false
  mockFetch(() => online ? ok("Hello there.\n") : Promise.reject(new TypeError("NetworkError when attempting to fetch resource.")))
  show()
  await screen.findByText(/couldn't load this scene/i)
  online = true
  fireEvent.click(screen.getByText(/retry/i))
  // the text itself only shows inside the reader's scroll sections; here, check the scene loaded
  const sceneFetches = () => global.fetch.mock.calls.filter(([url]) => url.includes("test")).length
  await wait(() => {
    expect(sceneFetches()).toBe(2)
    expect(screen.queryByText(/couldn't/i)).toBeNull()
  })
})

test("a server error says so and can be retried", async () => {
  mockFetch(() => Promise.resolve({ok: false, status: 404, text: () => Promise.resolve("Not Found")}))
  show()
  await screen.findByText(/couldn't load this scene/i)
  expect(screen.getByText(/retry/i)).toBeTruthy()
})

test("a scene that can't be read says so instead of crashing", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {})
  mockFetch(() => ok("[unclosed tag\n"))
  show()
  await screen.findByText(/couldn't read this scene/i)
  expect(screen.queryByText(/retry/i)).toBeNull()
  console.error.mockRestore()
})

test("a failing macro file and scene are both handled", async () => {
  global.fetch = jest.fn(() => Promise.reject(new TypeError("offline")))
  show()
  await screen.findByText(/couldn't load this scene/i)
  expect(global.fetch).toHaveBeenCalledTimes(2)
})
