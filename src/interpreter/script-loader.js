import {Component} from "react"
import {withOptions} from "../reader/debug"
import {LocateScript} from "../resources/lookup"
import Render from "./parse/render"
import Tokenize from "./parse/tokenize"

class ScriptLoader extends Component {
  constructor(props) {
    super(props)
    this.preRender = this.preRender.bind(this)

    this.state = {display: []}
  }

  componentDidMount() {
    this.load()
  }

  async load() {
    const scriptFetchPromise = fetch(LocateScript(this.props.storage, this.props.options.lang))

    let macroFile
    if (!this.props.gameState) {
      const response = await fetch("/static/scripts/マクロ.ks.gz")
      macroFile = await response.text()
      if (!response.ok) {
        this.setState({display: "failed to load: " + macroFile})
        return
      }
    }

    const response = await scriptFetchPromise
    const file = await response.text()
    if (!response.ok) {
      this.setState({display: "failed to load: " + file})
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
      const options = this.props.options
      gameState = {
        macros: {},
        // the game's settings that [if] blocks in the scripts test
        sf: {gtext: options.text, gmature: options.mature ? 1 : 0, ghentai: options.h ? 1 : 0, rinGermanChant: options.germanChant ? 1 : 0},
        stackFrame: {storage: "マクロ", file: macroFile, fileIndex: 0, returnFrame: stackFrame},
      }
    }

    let start = performance.now()

    let tokens = []
    Tokenize(tokens, gameState, this.props.target)
    let tokenTime = performance.now()

    const display = Render(tokens, this.props.renderState, this.props.onPageReady, this.props.options.debugLevel)
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
    return this.state.display
  }
}

ScriptLoader = withOptions(ScriptLoader)
export default ScriptLoader
