import { defineStore } from 'pinia'
import { parseNC } from '../parsers/ncParser'

export const useEditorStore = defineStore('editor', {
  state: () => ({
    rawText: '',
    parsed: null,
    currentFileName: '',
    selectedNav: 'tools',
    searchKeyword: '',
    searchResults: [],
    searchIndex: -1,
    bookmarks: [],
    currentLine: -1,
    showTypeColumn: true,
    monochrome: false,
    monoEnabled: {},
    syntaxColors: {
      G: '#89b4fa',
      M: '#f38ba8',
      N: '#cba6f7',
      variable: '#fab387',
      comment: '#6c7086',
      X: '#a6e3a1',
      Y: '#94e2d5',
      Z: '#f38ba8',
      S: '#f9e2af',
      F: '#fab387',
      T: '#cba6f7',
      H: '#89dceb',
      D: '#eba0ac'
    }
  }),

  getters: {
    tools: (state) => state.parsed?.tools || [],
    variables: (state) => state.parsed?.variables || [],
    coordinates: (state) => state.parsed?.coordinates || [],
    lines: (state) => state.parsed?.lines || [],
    blocks: (state) => state.parsed?.blocks || [],
    lineCoords: (state) => state.parsed?.lineCoords || [],
    effectiveSyntaxColors: (state) => {
      if (!state.monochrome) return state.syntaxColors
      const gray = { G: '#6c7086', M: '#6c7086', N: '#6c7086', X: '#6c7086', Y: '#6c7086', Z: '#6c7086', S: '#6c7086', F: '#6c7086', T: '#6c7086', H: '#6c7086', D: '#6c7086', variable: '#6c7086', comment: '#6c7086' }
      const out = { ...gray }
      for (const key of Object.keys(state.monoEnabled)) {
        if (state.monoEnabled[key] && state.syntaxColors[key]) {
          out[key] = state.syntaxColors[key]
        }
      }
      return out
    }
  },

  actions: {
    loadFile(file) {
      this.currentFileName = file.name
      const reader = new FileReader()
      reader.onload = () => {
      this.rawText = reader.result
      this.parsed = parseNC(this.rawText)
      this.searchKeyword = ''
      this.searchResults = []
      this.searchIndex = -1
      this.bookmarks = []
      }
      reader.readAsText(file, 'utf-8')
    },

    async openFile() {
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.nc,.txt'
        input.onchange = (e) => {
          const file = e.target.files[0]
          if (!file) return
          this.loadFile(file)
          resolve()
        }
        input.click()
      })
    },

    saveFile() {
      if (!this.rawText) return
      const blob = new Blob([this.rawText], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = this.currentFileName || 'program.nc'
      a.click()
      URL.revokeObjectURL(url)
    },

    downloadToolTable() {
      const tools = this.tools
      if (!tools.length) return
      let text = 'N號\t刀具名稱\t刀桿名稱'
      if (this.showTypeColumn) text += '\t加工類型'
      text += '\n' + '='.repeat(60) + '\n'
      for (const t of tools) {
        text += `${t.n}\t${t.toolName}\t${t.holderName}`
        if (this.showTypeColumn) text += `\t${t.type}`
        text += '\n'
      }
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (this.currentFileName || 'program').replace('.nc', '') + '_刀號表.txt'
      a.click()
      URL.revokeObjectURL(url)
    },

    search(keyword) {
      this.searchKeyword = keyword
      if (!keyword) {
        this.searchResults = []
        this.searchIndex = -1
        return
      }
      const results = []
      const lines = this.lines
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(keyword)) {
          results.push({ line: i, text: lines[i].trim() })
        }
      }
      this.searchResults = results
      this.searchIndex = results.length > 0 ? 0 : -1
    },

    nextSearch() {
      if (this.searchResults.length === 0) return
      this.searchIndex = (this.searchIndex + 1) % this.searchResults.length
      this.currentLine = this.searchResults[this.searchIndex].line
    },

    prevSearch() {
      if (this.searchResults.length === 0) return
      this.searchIndex = this.searchIndex <= 0 ? this.searchResults.length - 1 : this.searchIndex - 1
      this.currentLine = this.searchResults[this.searchIndex].line
    },

    goToLine(lineIndex) {
      this.currentLine = lineIndex
      this.searchResults = [{ line: lineIndex, text: this.lines[lineIndex] }]
      this.searchIndex = 0
    },

    addBookmarks() {
      if (!this.searchResults.length) return
      for (const r of this.searchResults) {
        if (!this.bookmarks.includes(r.line)) {
          this.bookmarks.push(r.line)
        }
      }
      this.bookmarks.sort((a, b) => a - b)
    },

    removeBookmark(line) {
      this.bookmarks = this.bookmarks.filter(l => l !== line)
    },

    clearBookmarks() {
      this.bookmarks = []
    },

    setNav(section) {
      this.selectedNav = section
    },

    updateSyntaxColor(category, color) {
      this.syntaxColors[category] = color
      localStorage.setItem('cnc-syntax-colors', JSON.stringify(this.syntaxColors))
    },

    setMonochrome(enabled) {
      this.monochrome = enabled
      localStorage.setItem('cnc-monochrome', JSON.stringify(enabled))
    },

    toggleMonoEnabled(category) {
      this.monoEnabled[category] = !this.monoEnabled[category]
      localStorage.setItem('cnc-mono-enabled', JSON.stringify(this.monoEnabled))
    },

    loadSyntaxColors() {
      try {
        const saved = localStorage.getItem('cnc-syntax-colors')
        if (saved) this.syntaxColors = { ...this.syntaxColors, ...JSON.parse(saved) }
        const mono = localStorage.getItem('cnc-monochrome')
        if (mono != null) this.monochrome = JSON.parse(mono)
        const monoEnabled = localStorage.getItem('cnc-mono-enabled')
        if (monoEnabled) this.monoEnabled = JSON.parse(monoEnabled)
      } catch {}
    }
  }
})
