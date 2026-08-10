import { defineStore } from 'pinia'
import { parseNC } from '../parsers/ncParser'
import { checkNC } from '../utils/codeChecker'

export const useEditorStore = defineStore('editor', {
  state: () => ({
    files: [],
    activeFileId: null,
    nextFileId: 1,
    splitCount: 0,
    splitSlotIds: [],
    selectedNav: 'tools',
    searchByFile: {},
    errorsByFile: {},
    errorDebounceTimer: null,
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
    activeFile: (state) => state.files.find(f => f.id === state.activeFileId) || null,
    fileById: (state) => (id) => state.files.find(f => f.id === id) || null,
    activeParsed() { return this.activeFile?.parsed || null },
    tools() { return this.activeParsed?.tools || [] },
    variables() { return this.activeParsed?.variables || [] },
    coordinates() { return this.activeParsed?.coordinates || [] },
    lines() { return this.activeParsed?.lines || [] },
    errors() { return this.errorsByFile[this.activeFileId] || [] },
    errorCount() { return this.errors.filter(p => p.type === 'error' || p.type === 'warning').length },
    blocks() { return this.activeParsed?.blocks || [] },
    lineCoords() { return this.activeParsed?.lineCoords || [] },
    currentFileName() { return this.activeFile?.fileName || '' },
    currentLine() { return this.activeFile?.currentLine ?? -1 },
    bookmarks() { return this.activeFile?.bookmarks || [] },
    effectiveSyntaxColors() {
      if (!this.monochrome) return this.syntaxColors
      const gray = { G: '#6c7086', M: '#6c7086', N: '#6c7086', X: '#6c7086', Y: '#6c7086', Z: '#6c7086', S: '#6c7086', F: '#6c7086', T: '#6c7086', H: '#6c7086', D: '#6c7086', variable: '#6c7086', comment: '#6c7086' }
      const out = { ...gray }
      for (const key of Object.keys(this.monoEnabled)) {
        if (this.monoEnabled[key] && this.syntaxColors[key]) {
          out[key] = this.syntaxColors[key]
        }
      }
      return out
    },
    splitSlots() {
      const out = []
      for (let i = 0; i < this.splitCount; i++) {
        const id = this.splitSlotIds[i] ?? null
        out.push({ id, file: id != null ? this.fileById(id) : null })
      }
      return out
    }
  },

  actions: {
    addFile(file) {
      const id = this.nextFileId++
      const rec = { id, fileName: file.name, rawText: '', parsed: null, currentLine: -1, bookmarks: [] }
      this.files.push(rec)
      this.setActiveFile(id)
      const reader = new FileReader()
      reader.onload = () => {
        const target = this.files.find(f => f.id === id)
        if (!target) return
        target.rawText = reader.result
        target.parsed = parseNC(reader.result)
        this.runCheck(id)
        const emptyIdx = this.splitSlotIds.indexOf(null)
        if (emptyIdx >= 0) {
          const arr = this.splitSlotIds.slice()
          arr[emptyIdx] = id
          this.splitSlotIds = arr
        }
      }
      reader.readAsText(file, 'utf-8')
    },

    setSplit(count) {
      if (![2, 3].includes(count)) return
      const arr = this.splitSlotIds.slice(0, count)
      while (arr.length < count) {
        const next = this.files.find(f => !arr.includes(f.id))
        arr.push(next ? next.id : null)
      }
      this.splitSlotIds = arr
      this.splitCount = count
    },

    exitSplit() {
      this.splitCount = 0
      this.splitSlotIds = []
    },

    setSlot(index, fileId) {
      if (index < 0 || index >= this.splitSlotIds.length) return
      if (!this.files.some(f => f.id === fileId)) return
      const arr = this.splitSlotIds.slice()
      const dupIdx = arr.indexOf(fileId)
      if (dupIdx >= 0) arr[dupIdx] = arr[index]
      arr[index] = fileId
      this.splitSlotIds = arr
    },

    closeSlot(index) {
      if (index < 0 || index >= this.splitSlotIds.length) return
      const arr = this.splitSlotIds.slice()
      arr[index] = null
      this.splitSlotIds = arr
    },

    moveSlot(from, to) {
      if (from === to || from < 0 || to < 0) return
      const arr = this.splitSlotIds.slice()
      if (from >= arr.length || to >= arr.length) return
      const [item] = arr.splice(from, 1)
      arr.splice(to, 0, item)
      this.splitSlotIds = arr
    },

    setActiveFile(id) {
      if (!this.files.some(f => f.id === id)) return
      this.activeFileId = id
      this.runCheck(id)
    },

    removeFile(id) {
      const idx = this.files.findIndex(f => f.id === id)
      if (idx < 0) return
      this.files.splice(idx, 1)
      const eb = { ...this.errorsByFile }
      delete eb[id]
      this.errorsByFile = eb
      const sb = { ...this.searchByFile }
      delete sb[id]
      this.searchByFile = sb
      if (this.activeFileId === id) {
        if (this.files.length) {
          this.setActiveFile(this.files[Math.max(0, idx - 1)].id)
        } else {
          this.activeFileId = null
        }
      }
      const slotIdx = this.splitSlotIds.indexOf(id)
      if (slotIdx >= 0) {
        const arr = this.splitSlotIds.slice()
        arr[slotIdx] = null
        this.splitSlotIds = arr
      }
    },

    updateFileText(fileId, text) {
      const f = this.files.find(f => f.id === fileId)
      if (!f) return
      f.rawText = text
      this.scheduleCheck(fileId)
    },

    setCurrentLine(fileId, line) {
      const f = this.files.find(f => f.id === fileId)
      if (f) f.currentLine = line
    },

    async openFile() {
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.nc,.txt'
        input.onchange = (e) => {
          const file = e.target.files[0]
          if (!file) return
          this.addFile(file)
          resolve()
        }
        input.click()
      })
    },

    saveFile() {
      const f = this.activeFile
      if (!f || !f.rawText) return
      const blob = new Blob([f.rawText], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = f.fileName || 'program.nc'
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

    search(fileId, keyword) {
      const st = this.searchByFile[fileId] || { keyword: '', results: [], index: -1 }
      st.keyword = keyword
      if (!keyword) {
        st.results = []
        st.index = -1
        this.searchByFile[fileId] = st
        return
      }
      const f = this.fileById(fileId)
      const lines = f?.parsed?.lines || []
      const results = []
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(keyword)) {
          results.push({ line: i, text: lines[i].trim() })
        }
      }
      st.results = results
      st.index = results.length > 0 ? 0 : -1
      this.searchByFile[fileId] = st
    },

    searchState(fileId) {
      return this.searchByFile[fileId] || { keyword: '', results: [], index: -1 }
    },

    nextSearch(fileId) {
      const st = this.searchState(fileId)
      if (st.results.length === 0) return
      st.index = (st.index + 1) % st.results.length
      const f = this.fileById(fileId)
      if (f) f.currentLine = st.results[st.index].line
      this.searchByFile[fileId] = st
    },

    prevSearch(fileId) {
      const st = this.searchState(fileId)
      if (st.results.length === 0) return
      st.index = st.index <= 0 ? st.results.length - 1 : st.index - 1
      const f = this.fileById(fileId)
      if (f) f.currentLine = st.results[st.index].line
      this.searchByFile[fileId] = st
    },

    goToLine(lineIndex) {
      const f = this.activeFile
      if (f) f.currentLine = lineIndex
      this.searchByFile[this.activeFileId] = { keyword: '', results: [{ line: lineIndex, text: this.lines[lineIndex] }], index: 0 }
    },

    addBookmarks(fileId) {
      const f = this.fileById(fileId)
      if (!f) return
      const st = this.searchState(fileId)
      if (!st.results.length) return
      for (const r of st.results) {
        if (!f.bookmarks.includes(r.line)) f.bookmarks.push(r.line)
      }
      f.bookmarks.sort((a, b) => a - b)
    },

    removeBookmark(line) {
      const f = this.activeFile
      if (!f) return
      f.bookmarks = f.bookmarks.filter(l => l !== line)
    },

    clearBookmarks(fileId) {
      const f = this.fileById(fileId)
      if (f) f.bookmarks = []
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

    runCheck(fileId) {
      const f = this.files.find(f => f.id === fileId)
      if (!f || !f.rawText) {
        this.errorsByFile = { ...this.errorsByFile, [fileId]: [] }
        return
      }
      const parsed = parseNC(f.rawText)
      const problems = checkNC({
        text: f.rawText,
        blocks: parsed.blocks || [],
        tools: parsed.tools || [],
        variables: parsed.variables || [],
        lineCoords: parsed.lineCoords || []
      })
      this.errorsByFile = { ...this.errorsByFile, [fileId]: problems }
    },

    scheduleCheck(fileId) {
      if (this.errorDebounceTimer) clearTimeout(this.errorDebounceTimer)
      this.errorDebounceTimer = setTimeout(() => {
        this.runCheck(fileId)
        this.errorDebounceTimer = null
      }, 300)
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
