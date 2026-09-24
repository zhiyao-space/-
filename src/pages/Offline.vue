<script setup>
import { S, closePage, showToast, uid, now, getChar, pushNotify } from '../core/store'
import { simpleAsk, chatCompletions, charBusy } from '../core/engine'
import { fmtTime } from '../core/util'
import { ref, computed } from 'vue'

const props = defineProps({ charId: String })
const selCharId = ref(props.charId || S.chars[0]?.id || '')
const char = computed(() => S.chars.find(c => c.id === selCharId.value))
const mode = ref('choose') // choose / short / long
const session = ref(null)
const input = ref('')
const loading = ref(false)
const showBooks = ref(false)

const novelBooks = ref([]) // 长线下绑定的世界书 id
const wordLimit = ref(800)
const novelStyle = ref('细腻日常')
const archive = ref('') // 存档

function startShort() {
  session.value = { id: uid(), charId: selCharId.value, type: 'short', msgs: [], startedAt: now(), arriveAt: Date.now() + 120000, onTheWay: true, met: false }
  mode.value = 'short'
  startJourney()
}
async function startJourney() {
  loading.value = true
  try {
    const t = await simpleAsk(`你是${char.value.name}。用户约你线下见面，你正在出发路上。先发一条位置共享消息+一条路上状态消息（可能堵车/赶路，口语化）。用两行输出：第一行[位置]地点，第二行要说的话。`, '出发！', { maxTokens: 200 })
    session.value.location = t.match(/\[位置\](.+)/)?.[1]?.trim() || '路上'
    session.value.msgs.push({ id: uid(), time: now(), from: 'char', type: 'text', content: (t.split('\n').pop() || '').trim() || '在路上啦' })
  } catch (e) { showToast(e.message.slice(0, 40)) }
  loading.value = false
  // 到达
  setTimeout(async () => {
    if (mode.value !== 'short') return
    session.value.onTheWay = false
    session.value.met = true
    try {
      const t = await simpleAsk(`你是${char.value.name}。你到达了见面地点，见到了用户。用一段动作描写+台词呈现见面场景（第二人称"你"叙述）。`, '见面场景', { maxTokens: 300 })
      session.value.msgs.push({ id: uid(), time: now(), from: 'char', type: 'scene', content: (t || 'TA到了。').trim() })
    } catch {}
  }, 8000)
}
async function send() {
  const text = input.value.trim()
  if (!text || loading.value) return
  input.value = ''
  if (mode.value === 'short') {
    session.value.msgs.push({ id: uid(), time: now(), from: 'user', type: 'text', content: text })
    loading.value = true
    try {
      const hist = session.value.msgs.slice(-8).map(m => `${m.from === 'user' ? '用户' : '角色'}: ${m.content}`).join('\n')
      const t = await simpleAsk(`你是${char.value.name}。线下见面进行中。结合现场与对话继续互动（动作+台词，第二人称叙述用户所见）。回复要短（100字内）。\n${hist}`, '继续', { maxTokens: 300 })
      session.value.msgs.push({ id: uid(), time: now(), from: 'char', type: 'text', content: (t || '...').trim() })
    } catch (e) { showToast(e.message.slice(0, 40)) }
    loading.value = false
  } else {
    await continueNovel(text)
  }
}
function startLong() {
  session.value = { id: uid(), charId: selCharId.value, type: 'long', msgs: [], startedAt: now(), story: '' }
  mode.value = 'long'
}
async function continueNovel(userInput) {
  loading.value = true
  try {
    const promptParts = [
      `你是一部长篇小说的执笔。主角（用户）与「${char.value.name}」的线下故事。文风：${novelStyle.value}。字数上限：${wordLimit.value}字以内。小说排版（分段、留白、氛围描写），结尾留下钩子。`,
      char.value.persona ? `角色设定：${char.value.persona.slice(0, 400)}` : ''
    ]
    if (novelBooks.value.length) {
      const books = S.books.filter(b => novelBooks.value.includes(b.id))
      promptParts.push('世界观参考：' + books.flatMap(b => b.entries.filter(e => e.trigger !== 'off').map(e => e.content)).join('\n').slice(0, 1500))
    }
    if (archive.value) promptParts.push('【前情存档】\n' + archive.value)
    const hist = session.value.msgs.slice(-4).map(m => (m.from === 'user' ? '用户输入：' : '前文：') + m.content).join('\n\n')
    const t = await chatCompletions([
      { role: 'system', content: promptParts.filter(Boolean).join('\n\n') },
      { role: 'user', content: (hist ? hist + '\n\n' : '') + (userInput ? `用户输入：${userInput}` : '开始第一章') }
    ], { maxTokens: Math.min(2000, wordLimit.value * 2) })
    session.value.msgs.push({ id: uid(), time: now(), from: 'char', type: 'novel', content: t.trim() })
    archive.value = t.trim().slice(-600)
  } catch (e) { showToast(e.message.slice(0, 40)) }
  loading.value = false
}
function backOnline() {
  // 离开久了角色反应
  const mins = Math.round((now() - session.value.startedAt) / 60000)
  if (mins >= 1) {
    simpleAsk(`你是${char.value.name}。用户线下离开后回到线上聊天，已经过去了约${mins}分钟没理你。根据人设做反应（质问/撒娇/担心），发一条微信。直接输出。`, '用户回来了', { maxTokens: 120 })
      .then(t => {
        const c = getChar(session.value.charId)
        if (c && t) {
          const chat = S.chats[c.id] || (S.chats[c.id] = { msgs: [], unread: 0, pinned: false, special: false, attachedBooks: [] })
          chat.msgs.push({ id: uid(), time: now(), from: 'char', type: 'text', content: t.trim() })
          chat.unread++
          pushNotify(c.id, t.trim().slice(0, 30))
        }
      }).catch(() => {})
  }
  session.value = null
  mode.value = 'choose'
  closePage()
  showToast('已回到线上模式')
}
</script>

<template>
  <div class="page">
    <div class="topbar">
      <button class="tb-btn tb-back" @click="mode === 'choose' ? closePage() : backOnline()">‹</button>
      <b>{{ mode === 'choose' ? '线下模式' : mode === 'short' ? '短线下 · 见面' : '长叙事 · 小说模式' }}</b>
    </div>

    <div class="body" style="padding:16px">
      <!-- 选择模式 -->
      <template v-if="mode === 'choose'">
        <div class="card" style="cursor:pointer" @click="startShort">
          <b>🚶 短线下（见面场景）</b>
          <div class="muted mt8">直接触发见面，角色发起位置共享，真实移动时间，到达后进入动作描写。</div>
        </div>
        <div class="card" style="cursor:pointer" @click="startLong">
          <b>📖 长线下（长叙事模式）</b>
          <div class="muted mt8">小说排版风格，AI按文风自动生成剧情，可设字数上限、绑定世界书、存档续写、随时退回线上聊天。</div>
        </div>
        <div class="f-lab mt12">选择角色</div>
        <select v-model="selCharId">
          <option v-for="c in S.chars" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <div class="hint-txt">时间感知联动：线下离开久了，回到线上时角色会有反应（质问/撒娇/担心）。</div>
      </template>

      <!-- 短线下 -->
      <template v-else-if="mode === 'short'">
        <div class="card">
          <div class="row">
            <span style="font-size:22px">{{ session.onTheWay ? '🛵' : '🤝' }}</span>
            <div class="grow">
              <b>{{ session.onTheWay ? (session.location || '在路上') : '见面中 · ' + (session.location || '约定地点') }}</b>
              <div class="muted" style="font-size:11px">{{ session.onTheWay ? 'TA正在赶来…' : '已到达' }}</div>
            </div>
          </div>
        </div>
        <div v-for="m in session.msgs" :key="m.id" class="msg-block" :class="{ user: m.from === 'user' }">
          <div v-if="m.type === 'scene'" class="scene-box">{{ m.content }}</div>
          <div v-else class="msg-line"><span class="muted" style="font-size:10px">{{ m.from === 'user' ? '你' : char.name }} · {{ fmtTime(m.time) }}</span><div style="font-size:14px;line-height:1.7;margin-top:2px">{{ m.content }}</div></div>
        </div>
        <div v-if="loading" class="muted center mt8">TA正在回应...</div>
      </template>

      <!-- 长叙事 -->
      <template v-else>
        <div class="card">
          <div class="row" style="margin-bottom:8px">
            <div class="grow"><div class="f-lab">文风</div>
              <select v-model="novelStyle"><option>细腻日常</option><option>都市轻小说</option><option>悬疑</option><option>古风</option><option>意识流</option></select>
            </div>
            <div class="grow"><div class="f-lab">字数上限 {{ wordLimit }}</div>
              <input type="range" min="300" max="2000" step="100" v-model.number="wordLimit" />
            </div>
          </div>
          <div class="f-lab">绑定世界书（长线下独立）</div>
          <div class="chips" style="margin-bottom:10px">
            <span v-for="b in S.books" :key="b.id" class="chip" :class="{ on: novelBooks.includes(b.id) }" @click="novelBooks.includes(b.id) ? novelBooks.splice(novelBooks.indexOf(b.id), 1) : novelBooks.push(b.id)">{{ b.name }}</span>
          </div>
          <div class="row">
            <button class="btn-ghost grow" @click="continueNovel('')">开始第一章</button>
            <button class="btn-ghost grow" @click="archive && continueNovel('')">存档续写</button>
          </div>
        </div>
        <div v-for="m in session.msgs" :key="m.id" class="novel-block">
          <div class="muted" style="font-size:10px;margin-bottom:6px">{{ fmtTime(m.time) }} {{ m.from === 'user' ? '· 你的输入' : '' }}</div>
          <div v-if="m.from === 'user'" class="muted" style="font-size:13px">＞ {{ m.content }}</div>
          <div v-else class="novel-text">{{ m.content }}</div>
        </div>
        <div v-if="loading" class="center muted mt8">执笔中...</div>
      </template>

      <div style="height:80px"></div>
    </div>

    <div v-if="mode !== 'choose'" class="input-bar">
      <input v-model="input" :placeholder="mode === 'short' ? '和TA面对面说点什么...' : '输入剧情走向...'" @keydown.enter="send" class="grow" style="border-radius:20px" />
      <button class="send-btn" @click="send">↑</button>
      <button class="btn-mini" @click="backOnline">回线上</button>
    </div>
  </div>
</template>

<style scoped>
.msg-block { margin-bottom: 14px; }
.msg-block.user { text-align: right; }
.scene-box { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 14px; font-size: 14px; line-height: 1.8; white-space: pre-wrap; }
.novel-block { margin-bottom: 20px; }
.novel-text { font-size: 15px; line-height: 2; white-space: pre-wrap; text-indent: 2em; }
.input-bar { display: flex; gap: 8px; padding: 10px 14px; background: var(--card); border-top: 1px solid var(--border); align-items: center; flex-shrink: 0; }
.send-btn { width: 36px; height: 36px; border-radius: 50%; background: var(--accent); color: var(--accent-text); flex-shrink: 0; }
</style>
