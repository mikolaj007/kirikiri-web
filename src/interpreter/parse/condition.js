// EvalCondition reads the TJS expressions that the scripts use as conditions, such as
//   @if exp="sf.gtext=='classic' && !sf.voiceSetting['士郎'][1]"    (tests the game's settings)
//   cond="mp.nowait=='' || mp.nowait=='true'"                        (in a macro, tests its arguments)
// It knows names, 'strings', numbers, a.b, a[b], !, == and !=, && and ||, and parentheses.
// That covers the conditions in the game's scripts that depend only on settings or macro arguments.
//
// scope holds the values that names refer to, e.g. {sf: settings} or {mp: macro arguments}.
// A name outside scope is void, as in TJS, so a flag that isn't tracked reads as false. With strict, it
// makes the condition unknown instead; that is for macros, which also test state the renderer doesn't
// track (f., kag., tf.). typeof is always unknown.
//
// Returns true or false, or undefined if the condition can't be told.
const EvalCondition = (exp, scope, strict) => {
  const tokens = tokenize(exp)
  let pos = 0
  let unknown = false
  const peek = () => tokens[pos]
  const next = () => tokens[pos++]

  // Each step below reads one level of the expression, loosest first:
  //   or         = and ("||" and)*
  //   and        = comparison ("&&" comparison)*
  //   comparison = unary (("==" | "!=" | "===" | "!==") unary)?
  //   unary      = "!" unary | value
  //   value      = "(" or ")" | string | number | name ("." key | "[" or "]")*
  // Both sides of && and || are always read, since the reader has to step over them anyway.
  const or = () => {
    let result = and()
    while (peek() === "||") {
      next()
      const right = and()
      result = result || right
    }
    return result
  }

  const and = () => {
    let result = truthy(comparison())
    while (peek() === "&&") {
      next()
      const right = truthy(comparison())
      result = result && right
    }
    return result
  }

  const comparison = () => {
    const left = unary()
    const operator = peek()
    if (!["==", "!=", "===", "!=="].includes(operator)) {
      return left
    }
    next()
    const same = equal(left, unary())
    return operator.startsWith("=") ? same : !same
  }

  const unary = () => {
    if (peek() === "!") {
      next()
      return !truthy(unary())
    }
    return value()
  }

  const value = () => {
    const token = next()
    if (token === undefined) {
      return undefined
    }
    if (token === "(") {
      const result = or()
      next() // ")"
      return result
    }
    if (token.startsWith("'") || token.startsWith('"')) {
      return token.slice(1, -1)
    }
    if (/^-?\d+$/.test(token)) {
      return parseInt(token, 10)
    }
    return name(token)
  }

  const name = token => {
    let result
    if (token in scope) {
      result = scope[token] || {}
    } else if (token === "typeof" || (strict && token !== "void")) {
      unknown = true
    }
    while (peek() === "." || peek() === "[") {
      if (next() === ".") {
        result = member(result, next())
      } else {
        const key = or()
        next() // "]"
        result = member(result, key)
      }
    }
    return result
  }

  const result = or()
  return unknown ? undefined : result
}

// splits an expression into strings, numbers, names and operators
const tokenRegex = /\s*('[^']*'|"[^"]*"|-?\d+|[^\s.[\]()!=<>&|'"]+|===|!==|==|!=|<=|>=|&&|\|\||[.[\]()!<>])/y
const tokenize = exp => {
  const tokens = []
  const end = exp.replace(/\s+$/, "").length
  tokenRegex.lastIndex = 0
  while (tokenRegex.lastIndex < end) {
    const match = tokenRegex.exec(exp)
    if (!match) {
      break
    }
    tokens.push(match[1])
  }
  return tokens
}

// as in TJS, void, null, 0, "" and false are false
const truthy = value => value !== undefined && value !== null && value !== 0 && value !== "" && value !== false

// as in TJS ==, void equals "" and 0, and other values compare as strings ("1" == 1)
const equal = (a, b) => {
  if (a === undefined || b === undefined) {
    return !truthy(a) && !truthy(b)
  }
  return String(a) === String(b)
}

// a.b or a[b], void if a is void
const member = (value, key) => value === undefined || value === null ? undefined : value[key]

export default EvalCondition
