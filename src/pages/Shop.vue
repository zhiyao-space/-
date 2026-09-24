<script setup>
import { S, showToast, uid, now, wallet, gainCoins, payCoins } from '../core/store'
import { todayStr, relTime } from '../core/util'
import { ref, computed } from 'vue'

const tab = ref('shop')
const GOODS = [
  { id: 'rose', name: '玫瑰花束', icon: '🌹', price: 20, desc: '经典告白款' },
  { id: 'cake', name: '草莓蛋糕', icon: '🍰', price: 35, desc: '甜度刚好' },
  { id: 'plush', name: '兔子玩偶', icon: '🐰', price: 60, desc: '抱枕兼治愈' },
  { id: 'perfume', name: '冷杉香水', icon: '🧴', price: 88, desc: '干净木质调' },
  { id: 'ticket', name: '电影票两张', icon: '🎟', price: 50, desc: '周末走起' },
  { id: 'ring', name: '素圈戒指', icon: '💍', price: 199, desc: '重要时刻' },
  { id: 'skirt', name: '毛绒围巾', icon: '🧣', price: 45, desc: '冬日限定' },
  { id: 'game', name: '游戏机', icon: '🎮', price: 150, desc: '双人游戏' }
]
const sendFor = ref(null)

function sign() {
  const today = todayStr()
  if (S.user.lastSign === today) return showToast('今日已签到')
  const streak = (new Date(S.user.lastSign).toDateString() === new Date(Date.now() - 86400000).toDateString()) ? S.user.signStreak + 1 : 1
  S.user.signStreak = streak; S.user.lastSign = today
  const gain = 5 + Math.min(streak, 7) * 2
  gainCoins(gain, `商城签到（${streak}天）`)
  showToast(`签到 +${gain} 币`)
}
function buy(g) {
  if (!payCoins(g.price, `购买${g.name}`)) return showToast('余额不足，先签到')
  S.shop.owned[g.id] = (S.shop.owned[g.id] || 0) + 1
  showToast(`已购入 ${g.name}`)
}
function gift(g) {
  const names = S.chars.map((c, i) => `${i + 1}.${c.name}`).join(' ')
  if (!names) return showToast('还没有角色')
  const n = Number(prompt(`把「${g.name}」送给谁？\n${names}`))
  const c = S.chars[n - 1]
  if (!c) return
  S.shop.owned[g.id]--
  if (S.shop.owned[g.id] <= 0) delete S.shop.owned[g.id]
  gainCoins(0, `送给${c.name}：${g.name}`)
  showToast(`已把${g.name}送给${c.name}，TA很开心`)
  // 角色感谢
  import('../core/engine').then(async ({ simpleAsk }) => {
    try {
      const t = await simpleAsk(`你是${c.name}。用户送了你「${g.name}」（${g.desc}）。发一条微信消息感谢（口语化，符合人设）。直接输出。`, '收到礼物', { maxTokens: 100 })
      if (t) {
        const chat = S.chats[c.id] || (S.chats[c.id] = { msgs: [], unread: 0, pinned: false, special: false, attachedBooks: [] })
        chat.msgs.push({ id: uid(), time: now(), from: 'char', type: 'text', content: t.trim() })
        chat.unread++
      }
    } catch {}
  })
}
const ownedList = computed(() => GOODS.filter(g => S.shop.owned[g.id]))
const curW = computed(() => wallet())
</script>

<template>
  <div class="page">
    <div class="topbar">
      <button class="tb-btn tb-back" @click="closePage">‹</button>
      <b>商城</b>
      <span class="grow"></span>
      <span class="tag hot" style="cursor:pointer" @click="sign">{{ curW.coins }} 币 · 签到</span>
    </div>
    <div class="tabs">
      <div class="tab" :class="{ on: tab === 'shop' }" @click="tab = 'shop'">商城</div>
      <div class="tab" :class="{ on: tab === 'bag' }" @click="tab = 'bag'">背包({{ ownedList.length }})</div>
    </div>
    <div class="body" style="padding:12px">
      <template v-if="tab === 'shop'">
        <div class="goods-grid">
          <div v-for="g in GOODS" :key="g.id" class="goods">
            <div style="font-size:34px">{{ g.icon }}</div>
            <div style="font-size:13px;font-weight:600">{{ g.name }}</div>
            <div class="muted" style="font-size:10px">{{ g.desc }}</div>
            <div class="row mt8" style="justify-content:space-between">
              <span style="color:#f5a623;font-size:13px">{{ g.price }}币</span>
              <button class="btn-mini" @click="buy(g)">购买</button>
            </div>
          </div>
        </div>
        <div class="hint-txt">签到可赚虚拟币；买的东西可以送礼给角色，触发TA的感谢消息。</div>
      </template>
      <template v-else>
        <div v-if="!ownedList.length" class="empty">背包空空如也</div>
        <div v-for="g in ownedList" :key="g.id" class="cell" style="border-radius:10px;margin-bottom:6px">
          <div style="font-size:28px">{{ g.icon }}</div>
          <div class="ginfo">
            <div class="t1" style="font-size:14px">{{ g.name }} ×{{ S.shop.owned[g.id] }}</div>
            <div class="t2">{{ g.desc }}</div>
          </div>
          <button class="btn-mini" @click="gift(g)">送礼</button>
        </div>
      </template>
      <div style="height:80px"></div>
    </div>
  </div>
</template>

<style scoped>
.goods-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.goods { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 14px; text-align: center; }
</style>
