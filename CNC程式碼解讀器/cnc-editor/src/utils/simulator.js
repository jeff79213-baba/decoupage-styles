export function simulatePath(lines) {
  const paths = []
  let currentX = 0, currentY = 0
  let compSide = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase().trim()
    if (!line || line.startsWith('(') || line.startsWith(';')) continue

    const xMatch = line.match(/X(-?[\d.]+)/)
    const yMatch = line.match(/Y(-?[\d.]+)/)
    const gMatch = line.match(/G0?(\d+)/)
    const gCode = gMatch ? parseInt(gMatch[1]) : null

    if (line.includes('G41')) compSide = 41
    if (line.includes('G42')) compSide = 42
    if (line.includes('G40')) compSide = null

    const newX = xMatch ? parseFloat(xMatch[1]) : currentX
    const newY = yMatch ? parseFloat(yMatch[1]) : currentY

    if (gCode === 0) {
      if (xMatch || yMatch) {
        paths.push({ x1: currentX, y1: currentY, x2: newX, y2: newY, cutting: false })
      }
    } else if (gCode === 1 || (gCode !== 0 && (xMatch || yMatch) && gCode === null)) {
      if (xMatch || yMatch) {
        paths.push({ x1: currentX, y1: currentY, x2: newX, y2: newY, cutting: true, comp: compSide })
      }
    }

    if (gCode && [81, 82, 83, 84, 85, 86, 87].includes(gCode)) {
      paths.push({ x1: newX, y1: newY, x2: newX, y2: newY, cutting: false, cycle: true })
    }

    currentX = newX
    currentY = newY
  }

  return paths
}
