export function parseNC(text) {
  const lines = text.split('\n')
  const tools = []
  const variables = []
  const coordinates = []
  const blocks = []
  const lineCoords = []
  let currentBlock = null
  let currentCoord = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1
    const trimmed = line.trim()

    const nMatch = trimmed.match(/^(N(\d+))\(/)
    if (nMatch) {
      if (currentBlock) blocks.push(currentBlock)
      const nNumber = nMatch[2]
      const parenContents = trimmed.match(/\(([^)]+)\)/g) || []
      const toolName = parenContents[0] ? parenContents[0].slice(1, -1) : ''
      const holderName = parenContents[1] ? parenContents[1].slice(1, -1) : ''
      currentBlock = {
        n: nNumber,
        nFull: nMatch[1],
        toolName,
        holderName,
        toolNo: null,
        hNo: null,
        dNo: null,
        startLine: lineNum,
        endLine: lineNum,
        variables: [],
        gCodes: [],
        mCodes: []
      }
    }

    const tMatch = trimmed.match(/T(\d+)M6/)
    if (tMatch && currentBlock) {
      currentBlock.toolNo = tMatch[1]
      currentBlock.hNo = tMatch[1]
      currentBlock.dNo = tMatch[1]
    }

    const hMatch = trimmed.match(/H(\d+)/)
    if (hMatch && currentBlock) currentBlock.hNo = hMatch[1]
    const dMatch = trimmed.match(/D(\d+)/)
    if (dMatch && currentBlock) currentBlock.dNo = dMatch[1]

    const vMatches = trimmed.matchAll(/#(\d+)=([-\d.]+)/g)
    for (const m of vMatches) {
      const v = { id: m[1], value: m[2], line: lineNum, block: currentBlock ? currentBlock.nFull : null }
      variables.push(v)
      if (currentBlock) currentBlock.variables.push(v)
    }

    const gMatches = trimmed.matchAll(/G(\d+)/g)
    for (const m of gMatches) {
      if (currentBlock) currentBlock.gCodes.push(parseInt(m[1]))
    }

    const mMatches = trimmed.matchAll(/M(\d+)/g)
    for (const m of mMatches) {
      if (currentBlock) currentBlock.mCodes.push(parseInt(m[1]))
    }

    const wMatch = trimmed.match(/G(5[4-9])\b/)
    if (wMatch) {
      currentCoord = `G${wMatch[1]}`
      if (!coordinates.find(c => c.code === currentCoord)) {
        coordinates.push({ code: currentCoord, line: lineNum })
      }
    }

    if (/G#100/.test(trimmed)) {
      const var500 = variables.find(v => v.id === '500')
      const start = 54
      const end = var500 ? 53 + parseInt(var500.value) : 55
      currentCoord = `G${start}~G${end}`
      if (!coordinates.find(c => c.code.startsWith('G54~'))) {
        coordinates.push({ code: `G${start}~G${end}`, dynamic: true, line: lineNum })
      }
    }

    lineCoords.push(currentCoord)
    if (currentBlock) currentBlock.endLine = lineNum
  }
  if (currentBlock) blocks.push(currentBlock)

  for (const b of blocks) {
    if (b.toolNo) {
      let type = '其他'
      const upper = (b.toolName || '').toUpperCase()
      if (/^FM|^FEM/.test(upper)) type = '面銑'
      else if (/^EM/.test(upper)) type = '輪廓銑'
      else if (/^CDR/.test(upper)) type = '定點鑽'
      else if (/^DR|^SDR/.test(upper)) type = '鑽孔'
      else if (/^TAP/.test(upper)) type = '攻牙'
      else if (/^SEM/.test(upper)) type = '端銑'
      else if (/^FOM/.test(upper)) type = '成型銑'
      else if (/^AM/.test(upper)) type = '角度銑'
      else if (/^TM/.test(upper)) type = '螺紋銑'

      tools.push({
        n: b.nFull,
        toolNo: b.toolNo,
        toolName: b.toolName,
        holderName: b.holderName,
        type,
        hNo: b.hNo,
        dNo: b.dNo,
        variables: b.variables,
        block: b
      })
    }
  }

  return { blocks, tools, variables, coordinates, rawText: text, lines, lineCoords }
}
