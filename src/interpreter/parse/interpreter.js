import EvalCondition from "./condition"
import Tokenize from "./tokenize"


const ignoreMacros = {cl_notrans: true}
// rep with lists (storages=, poss=…) comes from the port's sprite plugin; the game's rep macro doesn't know
// it, so like cl_notrans it goes to the renderer as it is
const isListRep = tag => tag.command === "rep" && tag.args.storages !== undefined

// resolves "&(mp.a!=void?mp.b:mp.c)" style values, undefined if it isn't one
const evalMacroValue = (value, mp) => {
  const choice = /^&\((.+?)\?mp\.(\w+):mp\.(\w+)\)$/.exec(value)
  if (!choice) {
    return undefined
  }
  const cond = EvalCondition(choice[1], {mp}, true)
  return cond === undefined ? undefined : mp[cond ? choice[2] : choice[3]]
}

// [if] blocks are tracked on gameState.ifStack, one entry per open block:
//   run:  whether the branch being read runs; "all" if its condition can't be told, then every branch runs
//   done: whether a branch of the block already ran, so the [elsif] and [else] after it don't
// returns true if the tag was [if], [elsif], [else] or [endif], which it handles
const handleIf = (tokens, gameState, tag) => {
  const command = tag.command.toLowerCase()
  if (!["if", "elsif", "else", "endif"].includes(command)) {
    return false
  }
  const stack = gameState.ifStack || (gameState.ifStack = [])
  // in a macro, conditions on anything but the settings can't be told
  const holds = () => EvalCondition(tag.args.exp || "", {sf: gameState.sf}, !!tag.depth)

  if (command === "if") {
    if (isSkipping(stack)) {
      stack.push({run: false, done: true}) // inside a branch that doesn't run, so none of this block runs
      return true
    }
    const result = holds()
    stack.push(result === undefined ? {run: "all"} : {run: result, done: result})
    tokens.push(tag)
    return true
  }

  const block = stack[stack.length - 1]
  if (!block) {
    return true // no [if] to go with
  }
  const outerSkipping = isSkipping(stack.slice(0, -1))
  if (command === "endif") {
    stack.pop()
  } else if (block.run !== "all" && !outerSkipping) {
    const result = command === "else" || holds()
    block.run = !block.done && result !== false
    block.done = block.done || block.run
  }
  if (block.run === "all" && !outerSkipping) {
    tokens.push(tag)
  }
  return true
}

// whether any of these [if] blocks is in a branch that doesn't run
const isSkipping = ifStack => ifStack.some(block => block.run === false)

// moves past the end of an [iscript] block
const skipScript = stackFrame => {
  const scriptRegex = /[^]*?\r?\n(?:@endscript|\[endscript])$/my
  scriptRegex.lastIndex = stackFrame.fileIndex
  if (!scriptRegex.exec(stackFrame.file)) {
    throw new Error("unexpected end of file while skipping script")
  }
  stackFrame.fileIndex = scriptRegex.lastIndex
}

// InterpretCommand interprets the given command, and pauses execution of the
const InterpretCommand = (tokens, gameState, tag) => {
  const stackFrame = gameState.stackFrame

  if (stackFrame.macroBuilder) { // if we're building a macro, just add commands to the macro
    const macroBuilder = stackFrame.macroBuilder
    if (tag.command === "endmacro") {
      tokens.push({type: "@", command: "macro", args: {name: macroBuilder.name}, tokens: macroBuilder.macro}) // for debug only, macros should be ignored in general
      gameState.macros[macroBuilder.name] = macroBuilder.macro
      stackFrame.macroBuilder = false
    } else {
      macroBuilder.macro.push(tag)
    }
    return false
  }

  if (tag.type !== "t" && handleIf(tokens, gameState, tag)) {
    return false
  }
  if (isSkipping(gameState.ifStack || [])) {
    if (tag.type !== "t" && tag.command.toLowerCase() === "iscript") {
      skipScript(stackFrame) // the script's body isn't KAG, so skip over it even here
    }
    return false // inside an [if] branch that doesn't run
  }

  if (tag.type === "t") {
    tokens.push(tag)
    return false
  }

  if (tag.command in gameState.macros) { // if a macro, run each command in the macro
    if (!(tag.command in ignoreMacros) && !isListRep(tag)) {
      tokens.push(tag)
      const macro = gameState.macros[tag.command]
      return macro.some(macroCommand => {
        let cmd = macroCommand
        if (macroCommand.type !== "t") {
          const args = Object.assign({}, macroCommand.args)
          // handle '%value' arguments
          Object.keys(macroCommand.args).forEach(key => {
            const value = macroCommand.args[key]
            if (typeof value === "string" && value.startsWith("%")) {
              let val = tag.args[value.substring(1)]
              if (val === undefined) {
                val = tag.args[key]
              }
              if (val !== undefined) {
                args[key] = val
              } else {
                delete args[key]
              }
            }
          })
          // handle '&(...)' expressions of the macro's arguments
          Object.keys(args).forEach(key => {
            const value = args[key]
            if (typeof value === "string" && value.startsWith("&(mp.")) {
              const val = evalMacroValue(value, tag.args)
              if (val !== undefined) {
                args[key] = val
              }
            }
          })
          // skip commands whose condition on the macro's arguments is false
          if (typeof args.cond === "string" && args.cond.includes("mp.")) {
            if (EvalCondition(args.cond, {mp: tag.args}, true) === false) {
              return false
            }
          }
          // handle '*' argument
          if (macroCommand.args["*"]) {
            delete args["*"]
            Object.keys(tag.args).forEach(key => {
              if (!args.hasOwnProperty(key)) {
                args[key] = tag.args[key]
              }
            })
          }

          cmd = {
            type: macroCommand.type,
            command: macroCommand.command,
            originalArgs: macroCommand.args, // only for debug printing
            args: args,
            depth: (tag.depth || 0) + 1,
          }
        }
        return InterpretCommand(tokens, gameState, cmd, stackFrame)
      })
    }
  }

  switch (tag.command.toLowerCase()) {
    case "jump":
      tokens.push(tag)

      // // TODO: re-enable jump statements once "cond" tests are implemented.  This was causing an infinite loop when
      // tokens.push({
      //   type: "call",
      //   gameState,
      //   storage: tag.args.storage || stackFrame.storage,
      //   target: tag.args.target && tag.args.target.substring(1),
      // })
      // return true
      break
    case "call":
      tokens.push(tag)

      gameState.stackFrame = {returnFrame: gameState.stackFrame}
      tokens.push({
        type: "call",
        gameState,
        storage: tag.args.storage || stackFrame.storage,
        target: tag.args.target && tag.args.target.substring(1),
      })
      return true
    case "return":
      if (stackFrame.returnFrame) {
        tokens.push(Object.assign({from: stackFrame.storage, to: stackFrame.returnFrame.storage}, tag))

        gameState.stackFrame = stackFrame.returnFrame
        Tokenize(tokens, gameState)
      } else {
        tokens.push({type: "HCF"})
      }
      return true
    case "iscript":
      const scriptStart = stackFrame.fileIndex
      skipScript(stackFrame)
      tokens.push(Object.assign({file: stackFrame.file, scriptStart, scriptEnd: stackFrame.fileIndex}, tag))
      break
    case "macro":
      // start building macro
      stackFrame.macroBuilder = {name: tag.args.name, macro: []}
      break
    case "erasemacro":
      tokens.push(tag)
      delete gameState.macros[tag.args.name]
      break
    case "s":
      tokens.push(tag)
      return true
    default:
      tokens.push(tag)
  }
  return false
}

export default InterpretCommand
