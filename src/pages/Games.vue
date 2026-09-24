<script setup>
import { S, closePage, showToast, uid, now } from '../core/store'
import { simpleAsk } from '../core/engine'
import { rnd } from '../core/util'
import { ref } from 'vue'

const game = ref(null) // null=菜单, 'td' 真心话大冒险, 'soup' 海龟汤, 'dice' 骰子
const truthQ = ref('')
const dareQ = ref('')
const spin = ref(false)
const curTurn = ref('')

const TD_TRUTH = ['最近一次心动是什么时候？', '说一个没告诉过任何人的小秘密', '最想和谁去旅行？', '手机里最舍不得删的照片是哪张？', '觉得自己身上最迷人的地方是？']
const TD_DARE = ['用土味情话夸我一句', '唱一句你正在听的歌', '模仿一种动物叫声', '说三件关于我的事', '发一条语音念这段话：今晚月色真美']

/* 海龟汤 */
const soup = ref(null)
const soupInput = ref('')
const soupLog = ref([])
const soupLoading = ref(false)
async function newSoup() {
  soupLoading.value = true
  soup.value = null
  soupLog.value = []
  try {
    const t = await simpleAsk('你是海龟汤主持人。生成一道海龟汤谜题，输出JSON：{"puzzle":"汤面(谜题描述,简短)","truth":"汤底(真相)"}。主题随机（悬疑/温情/脑洞）。汤面不要透露真相。', '出题', { maxTokens: 500 })
    soup.value = JSON.parse(t.match(/\{[\s\S]*\}/)[0])
    soupLog.value.push({ who: 'sys', text: `汤面：${soup.value.puzzle}\n\n猜猜真相吧！问我"是/否"问题，或直接猜答案。` })
  } catch (e) { showToast(e.message.slice(0, 40)) }
  soupLoading.value = false
}
async function askSoup() {
  const q = soupInput.value.trim()
  if (!q || soupLoading.value || !soup.value) return
  soupInput.value = ''
  soupLog.value.push({ who: 'user', text: q })
  soupLoading.value = true
  try {
    const t = await simpleAsk(`你是海龟汤主持人。\n汤面：${soup.value.puzzle}\n汤底：${soup.value.truth}\n玩家提问："${q}"\n若玩家答对了汤底核心，回复"🎉答对了！汤底是：..."；否则回答"是"/"否"/"无关"并附一句简短提示（20字内）。`, '玩家行动', { maxTokens: 200 })
    soupLog.value.push({ who: 'sys', text: t.trim() })
  } catch (e) { soupLog.value.push({ who: 'sys', text: '...' }) }
  soupLoading.value = false
}

/* AI 骰子 */
const dice = ref(null)
const diceLoading = ref(false)
async function rollDice(n = 1) {
  diceLoading.value = true
  const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * 6) + 1)
  dice.value = rolls
  try {
    const t = await simpleAsk(`你是命运解读者。骰子掷出了 ${rolls.join(', ')}（六面骰）。用一句话解读这次掷骰的运势（30字内，有趣一点）。`, '解读', { maxTokens: 60 })
    dice.value = rolls
    diceDesc.value = t?.trim() || ''
  } catch { diceDesc.value = '' }
  diceLoading.value = false
}
const diceDesc = ref('')

function spinTD() {
  spin.value = true
  curTurn.value = ''
  truthQ.value = ''
  dareQ.value = ''
  setTimeout(() => {
    spin.value = false
    curTurn.value = Math.random() < 0.5 ? 'truth' : 'dare'
    if (curTurn.value === 'truth') {
      truthQ.value = rnd(TD_TRUTH)
      simpleAsk(`你是真心话大冒险出题师。生成一道走心的真心话问题（中文，20字内），直接输出。`, '真心话', { maxTokens: 50 }).then(t => { if (t) truthQ.value = t.trim() }).catch(() => {})
    } else {
      dareQ.value = rnd(TD_DARE)
      simpleAsk(`你是真心话大冒险出题师。生成一个有趣无风险的大冒险任务（中文，20字内），直接输出。`, '大冒险', { maxTokens: 50 }).then(t => { if (t) dareQ.value = t.trim() }).catch(() => {})
    }
  }, 900)
}
function goBack() {
  if (game.value) game.value = null
  else closePage()
}
</script>

<template>
  <div class="page">
    <div class="topbar">
      <button class="tb-btn tb-back" @click="goBack">‹</button>
      <b>游戏中心</b>
    </div>
    <div class="body" style="padding:16px">
      <!-- 菜单 -->
      <template v-if="!game">
        <div class="card" style="cursor:pointer" @click="game = 'td'">
          <b>🎲 真心话大冒险</b>
          <div class="muted mt8">转盘随机决定真心话或大冒险，AI 生成题目</div>
        </div>
        <div class="card mt12" style="cursor:pointer" @click="game = 'soup'; newSoup()">
          <b>🍲 海龟汤</b>
          <div class="muted mt8">AI 主持：出汤面、答是否、揭晓汤底</div>
        </div>
        <div class="card mt12" style="cursor:pointer" @click="game = 'dice'; rollDice(2)">
          <b>🔮 AI 骰子</b>
          <div class="muted mt8">掷骰子 + AI 解读运势</div>
        </div>
      </template>

      <!-- 真心话大冒险 -->
      <template v-else-if="game === 'td'">
        <div class="td-wheel" :class="{ spinning: spin }">{{ spin ? '···' : curTurn === 'truth' ? '真心话' : curTurn === 'dare' ? '大冒险' : '转！' }}</div>
        <button class="btn-main mt16" @click="spinTD" :disabled="spin">{{ spin ? '转动中...' : '开始' }}</button>
        <div class="card mt16 center" v-if="truthQ && curTurn === 'truth'">
          <div class="f-lab">真心话</div>
          <div style="font-size:15px">{{ truthQ }}</div>
        </div>
        <div class="card mt16 center" v-if="dareQ && curTurn === 'dare'">
          <div class="f-lab">大冒险</div>
          <div style="font-size:15px">{{ dareQ }}</div>
        </div>
      </template>

      <!-- 海龟汤 -->
      <template v-else-if="game === 'soup'">
        <div v-if="soupLoading && !soup" class="empty">正在熬汤...</div>
        <div v-for="(l, i) in soupLog" :key="i" class="soup-line" :class="{ user: l.who === 'user' }">{{ l.text }}</div>
        <div class="row mt12">
          <input v-model="soupInput" placeholder="提问或直接猜答案..." class="grow" style="padding:9px;border-radius:18px" @keydown.enter="askSoup" />
          <button class="send-btn" @click="askSoup" :disabled="soupLoading">↑</button>
        </div>
        <div class="row mt8">
          <button class="btn-ghost grow" @click="newSoup" :disabled="soupLoading">换一锅汤</button>
          <button class="btn-ghost" @click="soup && soupLog.push({ who: 'sys', text: '汤底：' + soup.truth })">揭晓汤底</button>
        </div>
      </template>

      <!-- 骰子 -->
      <template v-else-if="game === 'dice'">
        <div class="dice-row">
          <div v-for="(d, i) in dice || []" :key="i" class="die">{{ '⚀⚁⚂⚃⚄⚅'[d - 1] }}</div>
        </div>
        <div class="center mt8" v-if="diceDesc">{{ diceDesc }}</div>
        <div class="row mt16" style="justify-content:center;gap:10px">
          <button class="btn-ghost" @click="rollDice(1)" :disabled="diceLoading">掷1颗</button>
          <button class="btn-ghost" @click="rollDice(2)" :disabled="diceLoading">掷2颗</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.td-wheel { width: 180px; height: 180px; margin: 30px auto 0; border-radius: 50%; border: 3px dashed var(--accent); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; }
.td-wheel.spinning { animation: wheelspin .3s linear infinite; }
@keyframes wheelspin { to { transform: rotate(360deg) } }
.soup-line { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; font-size: 13px; line-height: 1.7; margin-bottom: 10px; white-space: pre-wrap; }
.soup-line.user { background: var(--card2); margin-left: 20%; }
.dice-row { display: flex; justify-content: center; gap: 14px; margin-top: 40px; }
.die { font-size: 64px; line-height: 1; }
.send-btn { width: 36px; height: 36px; border-radius: 50%; background: var(--accent); color: var(--accent-text); }
</style>
