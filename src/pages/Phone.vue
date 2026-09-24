<script setup>
import { S, nav, openPage, showToast, getChat, getChar } from '../core/store'
import { ref, computed } from 'vue'

const APPS = {
  chat: { name: '聊天', svg: 'M4 5h16v11H8l-4 4z', tab: true },
  contacts: { name: '通讯录', svg: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5 9c0-3 2.5-5 5-5s5 2 5 5M16 4h5M16 8h5M16 12h5' },
  moments: { name: '动态', svg: 'M12 3l2.5 5.5L20 9l-4 4 1 6-5-2.7L7 19l1-6-4-4 5.5-.5z' },
  mine: { name: '我的', svg: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8c0-3.5 3-6 7-6s7 2.5 7 6' },
  music: { name: '音乐', svg: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zm10-2a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z' },
  map: { name: '地图', svg: 'M9 4L4 6v14l5-2 6 2 5-2V4l-5 2zM9 4v14M15 6v14' },
  pet: { name: '养宠', svg: 'M8 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM4.5 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm15 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM12 21c-3 0-5-2-5-5 0-2.5 2-6 5-6s5 3.5 5 6c0 3-2 5-5 5z' },
  shop: { name: '商城', svg: 'M5 8h14l-1 12H6zM8 8a4 4 0 0 1 8 0' },
  worldbook: { name: '世界书', svg: 'M5 4h13a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5zM8 4v16M11 9h5M11 12h5', tab: true },
  roleplay: { name: '角色扮演', svg: 'M4 8l8-4 8 4-8 4zM4 8v8l8 4 8-4V8M12 12v8' },
  dream: { name: '入梦', svg: 'M20 13A8 8 0 1 1 11 4a6.5 6.5 0 0 0 9 9z' },
  couple: { name: '情侣空间', svg: 'M12 20l-7-7a4 4 0 0 1 5.5-5.8L12 8.5l1.5-1.3A4 4 0 0 1 19 13z' },
  house: { name: '家园', svg: 'M4 11l8-7 8 7M6 10v10h12V10M10 20v-6h4v6' },
  redline: { name: '红线', svg: 'M7 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm10 15a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8.5 8.5l7 9' },
  fanfic: { name: '同人文', svg: 'M6 3h9l4 4v14H6zM9 11h7M9 15h7M9 7h3' },
  forum: { name: '论坛', svg: 'M4 5h16v10H9l-5 4zM8 9h8M8 12h5' },
  snoop: { name: '查手机', svg: 'M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 3h2M11 17h2' },
  offline: { name: '线下', svg: 'M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10zm0-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
  games: { name: '游戏', svg: 'M7 12h4M9 10v4M15 11h.01M17 13h.01M7 6h10a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-4a4 4 0 0 1 4-4z' },
  treehole: { name: '树洞', svg: 'M12 21v-8m0 0c-4 0-6-3-6-6 3 0 6 2 6 6zm0 0c4 0 6-3 6-6-3 0-6 2-6 6zM5 21h14' },
  babytree: { name: '宝宝树', svg: 'M12 21v-9m0 0c-3 0-5-2.5-5-5 2.5 0 5 1.5 5 5zm0 0c3 0 5-2.5 5-5-2.5 0-5 1.5-5 5zM4 21h16' },
  live: { name: '直播', svg: 'M12 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7.5 7.5a6.5 6.5 0 0 0 0 9M16.5 7.5a6.5 6.5 0 0 1 0 9M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14' }
}
const LAUNCH = { contacts: 'Contacts', moments: 'Moments', mine: 'Mine', music: 'Music', map: 'MapApp', pet: 'Pet', shop: 'Shop', roleplay: 'Roleplay', dream: 'Dream', couple: 'Couple', house: 'House', redline: 'RedLine', fanfic: 'Fanfic', forum: 'Forum', snoop: 'Snoop', offline: 'Offline', games: 'Games', treehole: 'Treehole', babytree: 'BabyTree', live: 'Live' }

const weather = ref({ w: '晴', t: 22, hi: 25, lo: 16, city: '星海市' })
const editing = ref(false)
const showFold = ref(false)
const page = ref(0)

function launch(id) {
  if (editing.value) return
  const app = APPS[id]
  if (!app) return
  if (app.tab) { nav.tab = id; return }
  openPage(LAUNCH[id])
}
function onDragStart(e, i) { e.dataTransfer.setData('text/plain', String(i)) }
function onDrop(e) {
  const src = Number(e.dataTransfer.getData('text/plain'))
  if (isNaN(src)) return
  const grid = e.currentTarget
  const rect = grid.getBoundingClientRect()
  const col = Math.min(3, Math.max(0, Math.floor((e.clientX - rect.left) / (rect.width / 4))))
  const row = Math.max(0, Math.floor((e.clientY - rect.top) / 96))
  const target = row * 4 + col
  const flat = S.phone.pages[page.value]
  if (target >= flat.length || target === src) return
  const [item] = flat.splice(src, 1)
  flat.splice(Math.min(target, flat.length), 0, item)
}
function addWidget() {
  const type = prompt('添加小组件类型: time / weather / calendar / memo / notify / gu')
  if (!type) return
  const size = prompt('尺寸: s(1格) / m(2格) / l(大2x2)', 'm') || 'm'
  const w = { type, size }
  if (type === 'memo') w.text = '今天也要好好生活'
  S.phone.widgets.push(w)
}
function moveToFold() {
  const id = prompt('输入要收纳的APP ID:\n' + Object.keys(APPS).filter(k => !APPS[k].tab).join(' '))
  if (!id || !APPS[id]) return
  for (const pg of S.phone.pages) {
    const i = pg.indexOf(id)
    if (i > -1) { pg.splice(i, 1); break }
  }
  S.phone.fold.push(id)
}
function editWidgetOrder(w, dir) {
  const arr = S.phone.widgets
  const i = arr.indexOf(w)
  const j = i + dir
  if (j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}

const unreadTotal = computed(() => {
  let n = 0
  for (const k in S.chats) n += S.chats[k].unread || 0
  for (const g of S.groups) n += g.unread || 0
  return n
})
const wSize = s => ({ s: 'calc(25% - 6px)', m: 'calc(50% - 6px)', l: 'calc(50% - 6px)' }[s] || 'calc(25% - 6px)')
const wHeight = s => ({ s: 78, m: 78, l: 168 }[s] || 78)
const memoW = computed(() => S.phone.widgets.find(w => w.type === 'memo'))
const notifyW = computed(() => S.phone.widgets.find(w => w.type === 'notify'))
const notifyChar = computed(() => notifyW.value?.charId ? getChar(notifyW.value.charId) : null)
const lastMsg = computed(() => {
  const cid = notifyW.value?.charId
  if (!cid) return null
  const msgs = getChat(cid).msgs
  return msgs[msgs.length - 1] || null
})
</script>

<template>
  <div class="desktop">
    <div class="desk-bg" :style="S.theme.desktopBg ? { backgroundImage: `url(${S.theme.desktopBg})`, opacity: S.theme.desktopBgOpacity / 100, filter: `blur(${S.theme.desktopBgBlur}px)` } : { background: 'var(--bg)' }"></div>

    <div class="widgets">
      <div v-for="(w, wi) in S.phone.widgets" :key="wi" class="widget"
        :style="{ width: wSize(w.size), height: wHeight(w.size) + 'px' }" :class="{ wiggle: editing }">
        <template v-if="w.type === 'time'">
          <div class="w-time">{{ new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0') }}</div>
          <div class="muted" style="margin-top:4px">{{ new Date().getMonth() + 1 }}月{{ new Date().getDate() }}日 · {{ weather.w }} {{ weather.t }}°</div>
        </template>
        <template v-else-if="w.type === 'weather'">
          <div style="font-size:26px;font-weight:700">{{ weather.t }}°</div>
          <div class="muted">{{ weather.city }} {{ weather.w }}</div>
          <div class="muted" style="margin-top:2px">{{ weather.hi }}° / {{ weather.lo }}°</div>
        </template>
        <template v-else-if="w.type === 'calendar'">
          <div class="muted">{{ new Date().getMonth() + 1 }}月</div>
          <div style="font-size:28px;font-weight:700;line-height:1.1">{{ new Date().getDate() }}</div>
          <div class="muted">周{{ '日一二三四五六'[new Date().getDay()] }}</div>
        </template>
        <template v-else-if="w.type === 'memo'">
          <div class="w-head">备忘录</div>
          <div style="font-size:12px;line-height:1.5" class="grow">{{ w.text }}</div>
          <button v-if="editing" class="btn-mini" @click="w.text = prompt('编辑备忘录', w.text) || w.text">编辑</button>
        </template>
        <template v-else-if="w.type === 'notify'">
          <div class="w-head">新消息</div>
          <template v-if="notifyChar">
            <div style="font-size:13px;font-weight:600">{{ notifyChar.name }}</div>
            <div class="line1 muted" style="font-size:11px">{{ lastMsg?.content || '暂无新消息' }}</div>
          </template>
          <div v-else class="muted" style="font-size:11px" @click="w.charId = prompt('输入角色ID绑定') || w.charId">点击绑定角色</div>
        </template>
        <template v-else-if="w.type === 'gu'">
          <img v-if="w.img" :src="w.img" style="width:100%;height:100%;object-fit:cover;border-radius:10px" />
          <div v-else class="muted" style="font-size:11px">图片展示位</div>
        </template>
        <div v-if="editing" class="w-tools">
          <span @click="editWidgetOrder(w, -1)">◀</span>
          <span @click="editWidgetOrder(w, 1)">▶</span>
          <span @click="S.phone.widgets.splice(wi, 1)">✕</span>
        </div>
      </div>
      <div v-if="editing" class="widget w-add" @click="addWidget">
        <span style="font-size:24px">＋</span><span class="muted" style="font-size:10px">添加</span>
      </div>
    </div>

    <div class="pages-wrap">
      <div class="pages-scroll">
        <div v-for="(pg, pi) in S.phone.pages" :key="pi" class="icon-page">
          <div class="icon-grid" @dragover.prevent @drop="onDrop">
            <div v-for="(appId, i) in pg" :key="appId" class="icon-item"
              :class="{ wiggle: editing }" :draggable="editing"
              @dragstart="onDragStart($event, i)" @click="launch(appId)">
              <div class="icon-box" :style="{ borderRadius: S.theme.icon.radius + 'px' }">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path :d="APPS[appId]?.svg || ''" /></svg>
                <span v-if="appId === 'chat' && unreadTotal" class="badge ibadge">{{ unreadTotal }}</span>
              </div>
              <div class="icon-label">{{ APPS[appId]?.name || appId }}</div>
            </div>
            <div v-if="S.phone.fold.length" class="icon-item" @click="showFold = true">
              <div class="icon-box fold-box" :style="{ borderRadius: S.theme.icon.radius + 'px' }">▦</div>
              <div class="icon-label">收纳夹</div>
            </div>
          </div>
        </div>
      </div>
      <div class="page-dots">
        <span v-for="(pg, pi) in S.phone.pages" :key="pi" :class="{ on: pi === page }" @click="page = pi"></span>
      </div>
      <div class="edit-bar">
        <button class="btn-mini" :class="{ warn: editing }" @click="editing = !editing">{{ editing ? '完成' : '编辑桌面' }}</button>
      </div>
    </div>

    <div v-if="showFold" class="mask" @click.self="showFold = false">
      <div class="modal" style="height:60%">
        <div class="modal-t">收纳夹</div>
        <div class="modal-b">
          <div v-for="a in S.phone.fold" :key="a" class="m-item" @click="launch(a); showFold = false">
            <div class="icon-box" style="width:36px;height:36px;border-radius:8px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path :d="APPS[a]?.svg" /></svg></div>
            {{ APPS[a]?.name }}
          </div>
          <div v-if="!S.phone.fold.length" class="empty">暂无收纳的APP</div>
        </div>
        <div class="modal-f"><button class="btn-ghost grow" @click="moveToFold">将APP移入收纳夹</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.desktop { position: absolute; inset: 0; overflow: hidden; }
.desk-bg { position: absolute; inset: -20px; background-size: cover; background-position: center; z-index: 0; }
.widgets { position: relative; z-index: 1; display: flex; flex-wrap: wrap; gap: 12px; padding: 12px 14px 6px; }
.widget { background: rgba(20,20,20,.65); backdrop-filter: blur(12px); border: 1px solid var(--border); border-radius: 16px; padding: 10px; display: flex; flex-direction: column; overflow: hidden; position: relative; }
.w-time { font-size: 30px; font-weight: 700; line-height: 1; }
.w-head { font-size: 10px; color: var(--sub); margin-bottom: 4px; }
.w-tools { position: absolute; top: 2px; right: 4px; display: flex; gap: 6px; font-size: 12px; cursor: pointer; z-index: 2; }
.w-add { align-items: center; justify-content: center; cursor: pointer; border-style: dashed; color: var(--sub); }
.pages-wrap { position: absolute; top: 200px; bottom: 30px; left: 0; right: 0; z-index: 1; display: flex; flex-direction: column; }
.pages-scroll { flex: 1; display: flex; overflow-x: auto; scroll-snap-type: x mandatory; }
.icon-page { flex-shrink: 0; width: 100%; scroll-snap-align: center; }
.icon-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px 6px; padding: 14px 18px; }
.icon-item { display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; position: relative; }
.icon-box { width: 58px; height: 58px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); display: flex; align-items: center; justify-content: center; position: relative; }
.icon-box svg { width: 30px; height: 30px; color: var(--text); }
.fold-box { font-size: 24px; color: var(--text); }
.ibadge { position: absolute; top: -5px; right: -5px; }
.icon-label { font-size: 11px; color: var(--text); text-shadow: 0 1px 3px rgba(0,0,0,.8); }
.page-dots { display: flex; justify-content: center; gap: 6px; padding: 8px 0; }
.page-dots span { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.25); cursor: pointer; }
.page-dots span.on { background: var(--text); }
.edit-bar { display: flex; justify-content: center; padding: 4px 0 10px; }
.wiggle { animation: wiggle .3s infinite alternate; }
@keyframes wiggle { from { transform: rotate(-1.2deg) } to { transform: rotate(1.2deg) } }
</style>
