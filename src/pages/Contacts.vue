<script setup>
import { S, showToast, uid, now, openPage, nav } from '../core/store'
import { simpleAsk } from '../core/engine'
import { ref, computed } from 'vue'

const kw = ref('')
const tab = ref('全部')
const tabs = ['全部', '好友', 'NPC', '群聊']
const swipeId = ref(null)
const swipeX = ref(0)
let startX = 0
const multiMode = ref(false)
const selected = ref([])
const showNewFriend = ref(false)
const pending = ref([])
const aiOpen = ref(false)
const aiForm = ref({ pref: '', world: '', count: 3 })
const aiGening = ref(false)

const statusColor = s => ({ 在线: '#4cd964', 忙碌: '#f5a623', 离线: '#999' }[s] || '#999')
const list = computed(() => {
  let l = S.chars
  if (tab.value === '好友') l = l.filter(c => c.group !== 'NPC')
  if (tab.value === 'NPC') l = l.filter(c => c.group === 'NPC')
  if (kw.value) l = l.filter(c => c.name.includes(kw.value) || (c.note || '').includes(kw.value))
  return l
})
const groups = computed(() => [...new Set(S.chars.map(c => c.group || '好友'))])

function onTouchStart(e, id) { startX = e.touches ? e.touches[0].clientX : e.clientX; swipeId.value = id; swipeX.value = 0 }
function onTouchMove(e) {
  if (swipeId.value !== null) {
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - startX
    swipeX.value = Math.min(0, Math.max(-120, x))
  }
}
function onTouchEnd() {
  if (swipeX.value < -60) swipeX.value = -120; else swipeX.value = 0
  setTimeout(() => { if (swipeX.value === 0) swipeId.value = null }, 300)
}
function delChar(c) {
  if (confirm(`删除「${c.name}」？`)) {
    S.chars = S.chars.filter(x => x.id !== c.id)
    delete S.chats[c.id]
  }
}
function moveGroup(c) {
  const g = prompt('移动到分组（现有：' + groups.value.join('/') + '，或输入新名称）', c.group || '好友')
  if (g) c.group = g
}
function toggleSelect(id) {
  if (!multiMode.value) return
  const i = selected.value.indexOf(id)
  if (i > -1) selected.value.splice(i, 1); else selected.value.push(id)
}
function newGroup() {
  const name = prompt('新分组名称')
  if (name) { selected.value.forEach(id => { const c = S.chars.find(x => x.id === id); if (c) c.group = name }); showToast(`已创建分组「${name}」并移入${selected.value.length}人`); multiMode.value = false; selected.value = [] }
}
function renameGroup() {
  const old = prompt('要重命名的分组名', groups.value[0] || '')
  if (!old) return
  const nu = prompt('新名称', old)
  if (nu) { S.chars.forEach(c => { if ((c.group || '好友') === old) c.group = nu }); showToast('已重命名') }
}
function delGroup() {
  const g = prompt('要删除的分组名（成员移回好友）', groups.value[0] || '')
  if (!g) return
  S.chars.forEach(c => { if ((c.group || '好友') === g) c.group = '好友' })
  showToast('分组已删除')
}

async function aiGen() {
  if (!aiForm.value.pref.trim()) return showToast('先描述偏好')
  aiGening.value = true
  try {
    const raw = await simpleAsk(
      '你是角色生成器。只输出JSON数组：[{"name":"名字","note":"一句话备注","persona":"人设(150字内)","greeting":"开场白","relation":"关系"}]',
      `偏好：${aiForm.value.pref}\n世界观：${aiForm.value.world || '自由'}\n数量：${aiForm.value.count}`, { maxTokens: 1800 })
    const arr = JSON.parse(raw.match(/\[[\s\S]*\]/)[0])
    // 作为好友申请进入新朋友页面
    pending.value = arr
    aiOpen.value = false
    showNewFriend.value = true
    showToast('已生成，请在新朋友页确认')
  } catch (e) { showToast('生成失败: ' + e.message.slice(0, 50)) }
  aiGening.value = false
}
function acceptReq(r, yes) {
  if (yes) {
    const c = { id: uid(), name: r.name, note: r.note, avatar: '', persona: r.persona, greeting: r.greeting, books: [], birthday: '', relation: r.relation, sign: '', status: '在线', group: '好友', devicePass: String(Math.floor(100000 + Math.random() * 900000)), emotion: '', schedule: '', scheduleItems: [] }
    S.chars.push(c)
    if (r.greeting) S.chats[c.id] = { msgs: [{ id: uid(), time: now(), from: 'char', type: 'text', content: r.greeting }], pinned: false, unread: 1, special: false, attachedBooks: [] }
  }
  pending.value = pending.value.filter(x => x !== r)
}
</script>

<template>
  <div class="page">
    <div class="topbar" style="padding-right:6px">
      <div class="searchbar">
        <input v-model="kw" placeholder="搜索" />
      </div>
      <button class="tb-btn" style="font-size:20px" @click="aiOpen = true" title="AI生成角色">⚙</button>
      <button class="tb-btn" style="font-size:22px" @click="nav.tab = 'chat'">＋</button>
    </div>

    <div class="tabs">
      <div v-for="t in tabs" :key="t" class="tab" :class="{ on: tab === t }" @click="tab = t">{{ t }}</div>
    </div>

    <div class="body" @touchmove="onTouchMove" @touchend="onTouchEnd">
      <div class="cell" @click="showNewFriend = true">
        <div class="avatar" style="background:var(--accent);color:var(--accent-text)">👤</div>
        <div class="ginfo"><div class="t1">新朋友</div><div class="t2" v-if="pending.length">{{ pending.length }} 条待处理申请</div><div class="t2" v-else>暂无新申请</div></div>
        <span class="badge" v-if="pending.length">{{ pending.length }}</span>
      </div>

      <div class="hint-txt" v-if="groups.length > 1">分组：{{ groups.join(' / ') }}　<button class="btn-mini" @click="multiMode = !multiMode">{{ multiMode ? '退出多选' : '长按头像多选' }}</button></div>
      <div class="hint-txt" v-else><button class="btn-mini" @click="multiMode = !multiMode">{{ multiMode ? '退出多选' : '长按头像进入多选 → 创建分组' }}</button></div>

      <div v-for="c in list" :key="c.id" class="swipe-wrap">
        <div class="swipe-actions"><button class="sw-btn" @click="delChar(c)">删除</button><button class="sw-btn blue" @click="moveGroup(c)">分组</button></div>
        <div class="cell" :style="{ transform: `translateX(${swipeId === c.id ? swipeX : 0}px)`, transition: swipeId === c.id ? 'none' : 'transform .2s' }" @touchstart="onTouchStart($event, c.id)" @click="toggleSelect(c.id); if (!multiMode) openPage('Profile', { charId: c.id })">
          <div class="avatar" @long-press.prevent>
            <img v-if="c.avatar" :src="c.avatar" /><span v-else class="ph">{{ c.name[0] }}</span>
            <div v-if="multiMode" class="sel-dot" :class="{ on: selected.includes(c.id) }">✓</div>
          </div>
          <div class="ginfo">
            <div class="t1">{{ c.name }} <span class="tag" v-if="c.relation">{{ c.relation }}</span></div>
            <div class="t2">{{ c.note || c.sign || c.group || '好友' }}</div>
          </div>
          <div class="status-dot" :style="{ background: statusColor(c.status) }"></div>
        </div>
      </div>
      <div v-if="!list.length" class="empty">暂无角色，点击右上角 + 创建</div>

      <div v-if="multiMode && selected.length" class="multi-bar">
        <button class="btn-ghost grow" @click="newGroup">创建分组并移入</button>
        <button class="btn-ghost" @click="renameGroup">重命名</button>
        <button class="btn-ghost warn" @click="delGroup">删除分组</button>
      </div>
      <div style="height:100px"></div>
    </div>

    <!-- 新朋友 -->
    <div v-if="showNewFriend" class="mask" @click.self="showNewFriend = false">
      <div class="modal" style="height:70%">
        <div class="modal-t">新朋友</div>
        <div class="modal-b">
          <div v-if="!pending.length" class="empty">暂无好友申请</div>
          <div v-for="(r, i) in pending" :key="i" class="card">
            <div class="row"><b>{{ r.name }}</b><span class="tag">{{ r.relation }}</span></div>
            <div class="muted mt8">{{ r.note }}</div>
            <div style="font-size:12px;margin-top:6px;line-height:1.5">{{ r.persona }}</div>
            <div class="row mt12">
              <button class="btn-ghost grow" @click="acceptReq(r, false)">拒绝</button>
              <button class="btn-main grow" style="height:36px" @click="acceptReq(r, true)">接受</button>
            </div>
          </div>
        </div>
        <div class="modal-f"><button class="btn-ghost grow" @click="showNewFriend = false">关闭</button></div>
      </div>
    </div>

    <!-- AI 生成 -->
    <div v-if="aiOpen" class="mask" @click.self="aiOpen = false">
      <div class="modal">
        <div class="modal-t">AI 生成角色</div>
        <div class="f-lab">描述偏好</div>
        <textarea v-model="aiForm.pref" rows="2" placeholder="如：活泼话痨、喜欢音乐" style="margin-bottom:10px"></textarea>
        <div class="f-lab">绑定世界观</div>
        <input v-model="aiForm.world" placeholder="现代都市 / 玄幻..." style="margin-bottom:10px" />
        <div class="row" style="margin-bottom:10px">
          <span class="muted">数量</span>
          <div class="chips"><span v-for="n in [3, 4, 5]" :key="n" class="chip" :class="{ on: aiForm.count === n }" @click="aiForm.count = n">{{ n }}</span></div>
        </div>
        <button class="btn-main" @click="aiGen" :disabled="aiGening">{{ aiGening ? '生成中...' : '生成并以好友申请送达' }}</button>
        <div class="modal-f"><button class="btn-ghost grow" @click="aiOpen = false">关闭</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.swipe-wrap { position: relative; overflow: hidden; }
.swipe-actions { position: absolute; right: 0; top: 0; bottom: 0; display: flex; z-index: 0; }
.sw-btn { width: 60px; background: #e64340; color: #fff; font-size: 13px; }
.sw-btn.blue { background: #3a7afe; }
.status-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.sel-dot { position: absolute; right: -2px; top: -2px; width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid var(--sub); background: var(--card); font-size: 10px; display: flex; align-items: center; justify-content: center; color: transparent; }
.sel-dot.on { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
.multi-bar { position: fixed; bottom: 80px; left: 12px; right: 12px; display: flex; gap: 8px; z-index: 60; }
.warn { color: #ff6b6b; border-color: #ff6b6b44; }
</style>
