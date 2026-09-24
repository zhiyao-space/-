<script setup>
import { S, showToast, uid, now, gainCoins, payCoins } from '../core/store'
import { todayStr, relTime } from '../core/util'
import { simpleAsk } from '../core/engine'
import { ref, computed } from 'vue'

const props = defineProps({ charId: String })
const partner = ref(props.charId || S.chars[0]?.id || '')
const partnerChar = computed(() => S.chars.find(c => c.id === partner.value))
const newTask = ref('')
const newQ = ref('')
const newAnniv = ref({ date: '', text: '' })
const showAns = ref(null)
const ansText = ref('')

function checkin() {
  if (S.couple.days.includes(todayStr())) return showToast('今日已打卡')
  S.couple.days.push(todayStr())
  S.couple.points += 10
  gainCoins(10, '情侣空间打卡')
  showToast('打卡成功 +10积分 +10币')
}
function addTask() {
  if (!newTask.value.trim()) return
  S.couple.tasks.push({ id: uid(), text: newTask.value.trim(), done: false })
  newTask.value = ''
}
function toggleTask(t) {
  t.done = !t.done
  if (t.done) { S.couple.points += 5; gainCoins(5, '完成情侣任务') }
}
function addQ() {
  if (!newQ.value.trim()) return
  S.couple.qa.push({ q: newQ.value.trim(), a: '', charA: '' })
  newQ.value = ''
}
async function askChar(qa) {
  if (!partnerChar.value) return showToast('先选择伴侣角色')
  showAns.value = qa
  ansText.value = '思考中...'
  try {
    const t = await simpleAsk(`你是${partnerChar.value.name}。情侣问答环节。问题：「${qa.q}」。以你的口吻真诚回答（50字内）。`, '回答', { maxTokens: 120 })
    ansText.value = t.trim()
    qa.charA = ansText.value
  } catch (e) { ansText.value = '...' }
}
function addAnniv() {
  if (!newAnniv.value.date || !newAnniv.value.text) return showToast('补全日期与名称')
  S.couple.anniv.push({ id: uid(), ...newAnniv.value })
  newAnniv.value = { date: '', text: '' }
}
const days = computed(() => S.couple.days.length)
const nextAnniv = computed(() => {
  const nowT = Date.now()
  return S.couple.anniv.map(a => {
    const d = new Date(a.date); d.setFullYear(new Date().getFullYear())
    if (d.getTime() < nowT) d.setFullYear(new Date().getFullYear() + 1)
    return { ...a, left: Math.ceil((d.getTime() - nowT) / 86400000) }
  }).sort((x, y) => x.left - y.left)[0]
})
</script>

<template>
  <div class="page">
    <div class="topbar">
      <button class="tb-btn tb-back" @click="closePage">‹</button>
      <b>情侣空间</b><span class="grow"></span>
      <select v-model="partner" style="width:auto;padding:4px 8px;font-size:12px">
        <option v-for="c in S.chars" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </div>
    <div class="body" style="padding:14px">
      <div class="card couple-head">
        <div class="row" style="justify-content:center;gap:16px">
          <div class="avatar" style="width:52px;height:52px"><img v-if="S.user.avatar" :src="S.user.avatar" /><span v-else class="ph">{{ S.user.nickname[0] }}</span></div>
          <div style="font-size:26px">💞</div>
          <div class="avatar" style="width:52px;height:52px">
            <img v-if="partnerChar?.avatar" :src="partnerChar.avatar" /><span v-else class="ph">{{ partnerChar?.name?.[0] || '?' }}</span>
          </div>
        </div>
        <div class="center mt8" style="font-size:14px">{{ S.user.nickname }} × {{ partnerChar?.name || '未选择' }}</div>
        <div class="center muted">已共同打卡 {{ days }} 天 · 积分 {{ S.couple.points }}</div>
        <div class="center" v-if="nextAnniv"><span class="tag hot">距离「{{ nextAnniv.text }}」还有 {{ nextAnniv.left }} 天</span></div>
        <button class="btn-main mt12" @click="checkin">{{ S.couple.days.includes(todayStr()) ? '今日已打卡 ✓' : '每日打卡（+10积分）' }}</button>
      </div>

      <div class="card">
        <div class="f-lab">情侣任务清单</div>
        <div class="row" style="margin-bottom:8px"><input v-model="newTask" placeholder="添加任务，如：一起看日出" class="grow" style="padding:8px" @keydown.enter="addTask" /><button class="btn-mini" @click="addTask">＋</button></div>
        <label v-for="t in S.couple.tasks" :key="t.id" class="chk" :class="{ on: t.done }" @click.prevent="toggleTask(t)">
          <span class="box">{{ t.done ? '✓' : '' }}</span>
          <span class="grow" :style="t.done ? 'text-decoration:line-through;color:var(--sub)' : ''">{{ t.text }}</span>
          <span class="muted" style="font-size:10px">+5</span>
        </label>
        <div v-if="!S.couple.tasks.length" class="muted center" style="padding:8px">还没有任务</div>
      </div>

      <div class="card">
        <div class="f-lab">情侣问答</div>
        <div class="row" style="margin-bottom:8px"><input v-model="newQ" placeholder="自定义问题，如：最喜欢我哪一点" class="grow" style="padding:8px" @keydown.enter="addQ" /><button class="btn-mini" @click="addQ">＋</button></div>
        <div v-for="(qa, i) in S.couple.qa" :key="i" class="qa-item">
          <div class="row"><span style="font-size:13px">Q：{{ qa.q }}</span><span class="grow"></span><button class="btn-mini" @click="askChar(qa)">问TA</button></div>
          <div v-if="qa.charA" class="muted mt8" style="font-size:13px">{{ partnerChar?.name }}：{{ qa.charA }}</div>
        </div>
        <div v-if="!S.couple.qa.length" class="muted center" style="padding:8px">添加第一个问题吧</div>
      </div>

      <div class="card">
        <div class="f-lab">纪念日</div>
        <div class="row" style="margin-bottom:8px">
          <input v-model="newAnniv.date" type="date" style="width:40%" />
          <input v-model="newAnniv.text" placeholder="名称" class="grow" style="padding:8px" />
          <button class="btn-mini" @click="addAnniv">＋</button>
        </div>
        <div v-for="a in S.couple.anniv" :key="a.id" class="m-item" style="padding:8px 0">📅 {{ a.date }} · {{ a.text }}</div>
        <div v-if="!S.couple.anniv.length" class="muted center" style="padding:8px">记录属于你们的纪念日</div>
      </div>
      <div style="height:100px"></div>
    </div>
  </div>
</template>

<style scoped>
.couple-head { background: linear-gradient(135deg, rgba(255,107,157,.12), var(--card)); }
.qa-item { padding: 8px 0; border-bottom: 1px dashed var(--border); }
</style>
