<script setup>
import { S, showToast, uid, now, closePage } from '../core/store'
import { genSchedule, currentScheduleSlot, charBusy, simpleAsk, addMemory } from '../core/engine'
import { MAP_PLACES, timeInfo } from '../core/util'
import { ref, computed, onMounted } from 'vue'

const props = defineProps({ charId: String })
const char = computed(() => S.chars.find(c => c.id === props.charId) || S.chars[0])
const selCharId = ref(props.charId || (S.chars[0]?.id || ''))
const cur = computed(() => S.chars.find(c => c.id === selCharId.value))
const mapSize = { w: 340, h: 420 }
const moving = ref(false)
const eta = ref('')
const history = ref([])
const showAdd = ref(false)
const addForm = ref({ name: '', icon: '📍', x: 50, y: 50 })

const places = computed(() => {
  const custom = (cur.value?.customPlaces || []).map(p => ({ ...p, custom: true }))
  return [...MAP_PLACES, ...custom]
})
function placeByName(name) { return places.value.find(p => name.includes(p.name) || p.name.includes(name || '###')) }
const slot = computed(() => cur.value ? currentScheduleSlot(cur.value) : null)
const targetPlace = computed(() => placeByName(slot.value?.place || '') || MAP_PLACES[0])
const pos = computed(() => ({ x: targetPlace.value.x, y: targetPlace.value.y }))

onMounted(async () => {
  if (cur.value && !cur.value.scheduleItems?.length) {
    genSchedule(cur.value.id).catch(() => {})
  }
})

function posStyle(x, y) {
  return { left: (x / 100 * mapSize.w - 14) + 'px', top: (y / 100 * mapSize.h - 14) + 'px' }
}
async function moveCharTo(p) {
  if (!cur.value || moving.value) return
  const dist = Math.hypot(p.x - pos.value.x, p.y - pos.value.y)
  const mins = Math.max(1, Math.round(dist / 8))
  eta.value = `预计 ${mins} 分钟后到达 ${p.name}`
  moving.value = true
  cur.value.movingTo = { x: p.x, y: p.y }
  const from = targetPlace.value.name
  // 移动反馈（AI）
  simpleAsk(`你是${cur.value.name}。你正从${from}前往${p.name}，路上大约${mins}分钟。发一条微信消息汇报路上情况（可能堵车/赶路/散步，符合人设时间感）。直接输出。`, '在路上', { maxTokens: 100 })
    .then(t => { if (t && S.chats[cur.value.id]) addMsgTo(cur.value.id, t.trim()) }).catch(() => {})
  // 动画移动
  const startX = pos.value.x, startY = pos.value.y
  const steps = 30
  for (let i = 1; i <= steps; i++) {
    await new Promise(r => setTimeout(r, 40))
    cur.value.animPos = { x: startX + (p.x - startX) * i / steps, y: startY + (p.y - startY) * i / steps }
  }
  cur.value.animPos = null
  cur.value.customPlaces = cur.value.customPlaces || []
  history.value.unshift({ name: p.name, time: now() })
  moving.value = false
  showToast(`${cur.value.name} 到达了 ${p.name}`)
  addMemory(cur.value.id, 'online', 'world', `刚刚去了${p.name}`, ['行程'])
}
function addMsgTo(charId, text) {
  const chat = S.chats[charId] || (S.chats[charId] = { msgs: [], unread: 0, pinned: false, special: false, attachedBooks: [] })
  chat.msgs.push({ id: uid(), time: now(), from: 'char', type: 'text', content: text })
  chat.unread++
}
function addPlace() {
  if (!addForm.value.name.trim()) return showToast('填写地点名')
  cur.value.customPlaces = cur.value.customPlaces || []
  cur.value.customPlaces.push({ ...addForm.value, id: uid() })
  showAdd.value = false
  addForm.value = { name: '', icon: '📍', x: 50, y: 50 }
  showToast('已添加地点')
}
const ti = timeInfo()
</script>

<template>
  <div class="page" v-if="cur">
    <div class="topbar">
      <button class="tb-btn tb-back" @click="closePage">‹</button>
      <div class="grow"><b>{{ cur.name }} 的位置</b><div class="muted" style="font-size:10px">{{ ti.date }} {{ ti.week }} {{ ti.clock }} · {{ slot ? slot.act : '当前无行程，点刷新生成' }}</div></div>
      <button class="tb-btn" style="font-size:20px" @click="genSchedule(cur.id).then(() => showToast('已生成今日行程')).catch(e => showToast(e.message.slice(0, 30)))">⟳</button>
    </div>

    <div class="body" style="padding:12px">
      <div class="map-canvas" :style="{ width: mapSize.w + 'px', height: mapSize.h + 'px' }">
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect width="100" height="100" fill="#181a1f" />
          <path d="M0 30 H100 M0 62 H100 M22 0 V100 M55 0 V100 M80 0 V100" stroke="#262a33" stroke-width="2.5" />
          <path d="M0 45 C30 40 60 52 100 44" stroke="#22262e" stroke-width="1.5" fill="none" />
          <rect x="24" y="32" width="14" height="10" fill="#1f232c" /><rect x="58" y="64" width="12" height="12" fill="#1f232c" /><rect x="6" y="8" width="10" height="14" fill="#1f232c" />
        </svg>
        <!-- 地点 -->
        <div v-for="p in places" :key="p.id || p.name" class="map-place" :style="posStyle(p.x, p.y)" @click="moveCharTo(p)">
          <div class="mp-icon">{{ p.icon }}</div>
          <div class="mp-name">{{ p.name }}</div>
        </div>
        <!-- 角色定位 -->
        <div class="map-char" :class="{ moving }" :style="posStyle(cur.animPos?.x ?? pos.x, cur.animPos?.y ?? pos.y)">
          <div class="mc-pulse"></div>
          <div class="avatar" style="width:28px;height:28px;border:2px solid var(--accent)">
            <img v-if="cur.avatar" :src="cur.avatar" /><span v-else class="ph" style="font-size:12px">{{ cur.name[0] }}</span>
          </div>
        </div>
      </div>

      <div v-if="eta" class="hint-txt">🧭 {{ eta }}</div>

      <div class="card">
        <div class="f-lab">当日行程（点击地点让TA移动）</div>
        <div v-for="(it, i) in cur.scheduleItems || []" :key="i" class="m-item" style="padding:7px 0">
          <span class="tag">{{ it.start }}-{{ it.end }}</span>
          <span class="grow" style="font-size:13px">{{ it.act }}</span>
          <span class="tag" v-if="it.busy">忙</span>
          <span class="muted" style="font-size:10px">{{ it.place }}</span>
        </div>
        <div v-if="!cur.scheduleItems?.length" class="muted center" style="padding:10px">点右上角 ⟳ 生成今日行程</div>
      </div>

      <div class="card" v-if="history.length">
        <div class="f-lab">最近到访</div>
        <div v-for="(h, i) in history" :key="i" class="m-item" style="padding:7px 0">📍 {{ h.name }} <span class="muted grow" style="text-align:right">刚刚</span></div>
      </div>

      <div class="row mt8">
        <select v-model="selCharId" class="grow">
          <option v-for="c in S.chars" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <button class="btn-ghost" @click="showAdd = true">＋ 自定义地点</button>
      </div>
    </div>

    <div v-if="showAdd" class="mask" @click.self="showAdd = false">
      <div class="modal">
        <div class="modal-t">添加自定义地点</div>
        <div class="f-lab">名称</div><input v-model="addForm.name" style="margin-bottom:8px" />
        <div class="f-lab">图标（emoji）</div><input v-model="addForm.icon" style="margin-bottom:8px" />
        <div class="row"><button class="btn-ghost grow" @click="showAdd = false">取消</button><button class="btn-main grow" style="height:36px" @click="addPlace">添加</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-canvas { position: relative; border-radius: 16px; overflow: hidden; border: 1px solid var(--border); margin: 0 auto; max-width: 100%; }
.map-place { position: absolute; text-align: center; cursor: pointer; z-index: 2; }
.mp-icon { width: 28px; height: 28px; background: var(--card); border: 1px solid var(--border); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; margin: 0 auto; }
.mp-name { font-size: 9px; color: var(--sub); margin-top: 2px; }
.map-char { position: absolute; z-index: 3; }
.map-char.moving { transition: all .04s linear; }
.mc-pulse { position: absolute; inset: -8px; border-radius: 50%; background: rgba(90,200,250,.25); animation: pulse 1.5s infinite; }
@keyframes pulse { 0% { transform: scale(.6); opacity: 1 } 100% { transform: scale(1.6); opacity: 0 } }
</style>
