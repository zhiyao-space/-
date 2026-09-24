export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
export const now = () => Date.now()
export const pad = n => String(n).padStart(2, '0')
export const fmtTime = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
export const fmtDate = ts => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()}` }
export const fmtFull = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}` }
export const DAY = 86400000
export function relTime(ts) {
  const diff = now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  const d = new Date(ts), t = new Date()
  if (ts - now() > 0 && diff < 0) return `${Math.floor(-diff / 60000)}分钟后`
  if (d.toDateString() === t.toDateString()) return fmtTime(ts)
  if (now() - ts < DAY) return '昨天'
  return fmtDate(ts)
}
export const isSameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()
export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
export const weekCN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export function timeInfo(d = new Date()) {
  const h = d.getHours()
  const phase = h < 5 ? '凌晨' : h < 9 ? '早晨' : h < 12 ? '上午' : h < 14 ? '中午' : h < 18 ? '下午' : h < 22 ? '晚上' : '深夜'
  const isWorkday = d.getDay() >= 1 && d.getDay() <= 5
  return { h, phase, isWorkday, week: weekCN[d.getDay()], date: `${d.getMonth() + 1}月${d.getDate()}日`, clock: `${pad(h)}:${pad(d.getMinutes())}` }
}

export function download(name, text) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  a.download = name; a.click(); URL.revokeObjectURL(a.href)
}
export function pickFile(accept = '*/*', multiple = false) {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = multiple
    i.onchange = () => res(multiple ? [...i.files] : i.files[0]); i.click()
  })
}
export function readAsDataURL(f) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f) })
}
export function readAsText(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(f) }) }

export function compressImage(file, max = 300, quality = 0.85) {
  return new Promise(res => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = img.width * scale; c.height = img.height * scale
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      res(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => res('')
    img.src = URL.createObjectURL(file)
  })
}
export function compressImageLen(dataUrl, max = 600, quality = 0.8) {
  return new Promise(res => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = img.width * scale; c.height = img.height * scale
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      res(c.toDataURL('image/jpeg', quality))
    }
    img.src = dataUrl
  })
}

export const rnd = arr => arr[Math.floor(Math.random() * arr.length)]
export const randName = () => rnd(['匿名灰猫', '匿名夜鸦', '匿名游鱼', '匿名白鹿', '匿名雾隐', '匿名星尘', '匿名晚风', '匿名折纸', '匿名棱镜', '匿名孤岛'])
export function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

export const constellations = [
  ['白羊座', [3, 21], [4, 19]], ['金牛座', [4, 20], [5, 20]], ['双子座', [5, 21], [6, 21]],
  ['巨蟹座', [6, 22], [7, 22]], ['狮子座', [7, 23], [8, 22]], ['处女座', [8, 23], [9, 22]],
  ['天秤座', [9, 23], [10, 23]], ['天蝎座', [10, 24], [11, 22]], ['射手座', [11, 23], [12, 21]],
  ['摩羯座', [12, 22], [1, 19]], ['水瓶座', [1, 20], [2, 18]], ['双鱼座', [2, 19], [3, 20]]
]
export function getConstellation(m, d) {
  for (const [name, [m1, d1], [m2, d2]] of constellations) {
    if ((m === m1 && d >= d1) || (m === m2 && d <= d2)) return name
  }
  return '摩羯座'
}
export function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0 } return Math.abs(h) }

export const FURNITURE = [
  { id: 'bed', icon: '🛏️', name: '床' }, { id: 'sofa', icon: '🛋️', name: '沙发' }, { id: 'table', icon: '🪑', name: '桌椅' },
  { id: 'plant', icon: '🪴', name: '绿植' }, { id: 'lamp', icon: '💡', name: '台灯' }, { id: 'tv', icon: '📺', name: '电视' },
  { id: 'rug', icon: '🧶', name: '地毯' }, { id: 'book', icon: '📚', name: '书架' }, { id: 'fridge', icon: '🧊', name: '冰箱' },
  { id: 'piano', icon: '🎹', name: '钢琴' }, { id: 'cat', icon: '🐈', name: '猫窝' }, { id: 'window', icon: '🪟', name: '窗户' }
]
export const PET_TYPES = [
  { id: 'cat', icon: '🐱', name: '小猫' }, { id: 'rabbit', icon: '🐰', name: '兔子' }, { id: 'dog', icon: '🐶', name: '小狗' },
  { id: 'hamster', icon: '🐹', name: '仓鼠' }, { id: 'penguin', icon: '🐧', name: '企鹅' }, { id: 'fox', icon: '🦊', name: '狐狸' }
]
export const MAP_PLACES = [
  { id: 'home', name: '家', icon: '🏠', x: 30, y: 62 }, { id: 'cafe', name: '咖啡店', icon: '☕', x: 62, y: 28 },
  { id: 'store', name: '便利店', icon: '🏪', x: 15, y: 22 }, { id: 'plaza', name: '中央广场', icon: '⛲', x: 52, y: 58 }
]
