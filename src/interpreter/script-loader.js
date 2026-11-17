import React, {Component} from "react"
import {withOptions} from "../reader/debug"
import {LocateScript} from "../resources/lookup"
import Render from "./parse/render"
import Tokenize from "./parse/tokenize"
import "./script-loader.css"

// fetches a script's text, failing on a server error too
const fetchText = async url => {
  const response = await fetch(url)
  if (!response.ok) { // the body is the server's error page, the status says enough
    throw new Error("server answered " + response.status + " " + (response.statusText || ""))
  }
  return response.text()
}

class ScriptLoader extends Component {
  constructor(props) {
    super(props)
    this.preRender = this.preRender.bind(this)
    this.load = this.load.bind(this)

    this.state = {display: []}
  }

  componentDidMount() {
    this.load()
  }

  async load() {
    this.setState({error: undefined})
    let file, macroFile
    try {
      [file, macroFile] = await Promise.all([
        fetchText(LocateScript(this.props.storage, this.props.options.lang)),
        this.props.gameState ? undefined : fetchText("/static/scripts/マクロ.ks.gz"), // the first scene starts with the macros
      ])
    } catch (e) { // offline, or the server answered with an error: worth trying again
      this.setState({error: {text: "Couldn't load this scene.", detail: e.message, retry: true}})
      return
    }

    this.preRender(file, macroFile)
  }

  preRender(file, macroFile) {
    const stackFrame = (this.props.gameState && this.props.gameState.stackFrame) || {}
    stackFrame.storage = this.props.storage
    stackFrame.file = file
    stackFrame.fileIndex = 0

    let gameState = this.props.gameState

    if (gameState) {
      gameState.stackFrame = stackFrame
    }

    if (!gameState) {
      // call macro first, and "return" to the specified storage
      gameState = {
        macros: {},
        stackFrame: {storage: "マクロ", file: macroFile, fileIndex: 0, returnFrame: stackFrame},
      }
    }

    let start = performance.now()

    let tokens = []
    let tokenTime, display
    try {
      Tokenize(tokens, gameState, this.props.target)
      tokenTime = performance.now()
      display = Render(tokens, this.props.renderState, this.props.onPageReady, this.props.options.debugLevel)
    } catch (e) { // the script itself is broken, so trying again won't help
      console.error(e)
      this.setState({error: {text: "Couldn't read this scene.", detail: e.message}})
      return
    }
    let renderTime = performance.now()

    console.log("tokenize: " + (tokenTime - start) + "ms  render: " + (renderTime - tokenTime) + "ms")
    this.setState({tokens: tokens, display: display})
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (prevProps.options.debugLevel !== this.props.options.debugLevel) {
      if (this.state.tokens) {
        this.setState({display: Render(this.state.tokens, this.props.renderState, this.props.onPageReady, this.props.options.debugLevel)})
      }
    }
  }

  render() {
    const error = this.state.error
    if (error) {
      return <div className="script-error">
        <div>{error.text}</div>
        <pre>{error.detail}</pre>
        {error.retry && <button className="choice-button" onClick={this.load}>Retry</button>}
      </div>
    }
    return this.state.display
  }
}

ScriptLoader = withOptions(ScriptLoader)
export default ScriptLoader
