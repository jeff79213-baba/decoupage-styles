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
    currentLine: -1,
    showTypeColumn: true,
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
    lineCoords: (state) => state.parsed?.lineCoords || []
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

    setNav(section) {
      this.selectedNav = section
    },

    updateSyntaxColor(category, color) {
      this.syntaxColors[category] = color
      localStorage.setItem('cnc-syntax-colors', JSON.stringify(this.syntaxColors))
    },

    loadSyntaxColors() {
      try {
        const saved = localStorage.getItem('cnc-syntax-colors')
        if (saved) this.syntaxColors = { ...this.syntaxColors, ...JSON.parse(saved) }
      } catch {}
    }
  }
})
