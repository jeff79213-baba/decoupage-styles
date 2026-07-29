import { StreamLanguage } from '@codemirror/language'

export function buildCncLanguage(colors) {
  return StreamLanguage.define({
    startState: () => ({}),
    token(stream) {
      if (stream.eatSpace()) return null

      if (stream.match(/\([^)]*\)/)) return 'comment'

      if (stream.match(/#\d+/)) return 'variable'

      if (stream.match(/N\d+/)) return 'nBlock'

      if (stream.match(/G\d+/)) return 'gCode'

      if (stream.match(/M\d+/)) return 'mCode'

      if (stream.match(/[THD]\d+/)) return 'toolCode'

      stream.next()
      return null
    }
  })
}
