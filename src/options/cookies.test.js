import Introduction from "../home/introduction/introduction"
import Options from "./options"

// collects every cookie string written while running fn
const written = fn => {
  const cookies = []
  const spy = jest.spyOn(document, "cookie", "set").mockImplementation(value => cookies.push(value))
  try {
    fn()
  } finally {
    spy.mockRestore()
  }
  return cookies
}

const TEN_YEARS = "max-age=315360000"

test("settings cookies outlive the browser session", () => {
  const options = new Options({})
  options.setState = () => {}
  const cookies = written(() => options.setSaveState({bgm: 30}))
  expect(cookies.length).toBeGreaterThan(0)
  cookies.forEach(cookie => {
    expect(cookie).toContain(TEN_YEARS)
    expect(cookie).not.toContain("expires=")
  })
})

test("introduction cookies outlive the browser session", () => {
  const intro = new Introduction({})
  intro.setState = () => {}
  const [cookie] = written(() => intro.updateCookie("howto", "true"))
  expect(cookie).toContain(TEN_YEARS)
  expect(cookie).not.toContain("expires=")
})
