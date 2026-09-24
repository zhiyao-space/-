import { reactive, watch } from 'vue'
import { uid, now } from './util'

export { uid, now }

const KEY = 'aiphone_data_v1'
const THEME_KEY = 'aiphone_theme_v1'

function def() {
  return {
    ver: 1,
    chars: [], // {id,name,note,avatar,persona,greeting,books[],apiChatId,birthday,sign,relation,status,group,voice,devicePass,schedule,chatBg,emotion,avatarShape}
    chats: {}, // charId -> {msgs[],pinned,unread,special,attachedBooks[],stickerGroup}
    groups: [], // {id,name,intro,avatar,members[],admins[],banned{},msgs[],settings{injectN,maskId,followStatus,stickerGroup,bookIds,memberBind{}},unread}
    user: {
      nickname: '我', sign: '在这部小手机里', avatar: '',
      masks: [{ id: 'm0', name: '本我', desc: '默认身份', color: '#888' }],
      activeMask: 'm0',
      wallets: { m0: { coins: 200, logs: [] } },
      signStreak: 0, lastSign: ''
    },
    stickers: [{ id: 'sg0', name: '默认', desc: '常用表情', items: [] }],
    books: [],
    memories: [], // {id,charId,scope,type,text,tags[],time}
    moments: [],
    forum: { posts: [], dms: [] },
    treehole: [],
    pets: [],
    babies: [],
    couple: { days: [], tasks: [], qa: [{ q: '今天有什么小确幸？', a: '' }], anniv: [], points: 0 },
    house: { rooms: [{ id: 'r0', name: '我的房间', items: [] }], },
    redline: [],
    fanfics: [],
    music: { songs: [], listening: null },
    shop: { owned: {} },
    games: { soup: null },
    roleplays: [],
    dreams: [],
    snoops: [], // {id,charId,time,caught,dur,viewed[]}
    offline: { sessions: [] },
    notify: [],
    apiCfg: { chat: [], image: [], activeChat: '', activeImage: '', stt: { key: '', model: 'whisper-1' }, tts: { key: '', voice: 'alloy', speed: 1 } },
    settings: {
      proactive: false, proactiveMins: 30, timeAware: true, heart: true, emotion: true, crossMemory: false,
      injectN: 20, memSumN: 40, tokenLimit: 3000, inputPlaceholder: '说点什么...',
      memLink: { online_offline: false, online_roleplay: false, offline_roleplay: false },
      statusbarOpacity: 0.92, customText: ''
    },
    theme: {
      preset: 'bw',
      custom: { bg: '', card: '', text: '', sub: '', border: '', accent: '' },
      bubble: { style: 'round', avatarShape: 'circle', opacity: 100, chatBg: '', chatBgOpacity: 100, chatBgBlur: 0 },
      icon: { size: 'm', radius: 14 },
      bar: { height: 62, opacity: 92, glass: true, raise: 0 },
      anim: { page: 'fade', bubbleMsg: true, deco: true },
      desktopBg: '', desktopBgOpacity: 100, desktopBgBlur: 0,
      barStyle: 'glass', wallpaper: ''
    },
    fonts: { mode: 'sys', dataUrl: '', name: '', sizes: { title: 20, btn: 14, bubble: 15, sub: 12 } },
    beautify: { css: '', js: '', enabled: false, warned: false, schemes: [] },
    phone: {
      pages: [['chat', 'contacts', 'moments', 'mine', 'music', 'map', 'pet', 'shop'], ['worldbook', 'roleplay', 'dream', 'couple', 'house', 'redline', 'fanfic', 'forum'], ['snoop', 'offline', 'games', 'treehole', 'babytree', 'live']],
      widgets: [{ type: 'time', size: 'm' }, { type: 'memo', size: 's', text: '今天也要好好生活' }, { type: 'notify', size: 'm', charId: '' }, { type: 'weather', size: 's' }, { type: 'calendar', size: 's' }],
      icons: {}, fold: [], statusbar: { opacity: 0.92, text: '' }
    },
    meta: { created: now() }
  }
}

export const S = reactive(def())

let saveTimer = null
watch(S, () => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(persist, 400)
}, { deep: true })

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S))
  } catch (e) {
    console.warn('存储空间不足', e)
  }
}
export function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return
    const d = JSON.parse(raw)
    deepMerge(S, d)
  } catch (e) { console.warn('读取失败', e) }
}
function deepMerge(t, s) {
  for (const k in s) {
    if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) deepMerge(t[k], s[k])
    else t[k] = s[k]
  }
}
export function exportBackup() { return JSON.stringify(S) }
export function importBackup(text) {
  const d = JSON.parse(text)
  deepMerge(S, d)
  persist()
}

/* --- 常用操作 --- */
export function getChar(id) { return S.chars.find(c => c.id === id) }
export function getChat(id) {
  if (!S.chats[id]) S.chats[id] = { msgs: [], pinned: false, unread: 0, special: false, attachedBooks: [], draft: '' }
  return S.chats[id]
}
export function addMsg(charId, msg) {
  const c = getChat(charId)
  msg.id = uid(); msg.time = msg.time || now()
  c.msgs.push(msg)
  return msg
}
export function wallet() {
  const mid = S.user.activeMask
  if (!S.user.wallets[mid]) S.user.wallets[mid] = { coins: 200, logs: [] }
  return S.user.wallets[mid]
}
export function payCoins(amount, desc) {
  const w = wallet()
  if (w.coins < amount) return false
  w.coins -= amount
  w.logs.unshift({ t: now(), amount: -amount, desc })
  return true
}
export function gainCoins(amount, desc) {
  const w = wallet()
  w.coins += amount
  w.logs.unshift({ t: now(), amount, desc })
}
export function activeChatCfg() {
  return S.apiCfg.chat.find(c => c.id === S.apiCfg.activeChat) || S.apiCfg.chat[0] || null
}
export function activeImageCfg() {
  return S.apiCfg.image.find(c => c.id === S.apiCfg.activeImage) || S.apiCfg.image[0] || null
}

/* --- 通知 --- */
export function pushNotify(charId, text, type = 'msg') {
  S.notify.unshift({ id: uid(), charId, text, time: now(), type, read: false })
  if (S.notify.length > 30) S.notify.pop()
}

/* --- 主题 --- */
export const THEMES = {
  bw: { name: '黑白亚系', bg: '#000000', card: '#141414', card2: '#1e1e1e', text: '#ffffff', sub: '#999999', border: '#2a2a2a', accent: '#ffffff', accentText: '#000000', bubbleUser: '#2c5e4f', bubbleUserText: '#fff' },
  darkPurple: { name: '暗夜紫', bg: '#1A0A2E', card: '#251339', card2: '#331a4d', text: '#f0e6ff', sub: '#9d8ab5', border: '#3d2260', accent: '#c9a0ff', accentText: '#1A0A2E', bubbleUser: '#5c2a8a', bubbleUserText: '#fff' },
  coldBlue: { name: '冷蓝黑', bg: '#111827', card: '#1a2233', card2: '#243044', text: '#e5f4ff', sub: '#7a8ba3', border: '#2b3a52', accent: '#00D4FF', accentText: '#111827', bubbleUser: '#1a5a7a', bubbleUserText: '#fff' },
  bloodBlack: { name: '纯血黑', bg: '#050505', card: '#121212', card2: '#1c1c1c', text: '#e8e8e8', sub: '#888888', border: '#2a2a2a', accent: '#8B0000', accentText: '#ffffff', bubbleUser: '#5a0f0f', bubbleUserText: '#fff' },
  light: { name: '浅色治愈', bg: '#F5F5F5', card: '#ffffff', card2: '#eeeeee', text: '#222222', sub: '#999999', border: '#e0e0e0', accent: '#222222', accentText: '#ffffff', bubbleUser: '#2c5e4f', bubbleUserText: '#fff' }
}
export function applyTheme() {
  const r = document.documentElement.style
  const t = THEMES[S.theme.preset] || THEMES.bw
  const set = (k, v) => { if (v) r.setProperty(k, v) }
  const c = S.theme.custom
  set('--bg', c.bg || t.bg); set('--card', c.card || t.card); set('--card2', c.card2 || t.card2)
  set('--text', c.text || t.text); set('--sub', c.sub || t.sub); set('--border', c.border || t.border)
  set('--accent', c.accent || t.accent); set('--accent-text', c.accentText || t.accentText)
  set('--bubble-user', t.bubbleUser); set('--bubble-user-text', t.bubbleUserText)
  r.setProperty('--bubble-radius', S.theme.bubble.style === 'very' ? '22px' : S.theme.bubble.style === 'bar' ? '6px' : '14px')
  r.setProperty('--bubble-opacity', S.theme.bubble.opacity / 100)
  r.setProperty('--icon-radius', S.theme.icon.radius + 'px')
  r.setProperty('--bar-h', S.theme.bar.height + 'px')
  r.setProperty('--bar-opacity', S.theme.bar.opacity / 100)
  r.setProperty('--statusbar-opacity', S.phone.statusbar.opacity)
  // 字号
  const f = S.fonts.sizes
  r.setProperty('--font-title', f.title + 'px'); r.setProperty('--font-btn', f.btn + 'px')
  r.setProperty('--font-bubble', f.bubble + 'px'); r.setProperty('--font-sub', f.sub + 'px')
  // 字体
  const old = document.getElementById('custom-font')
  if (old) old.remove()
  if (S.fonts.mode === 'local' && S.fonts.dataUrl) {
    const st = document.createElement('style'); st.id = 'custom-font'
    st.textContent = `@font-face{font-family:'UserFont';src:url('${S.fonts.dataUrl}')} :root{--font-family:'UserFont',-apple-system,sans-serif}`
    document.head.appendChild(st)
  } else if (S.fonts.mode === 'url' && S.fonts.name) {
    const st = document.createElement('style'); st.id = 'custom-font'
    st.textContent = `@font-face{font-family:'UserFont';src:url('${S.fonts.name}')} :root{--font-family:'UserFont',-apple-system,sans-serif}`
    document.head.appendChild(st)
  }
  // 自定义美化代码
  const oldB = document.getElementById('beautify-css')
  if (oldB) oldB.remove()
  if (S.beautify.enabled && S.beautify.css) {
    const st = document.createElement('style'); st.id = 'beautify-css'
    st.textContent = S.beautify.css
    document.head.appendChild(st)
  }
}
export function applyBeautifyJS() {
  const old = document.getElementById('beautify-js')
  if (old) old.remove()
  if (S.beautify.enabled && S.beautify.js) {
    if (/eval\s*\(/.test(S.beautify.js)) { console.warn('JS含eval，已阻止'); return }
    const sc = document.createElement('script'); sc.id = 'beautify-js'
    sc.textContent = `(function(){ const fetch=undefined, XMLHttpRequest=undefined, WebSocket=undefined, eval=undefined; ${S.beautify.js} })()`
    document.head.appendChild(sc)
  }
}

/* --- toast --- */
export const toast = reactive({ show: false, text: '' })
let toastTimer
export function showToast(text) {
  toast.show = true; toast.text = text
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.show = false, 1800)
}

/* --- 全局路由（页面栈） --- */
export const nav = reactive({ stack: [], tab: 'phone' })
export function openPage(name, props = {}) {
  nav.stack.push({ name, props, key: uid() })
}
export function closePage() { nav.stack.pop() }
export function resetTo(name, props = {}) { nav.stack = [{ name, props, key: uid() }] }

/* --- 定时衰减（宠物/宝宝） --- */
const DECAY_MS = 6 * 3600 * 1000
export function decayPets() {
  for (const p of S.pets) {
    const passed = Math.floor((now() - p.lastDecay) / DECAY_MS)
    if (passed > 0) {
      p.food = Math.max(0, p.food - passed * 8)
      p.mood = Math.max(0, p.mood - passed * 6)
      p.close = Math.max(0, p.close - passed * 4)
      p.lastDecay = now()
    }
  }
}

load()
applyTheme()
decayPets()
