<script setup>
import { S, showToast, uid, now, gainCoins, payCoins } from '../core/store'
import { PET_TYPES, rnd } from '../core/util'
import { simpleAsk } from '../core/engine'
import { ref, computed, onMounted } from 'vue'

const showAdopt = ref(false)
const pickType = ref(PET_TYPES[0])
const petName = ref('')
const talk = ref('')
const cur = computed(() => S.pets[0] || null)
const decayed = ref(false)

onMounted(() => {
  // 静默衰减检查
  for (const p of S.pets) {
    const passed = Math.floor((now() - p.lastDecay) / 3600000)
    if (passed > 0) {
      p.food = Math.max(0, p.food - passed * 1.2)
      p.mood = Math.max(0, p.mood - passed * 1)
      p.close = Math.max(0, p.close - passed * 0.6)
      p.lastDecay = now()
      decayed.value = true
    }
  }
})

function adopt() {
  if (!petName.value.trim()) return showToast('给宠物起个名字')
  S.pets.push({ id: uid(), type: pickType.value.id, icon: pickType.value.icon, name: petName.value.trim(), food: 80, mood: 80, close: 20, level: 1, exp: 0, lastDecay: now(), coinsEarned: 0 })
  showAdopt.value = false
  petName.value = ''
  showToast('领养成功！记得照顾TA')
}
const stateLabel = v => v > 70 ? '很好' : v > 40 ? '一般' : v > 15 ? '低' : '急！'
const stateColor = v => v > 70 ? '#4cd964' : v > 40 ? '#f5a623' : '#ff6b6b'
const avg = computed(() => cur.value ? Math.round((cur.value.food + cur.value.mood + cur.value.close) / 3) : 0)

async function interact(kind) {
  const p = cur.value
  if (!p) return
  if (kind === 'feed') {
    if (!payCoins(2, `给${p.name}买粮`)) return showToast('币不够，先签到赚币吧')
    p.food = Math.min(100, p.food + 22)
    p.exp += 2
    talk.value = rnd([`${p.name}吃得津津有味~`, `${p.name}满足地舔了舔嘴。`, '碗被舔得干干净净！'])
  } else if (kind === 'play') {
    p.mood = Math.min(100, p.mood + 20)
    p.food = Math.max(0, p.food - 4)
    p.exp += 3
    talk.value = rnd([`${p.name}玩疯了，转了三圈！`, '追着毛球跑来跑去~', '开心到原地起跳！'])
  } else if (kind === 'pet') {
    p.mood = Math.min(100, p.mood + 10)
    p.close = Math.min(100, p.close + 8)
    p.exp += 2
    talk.value = rnd([`${p.name}眯起了眼睛。`, '轻轻蹭了蹭你的手心。', '喉咙里发出呼噜呼噜的声音。'])
  } else if (kind === 'company') {
    p.close = Math.min(100, p.close + 12)
    p.mood = Math.min(100, p.mood + 6)
    p.exp += 4
    const earned = 3 + Math.floor(Math.random() * 4)
    gainCoins(earned, `${p.name}陪伴赚币`)
    p.coinsEarned += earned
    talk.value = `安静地陪了你一会儿，${p.name}很满足。（+${earned}币）`
  }
  // 升级
  while (p.exp >= p.level * 20) {
    p.exp -= p.level * 20
    p.level++
    talk.value = `🎉 ${p.name}升到了 ${p.level} 级！`
    gainCoins(10, `${p.name}升级奖励`)
  }
  // AI 反应（状态高时偶尔说话）
  if (avg.value > 50 && Math.random() < 0.4) {
    simpleAsk(`你是用户的宠物${p.name}（${p.icon}）。刚被${{ feed: '喂食', play: '陪玩', pet: '抚摸', company: '陪伴' }[kind]}。用宠物口吻说一句可爱的话（15字内）。`, '说句话', { maxTokens: 40 })
      .then(t => { if (t) talk.value = t.trim().slice(0, 40) }).catch(() => {})
  }
}
</script>

<template>
  <div class="page">
    <div class="topbar">
      <button class="tb-btn tb-back" @click="closePage">‹</button>
      <b>养宠</b><span class="grow"></span>
      <button class="tb-btn" style="font-size:20px" @click="showAdopt = true" v-if="!cur">＋</button>
    </div>
    <div class="body" style="padding:16px">
      <template v-if="cur">
        <div class="card center pet-card">
          <div class="pet-icon" :style="{ animation: avg > 40 ? 'bounce 1.6s infinite' : 'none' }">{{ cur.icon }}</div>
          <div style="font-size:18px;font-weight:700">{{ cur.name }}</div>
          <div class="muted">Lv.{{ cur.level }} · 经验 {{ cur.exp }}/{{ cur.level * 20 }} · 累计赚币 {{ cur.coinsEarned }}</div>
          <div class="talk-bubble" v-if="talk">{{ talk }}</div>
        </div>

        <div class="card">
          <div v-for="s in [['food', '饱食', cur.food], ['mood', '心情', cur.mood], ['close', '亲密', cur.close]]" :key="s[0]" class="row" style="margin-bottom:10px">
            <span style="width:44px;font-size:13px">{{ s[1] }}</span>
            <div class="state-bar grow"><div :style="{ width: s[2] + '%', background: stateColor(s[2]) }"></div></div>
            <span class="muted" style="width:36px;text-align:right;font-size:11px">{{ Math.round(s[2]) }} {{ stateLabel(s[2]) }}</span>
          </div>
          <div class="muted" style="font-size:11px">三状态会随时间衰减，记得常来照顾</div>
        </div>

        <div class="act-grid">
          <div class="act-item" @click="interact('feed')">🍖<span>喂食(2币)</span></div>
          <div class="act-item" @click="interact('play')">🎾<span>玩耍</span></div>
          <div class="act-item" @click="interact('pet')">🤚<span>抚摸</span></div>
          <div class="act-item" @click="interact('company')">🪑<span>陪伴赚币</span></div>
        </div>
      </template>
      <div v-else class="empty">
        <div style="font-size:44px">🐾</div><br />还没有宠物
        <br /><br /><button class="btn-main" style="width:auto;padding:0 30px" @click="showAdopt = true">去领养</button>
      </div>
      <div style="height:100px"></div>
    </div>

    <div v-if="showAdopt" class="mask" @click.self="showAdopt = false">
      <div class="modal">
        <div class="modal-t">选择宠物</div>
        <div class="adopt-grid">
          <div v-for="t in PET_TYPES" :key="t.id" class="adopt-item" :class="{ on: pickType.id === t.id }" @click="pickType = t">
            <div style="font-size:32px">{{ t.icon }}</div><div style="font-size:12px">{{ t.name }}</div>
          </div>
        </div>
        <input v-model="petName" placeholder="给它起个名字" class="mt12" />
        <div class="modal-f"><button class="btn-main grow" @click="adopt">领养</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pet-card { padding: 24px; }
.pet-icon { font-size: 64px; line-height: 1; }
.talk-bubble { background: var(--card2); border-radius: 12px; padding: 8px 14px; font-size: 13px; margin-top: 12px; display: inline-block; }
.state-bar { height: 8px; background: var(--card2); border-radius: 4px; overflow: hidden; }
.state-bar div { height: 100%; border-radius: 4px; transition: width .3s; }
.act-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.act-item { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 12px 4px; text-align: center; cursor: pointer; font-size: 24px; }
.act-item span { display: block; font-size: 11px; margin-top: 4px; color: var(--text); }
.act-item:active { background: var(--card2); }
.adopt-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.adopt-item { border: 2px solid var(--border); border-radius: 12px; padding: 12px; text-align: center; cursor: pointer; }
.adopt-item.on { border-color: var(--accent); }
@keyframes bounce { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
</style>
