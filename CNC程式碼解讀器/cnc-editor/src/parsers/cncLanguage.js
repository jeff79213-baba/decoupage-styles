import { LanguageSupport, StreamLanguage, syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags, Tag } from '@lezer/highlight'

const cncTag = {
  N: Tag.define(),
  G: Tag.define(),
  M: Tag.define(),
  X: Tag.define(),
  Y: Tag.define(),
  Z: Tag.define(),
  S: Tag.define(),
  F: Tag.define(),
  T: Tag.define(),
  H: Tag.define(),
  D: Tag.define()
}

export function buildCncLanguage(colors) {
  const lang = StreamLanguage.define({
    startState: () => ({}),
    token(stream) {
      if (stream.eatSpace()) return null
      if (stream.match(/\([^)]*\)/)) return 'comment'
      if (stream.match(/#\d+/)) return 'variable'
      if (stream.match(/N\d+/)) return 'N'
      if (stream.match(/G\d+(\.\d+)?/)) return 'G'
      if (stream.match(/M\d+/)) return 'M'
      if (stream.match(/X(-?[\d.]+)/)) return 'X'
      if (stream.match(/Y(-?[\d.]+)/)) return 'Y'
      if (stream.match(/Z(-?[\d.]+)/)) return 'Z'
      if (stream.match(/S\d+/)) return 'S'
      if (stream.match(/F\d+/)) return 'F'
      if (stream.match(/T\d+/)) return 'T'
      if (stream.match(/H\d+/)) return 'H'
      if (stream.match(/D\d+/)) return 'D'
      stream.next()
      return null
    },
    tokenTable: {
      comment: tags.comment,
      variable: tags.definitionKeyword,
      N: cncTag.N,
      G: cncTag.G,
      M: cncTag.M,
      X: cncTag.X,
      Y: cncTag.Y,
      Z: cncTag.Z,
      S: cncTag.S,
      F: cncTag.F,
      T: cncTag.T,
      H: cncTag.H,
      D: cncTag.D
    }
  })
  return new LanguageSupport(lang, [
    syntaxHighlighting(HighlightStyle.define([
      { tag: tags.comment, color: colors.comment || '#6c7086' },
      { tag: tags.definitionKeyword, color: colors.variable || '#fab387' },
      { tag: cncTag.N, color: colors.N || '#cba6f7' },
      { tag: cncTag.G, color: colors.G || '#89b4fa' },
      { tag: cncTag.M, color: colors.M || '#f38ba8' },
      { tag: cncTag.X, color: colors.X || '#a6e3a1' },
      { tag: cncTag.Y, color: colors.Y || '#94e2d5' },
      { tag: cncTag.Z, color: colors.Z || '#f38ba8' },
      { tag: cncTag.S, color: colors.S || '#f9e2af' },
      { tag: cncTag.F, color: colors.F || '#fab387' },
      { tag: cncTag.T, color: colors.T || '#cba6f7' },
      { tag: cncTag.H, color: colors.H || '#89dceb' },
      { tag: cncTag.D, color: colors.D || '#eba0ac' }
    ]))
  ])
}
