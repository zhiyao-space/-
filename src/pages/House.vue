<script setup>
import { S, showToast, uid, now, closePage } from '../core/store'
import { FURNITURE } from '../core/util'
import { simpleAsk } from '../core/engine'
import { ref, computed } from 'vue'

const GRID = 8
const curRoom = ref(S.house.rooms[0])
const showFurn = ref(false)
const placing = ref(null)
const showInvite = ref(false)
const inviteCharId = ref('')
const chatMsg = ref('')

const occupied = computed(() => {
  const set = new Set()
  curRoom.value.items.forEach(it => set.add(it.x + ',' + it.y))
  return set
})
function pickFurn(f) { placing.value = f; showFurn.value = false }
function placeAt(x, y) {
  if (!placing.value) return
  if (occupied.value.has(x + ',' + y)) return showToast('这里已有家具')
  curRoom.value.items.push({ id: uid(), fid: placing.value.id, icon: placing.value.icon, x, y })
  showToast(`已放置${placing.value.name}`)
  placing.value = null
}
function removeAt(x, y) {
  const i = curRoom.value.items.findIndex(it => it.x === x && it.y === y)
  if (i > -1) curRoom.value.items.splice(i, 1)
}
function renameRoom() {
  const n = prompt('房间名称', curRoom.value.name)
  if (n) curRoom.value.name = n
}
function addRoom() {
  const n = prompt('新房间名称')
  if (n) { const r = { id: uid(), name: n, items: [] }; S.house.rooms.push(r); curRoom.value = r }
}
async function invite() {
  const c = S.chars.find(x => x.id === inviteCharId.value)
  if (!c) return showToast('选择要邀请的角色')
  showInvite.value = false
  showToast(`已邀请 ${c.name} 来做客`)
  try {
    const furn = curRoom.value.items.slice(0, 6).map(f => FURNITURE.find(x => x.id === f.fid)?.name).filter(Boolean).join('、')
    const t = await simpleAsk(`你是${c.name}。你受邀参观了用户的房间「${curRoom.value.name}」，里面有：${furn || '简单的家当'}。发一条微信消息评价房间（口语化，符合人设）。直接输出。`, '参观房间', { maxTokens: 120 })
    if (t) {
      const chat = S.chats[c.id] || (S.chats[c.id] = { msgs: [], unread: 0, pinned: false, special: false, attachedBooks: [] })
      chat.msgs.push({ id: uid(), time: now(), from: 'char', type: 'text', content: t.trim() })
      chat.unread++
      chatMsg.value = t.trim()
    }
  } catch {}
}
</script>

<template>
  <div class="page">
    <div class="topbar">
      <button class="tb-btn tb-back" @click="closePage">‹</button>
      <b>{{ curRoom.name }}</b>
      <span class="grow"></span>
      <button class="tb-btn" style="font-size:14px" @click="renameRoom">改名</button>
      <button class="tb-btn" style="font-size:14px" @click="addRoom">＋房</button>
    </div>
    <div class="body" style="padding:14px">
      <div class="house-grid">
        <div v-for="y in GRID" :key="'r' + y" class="grid-row">
          <div v-for="x in GRID" :key="x" class="grid-cell" :class="{ placeable: placing }" @click="placeAt(x - 1, y - 1)" @contextmenu.prevent="removeAt(x - 1, y - 1)">
            <span v-for="it in curRoom.items.filter(i => i.x === x - 1 && i.y === y - 1)" :key="it.id" class="furn">{{ it.icon }}</span>
          </div>
        </div>
      </div>
      <div class="muted center" style="font-size:11px;margin:8px 0">点击格子放置选中家具 · 右键长按移除</div>
      <div class="row" style="gap:8px">
        <button class="btn-main grow" style="height:40px" @click="showFurn = true">{{ placing ? '已选：' + placing.name + '（点击格子放置）' : '🛋 家具库' }}</button>
        <button class="btn-ghost" @click="showInvite = true">邀请做客</button>
      </div>
      <div class="card mt12" v-if="chatMsg">
        <div class="f-lab">来自客人的消息</div>
        <div style="font-size:13px">{{ chatMsg }}</div>
      </div>
    </div>

    <div v-if="showFurn" class="sheet-mask" @click.self="showFurn = false">
      <div class="sheet">
        <div class="sheet-t">选择家具（后续可扩展为房间互动）</div>
        <div class="furn-grid">
          <div v-for="f in FURNITURE" :key="f.id" class="furn-item" @click="pickFurn(f)">
            <div style="font-size:26px">{{ f.icon }}</div><div style="font-size:11px">{{ f.name }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showInvite" class="mask" @click.self="showInvite = false">
      <div class="modal">
        <div class="modal-t">邀请角色做客（触发聊天）</div>
        <div class="m-item" v-for="c in S.chars" :key="c.id" @click="inviteCharId = c.id; invite()">
          <div class="avatar" style="width:32px;height:32px"><img v-if="c.avatar" :src="c.avatar" /><span v-else class="ph">{{ c.name[0] }}</span></div>
          {{ c.name }}
        </div>
        <div v-if="!S.chars.length" class="empty">先创建角色</div>
        <div class="modal-f"><button class="btn-ghost grow" @click="showInvite = false">取消</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.house-grid { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 8px; }
.grid-row { display: flex; }
.grid-cell { flex: 1; aspect-ratio: 1; border: 1px dashed rgba(128,128,128,.15); display: flex; align-items: center; justify-content: center; font-size: 20px; cursor: pointer; }
.grid-cell.placeable { background: rgba(120,200,120,.06); }
.furn { pointer-events: none; }
.furn-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.furn-item { background: var(--card2); border-radius: 12px; padding: 10px; text-align: center; cursor: pointer; }
</style>
