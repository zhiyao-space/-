<script setup>
import { S, getChar, getChat, closePage, openPage, showToast, uid, now, wallet, payCoins } from '../core/store'
import { fmtTime, pickFile, readAsDataURL, compressImage, rnd, relTime } from '../core/util'
import { charReply, getMemories, addMemory, summarizeChat, simpleAsk, charBusy, currentScheduleSlot } from '../core/engine'
import { sttTranscribe, playUrl, ttsSpeak } from '../core/api'
import { ref, computed, nextTick, onMounted } from 'vue'

const props = defineProps({ charId: String })
const char = computed(() => getChar(props.charId))
const chat = computed(() => getChat(props.charId))
const input = ref('')
const sending = ref(false)
const bodyRef = ref(null)
const showPlus = ref(false)
const showMore = ref(false)
const msgMenu = ref(null)
const quote = ref(null)
const showStickers = ref(false)
const showLoc = ref(false)
const showMem = ref(false)
const showBooks = ref(false)
const heartOpen = ref(S.settings.heart)
const replyTarget = ref(null) // 群聊用

const places = [
  { name: '家', icon: '🏠' }, { name: '咖啡店', icon: '☕' }, { name: '便利店', icon: '🏪' },
  { name: '中央广场', icon: '⛲' }, { name: '公司', icon: '🏢' }, { name: '电影院', icon: '🎬' }
]
const PLUS_ITEMS = [
  { k: 'voice', icon: '🎙', label: '语音' }, { k: 'sticker', icon: '😊', label: '表情包' },
  { k: 'image', icon: '🖼', label: '图片' }, { k: 'loc', icon: '📍', label: '定位' },
  { k: 'video', icon: '📹', label: '视频通话' }, { k: 'red', icon: '🧧', label: '红包' }
]

function scrollBottom() { nextTick(() => { if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight }) }
onMounted(scrollBottom)

async function send() {
  const text = input.value.trim()
  if (!text || sending.value) return
  input.value = ''
  addMsg(props.charId, { from: 'user', type: 'text', content: text, quote: quote.value ? quote.value.id : undefined, quoteText: quote.value?.content })
  quote.value = null
  scrollBottom()
  sending.value = true
  try {
    if (charBusy(char.value)) await new Promise(r => setTimeout(r, 3000 + Math.random() * 4000))
    await charReply(props.charId)
  } catch (e) {
    addMsg(props.charId, { from: 'sys', type: 'sys', content: '⚠ ' + e.message })
  }
  sending.value = false
  scrollBottom()
}

/* 录音 */
const recording = ref(false)
let mediaRec = null, chunks = [], recStart = 0
async function startRec() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRec = new MediaRecorder(stream)
    chunks = []
    mediaRec.ondataavailable = e => chunks.push(e.data)
    mediaRec.onstop = onRecStop
    mediaRec.start()
    recStart = Date.now()
    recording.value = true
  } catch { showToast('无法访问麦克风，已改为文字输入模式') }
}
async function stopRec() {
  recording.value = false
  if (mediaRec) { mediaRec.stop(); mediaRec.stream.getTracks().forEach(t => t.stop()) }
}
async function onRecStop() {
  const dur = Math.max(1, Math.round((Date.now() - recStart) / 1000))
  const blob = new Blob(chunks, { type: 'audio/webm' })
  let text = ''
  try { text = await sttTranscribe(blob) } catch { showToast('语音识别失败，请检查STT配置') }
  if (!text) { showToast('未识别到内容'); return }
  const audioUrl = URL.createObjectURL(blob)
  addMsg(props.charId, { from: 'user', type: 'voice', content: text, dur, audio: audioUrl })
  sending.value = true
  try { await charReply(props.charId) } catch (e) { addMsg(props.charId, { from: 'sys', type: 'sys', content: '⚠ ' + e.message }) }
  sending.value = false
  scrollBottom()
}

async function sendImage() {
  const f = await pickFile('image/*')
  if (!f) return
  const url = await compressImageLen(await readAsDataURL(f), 500, 0.75)
  addMsg(props.charId, { from: 'user', type: 'image', url, content: '[图片]' })
  showPlus.value = false
  sending.value = true
  try { await charReply(props.charId) } catch (e) { addMsg(props.charId, { from: 'sys', type: 'sys', content: '⚠ ' + e.message }) }
  sending.value = false
  scrollBottom()
}
function sendLoc(p) {
  addMsg(props.charId, { from: 'user', type: 'location', content: `${p.icon} ${p.name}`, loc: p.name })
  showLoc.value = false; showPlus.value = false
  sendTextSilent(`[分享了位置: ${p.name}]`)
}
async function sendTextSilent(text) {
  addMsg(props.charId, { from: 'user', type: 'text', content: text })
  sending.value = true
  try { await charReply(props.charId) } catch (e) { addMsg(props.charId, { from: 'sys', type: 'sys', content: '⚠ ' + e.message }) }
  sending.value = false
  scrollBottom()
}
function sendSticker(s) {
  addMsg(props.charId, { from: 'user', type: 'sticker', content: s.name || '表情', url: s.url })
  showStickers.value = false; showPlus.value = false
  sending.value = true
  try { charReply(props.charId).finally(() => { sending.value = false; scrollBottom() }) } catch (e) { sending.value = false }
}
async function videoCall() {
  showPlus.value = false
  const dur = Math.floor(20 + Math.random() * 120)
  const txt = await simpleAsk(`你是${char.value.name}。用户刚和你视频通话了${Math.floor(dur / 60)}分${dur % 60}秒。用一两句话发微信说点什么（符合人设，口语化）。直接输出内容。`, '通话刚挂断', { maxTokens: 100 })
  addMsg(props.charId, { from: 'sys', type: 'sys', content: `📹 视频通话 ${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}` })
  if (txt) addMsg(props.charId, { from: 'char', type: 'text', content: txt.trim() })
  scrollBottom()
}
function sendRedPacket() {
  const amt = Number(prompt('红包金额（虚拟币）', '10'))
  if (!amt || amt <= 0) return
  if (!payCoins(amt, `发给${char.value.name}的红包`)) return showToast('余额不足')
  addMsg(props.charId, { from: 'user', type: 'redpacket', content: amt })
  showPlus.value = false
  sendTextSilent('[发了一个红包]')
}
async function playVoice(m) {
  m.playing = true
  if (m.audio) { const a = playUrl(m.audio); a.onended = () => m.playing = false; setTimeout(() => m.playing = false, m.dur * 1000 || 3000) }
  else { await new Promise(r => setTimeout(r, (m.dur || 2) * 500)); m.playing = false }
}

/* 消息操作 */
let pressT = null
function mPress(m) { pressT = setTimeout(() => msgMenu.value = m.id, 500) }
function mLeave() { if (pressT) clearTimeout(pressT) }
const menuMsg = computed(() => chat.value.msgs.find(m => m.id === msgMenu.value))
function doRecall() {
  const m = menuMsg.value
  if (m) { m.recalled = true; m.content = '' }
  msgMenu.value = null
}
async function doCopy() {
  try { await navigator.clipboard.writeText(menuMsg.value?.content || '') ; showToast('已复制') } catch { showToast('复制失败') }
  msgMenu.value = null
}
function doQuote() { quote.value = menuMsg.value; msgMenu.value = null }
function doFav() {
  const m = menuMsg.value
  if (m) S.user.favs = S.user.favs || []
  S.user.favs.push({ id: uid(), text: m.content, from: m.from === 'user' ? '我' : char.value.name, img: m.url || '', time: now() })
  showToast('已收藏，可在动态页查看')
  msgMenu.value = null
}

/* 世界书挂接 */
function toggleBook(bid) {
  const arr = chat.value.attachedBooks
  const i = arr.indexOf(bid)
  if (i > -1) arr.splice(i, 1); else arr.push(bid)
}

/* 记忆管理 */
const memText = ref(''); const memTags = ref(''); const memScope = ref('world')
function addManualMem() {
  if (!memText.value.trim()) return
  addMemory(props.charId, 'online', memScope.value, memText.value.trim(), memTags.value.split(/[,，\s]+/).filter(Boolean))
  memText.value = ''; memTags.value = ''
  showToast('已添加记忆')
}
async function doSummary() {
  showToast('总结中...')
  try { const n = await summarizeChat(props.charId, 'online', chat.value.msgs.slice(-S.settings.memSumN)); showToast(`已总结${n}条记忆`) } catch (e) { showToast(e.message.slice(0, 50)) }
}
async function setChatBg() {
  const f = await pickFile('image/*')
  if (f) chat.value.bg = await compressImageLen(await readAsDataURL(f), 700, 0.7)
}
const busyNow = computed(() => charBusy(char.value))
const curSlot = computed(() => currentScheduleSlot(char.value))

function openProfile() { openPage('Profile', { charId: props.charId }) }
</script>

<template>
  <div class="page" v-if="char">
    <div class="topbar">
      <button class="tb-btn tb-back" @click="closePage">‹</button>
      <div class="avatar" style="width:34px;height:34px" @click="openProfile">
        <img v-if="char.avatar" :src="char.avatar" /><span v-else class="ph">{{ char.name[0] }}</span>
      </div>
      <div class="grow" style="min-width:0">
        <div class="line1" style="font-weight:600;font-size:16px">{{ char.name }} <span class="tag" v-if="S.settings.emotion && char.emotion">{{ char.emotion }}</span></div>
        <div class="muted" v-if="busyNow && curSlot" style="font-size:10px">忙：{{ curSlot.act }}</div>
      </div>
      <button class="tb-btn" @click="showMore = true">
        <svg class="icon24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.5a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/></svg>
      </button>
    </div>

    <!-- 消息区 -->
    <div class="body chat-body" ref="bodyRef" :style="chat.bg ? { backgroundImage: `url(${chat.bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}">
      <div v-for="m in chat.msgs" :key="m.id" class="msg-row" :class="{ mine: m.from === 'user', sys: m.from === 'sys' }">
        <!-- 系统 -->
        <div v-if="m.from === 'sys'" class="sys-line">{{ m.content }}</div>
        <template v-else>
          <div class="avatar msg-av" v-if="m.from === 'char'">
            <img v-if="char.avatar" :src="char.avatar" /><span v-else class="ph">{{ char.name[0] }}</span>
          </div>
          <div class="msg-col" @pointerdown="mPress(m)" @pointerup="mLeave" @pointerleave="mLeave" @contextmenu.prevent="msgMenu = m.id">
            <!-- 引用 -->
            <div v-if="m.quoteText" class="quote-box">引用：{{ m.quoteText.slice(0, 40) }}</div>
            <!-- 文本 -->
            <div v-if="m.type === 'text'" class="bubble" :class="'b-' + S.theme.bubble.style">
              <span class="b-txt">{{ m.content }}</span>
              <span class="b-time">{{ fmtTime(m.time) }}</span>
            </div>
            <!-- 心声 -->
            <div v-if="m.heart && heartOpen" class="heart-line">💭 {{ m.heart }}</div>
            <!-- 语音 -->
            <div v-else-if="m.type === 'voice'" class="bubble voice-b" @click="playVoice(m)">
              <span class="v-play">{{ m.playing ? '❚❚' : '▶' }}</span>
              <span class="wave" :class="{ playing: m.playing }"><i v-for="i in 7" :key="i"></i></span>
              <span style="font-size:11px;opacity:.6">{{ m.dur }}"</span>
            </div>
            <div v-if="m.type === 'voice' && heartOpen && m.content" class="voice-text">{{ m.content }}</div>
            <!-- 图片 -->
            <div v-else-if="m.type === 'image'" class="img-wrap">
              <img v-if="m.url && !m.loading" :src="m.url" @click="window" style="max-width:170px;border-radius:10px;display:block" />
              <div v-else class="bubble loading-b"><span class="loading-dots" style="font-size:12px">{{ m.failed ? m.content : '生成中' }}</span></div>
            </div>
            <!-- 表情 -->
            <div v-else-if="m.type === 'sticker'" class="sticker-wrap">
              <img v-if="m.url" :src="m.url" style="max-width:120px" />
              <div v-else class="bubble">😺 {{ m.content }}</div>
            </div>
            <!-- 位置 -->
            <div v-else-if="m.type === 'location'" class="bubble loc-b">
              <div style="font-weight:600">{{ m.content }}</div>
              <div class="muted" style="font-size:10px">位置</div>
            </div>
            <!-- 红包 -->
            <div v-else-if="m.type === 'redpacket'" class="bubble red-b">🧧 红包 {{ m.content }} 币</div>
            <div v-if="m.recalled" class="bubble" style="opacity:.4;font-style:italic">消息已撤回</div>
          </div>
          <div class="avatar msg-av" v-if="m.from === 'user'" style="background:var(--card2)">
            <img v-if="S.user.avatar" :src="S.user.avatar" /><span v-else class="ph">{{ S.user.nickname[0] }}</span>
          </div>
        </template>
      </div>
      <div v-if="sending" class="msg-row">
        <div class="avatar msg-av"><img v-if="char.avatar" :src="char.avatar" /><span v-else class="ph">{{ char.name[0] }}</span></div>
        <div class="bubble loading-b"><span class="loading-dots"></span></div>
      </div>
      <div style="height:20px"></div>
    </div>

    <!-- 引用提示 -->
    <div v-if="quote" class="quote-bar">
      引用：{{ quote.content.slice(0, 30) }}
      <span class="grow"></span>
      <button class="btn-mini" @click="quote = null">✕</button>
    </div>

    <!-- 输入区 -->
    <div class="input-bar">
      <button class="tb-btn" @click="showPlus = !showPlus; showStickers = false" style="font-size:24px">＋</button>
      <textarea v-model="input" rows="1" class="chat-input" :placeholder="S.settings.inputPlaceholder" @keydown.enter.exact.prevent="send"></textarea>
      <button v-if="input.trim()" class="send-btn" @click="send">↑</button>
      <button v-else class="send-btn dim" @click="showStickers = !showStickers; showPlus = false">😊</button>
    </div>

    <!-- 表情面板 -->
    <div v-if="showStickers" class="sticker-panel">
      <div v-for="g in S.stickers" :key="g.id">
        <div class="muted" style="padding:6px 12px 2px;font-size:10px">{{ g.name }} · {{ g.desc }}</div>
        <div class="sticker-grid">
          <div v-for="s in g.items" :key="s.id" class="sticker-item" @click="sendSticker(s)">
            <img v-if="s.url" :src="s.url" /><span v-else>{{ s.emoji || '🙂' }}</span>
          </div>
        </div>
      </div>
      <div v-if="!S.stickers.some(g => g.items.length)" class="empty" style="padding:20px">表情包为空，去「我的」页添加</div>
    </div>

    <!-- + 功能面板 -->
    <div v-if="showPlus" class="plus-panel">
      <div v-for="it in PLUS_ITEMS" :key="it.k" class="plus-item" @click="it.k === 'voice' ? (recording ? stopRec() : startRec()) : it.k === 'sticker' ? (showStickers = true, showPlus = false) : it.k === 'image' ? sendImage() : it.k === 'loc' ? (showLoc = true, showPlus = false) : it.k === 'video' ? videoCall() : it.k === 'red' ? sendRedPacket() : null">
        <div class="pi-icon">{{ it.icon }}</div>
        <div style="font-size:11px">{{ it.label }}</div>
      </div>
      <div v-if="recording" class="grow center" style="color:#ff6b6b;font-size:13px">● 录音中... 点击语音按钮结束</div>
    </div>

    <!-- 位置选择 -->
    <div v-if="showLoc" class="sheet-mask" @click.self="showLoc = false">
      <div class="sheet"><div class="sheet-t">发送位置</div>
        <div class="m-item" v-for="p in places" :key="p.name" @click="sendLoc(p)">{{ p.icon }} {{ p.name }}</div>
        <div class="m-item" @click="showLoc = false; showPlus = true; setTimeout(() => {}, 0)">取消</div>
      </div>
    </div>

    <!-- 消息长按菜单 -->
    <div v-if="msgMenu" class="mask" @click.self="msgMenu = null">
      <div class="modal" style="max-width:260px;padding:8px">
        <div class="m-item" @click="doQuote">引用回复</div>
        <div class="m-item" v-if="menuMsg?.from === 'user'" @click="doRecall">撤回</div>
        <div class="m-item" v-else @click="doRecall">撤回（角色消息）</div>
        <div class="m-item" @click="doCopy">复制</div>
        <div class="m-item" @click="doFav">收藏</div>
      </div>
    </div>

    <!-- 更多设置 -->
    <div v-if="showMore" class="sheet-mask" @click.self="showMore = false">
      <div class="sheet">
        <div class="sheet-t">{{ char.name }} · 聊天设置</div>
        <div class="sheet-b">
          <div class="row" style="margin-bottom:10px"><span class="grow">心声显示</span><div class="switch" :class="{ on: heartOpen }" @click="heartOpen = !heartOpen"></div></div>
          <div class="m-item" @click="showBooks = true">📖 世界书挂接 <span class="muted grow" style="text-align:right">{{ chat.attachedBooks.length }}本</span></div>
          <div class="m-item" @click="showMem = true">🧠 记忆管理 <span class="muted grow" style="text-align:right">{{ getMemories(char.id, 'online').length }}条</span></div>
          <div class="m-item" @click="setChatBg">🖼 聊天背景图</div>
          <div class="m-item" @click="openProfile(); showMore = false">👤 编辑人设 / 角色名片</div>
          <div class="m-item" @click="doSummary">📝 总结最近对话为记忆</div>
          <div class="m-item" @click="openPage('Offline', { charId: char.id }); showMore = false">🚶 线下见面</div>
          <div class="m-item" style="color:#ff6b6b" @click="confirm('清空聊天记录？') && (chat.msgs = [], showMore = false)">🗑 清空聊天记录</div>
        </div>
      </div>
    </div>

    <!-- 世界书挂接 -->
    <div v-if="showBooks" class="sheet-mask" @click.self="showBooks = false">
      <div class="sheet"><div class="sheet-t">临时挂接 / 卸载世界书</div>
        <div v-if="!S.books.length" class="empty">暂无世界书，去「世界书」APP创建</div>
        <label v-for="b in S.books" :key="b.id" class="chk" :class="{ on: chat.attachedBooks.includes(b.id) }" @click.prevent="toggleBook(b.id)">
          <span class="box">{{ chat.attachedBooks.includes(b.id) ? '✓' : '' }}</span>
          <span class="grow">{{ b.name }}</span>
          <span class="muted">{{ b.entries.length }}条</span>
        </label>
      </div>
    </div>

    <!-- 记忆管理 -->
    <div v-if="showMem" class="sheet-mask" @click.self="showMem = false">
      <div class="sheet" style="height:75%">
        <div class="sheet-t">记忆管理（线上聊天）</div>
        <div class="sheet-b">
          <div class="row" style="margin-bottom:8px">
            <input v-model="memText" placeholder="手动添加记忆..." class="grow" style="padding:8px" />
          </div>
          <div class="row" style="margin-bottom:8px">
            <select v-model="memScope" style="width:auto;padding:6px"><option value="real">现实记忆</option><option value="world">角色世界记忆</option></select>
            <input v-model="memTags" placeholder="标签，逗号分隔" class="grow" style="padding:8px" />
            <button class="btn-mini" @click="addManualMem">添加</button>
          </div>
          <div class="row" style="margin-bottom:10px"><button class="btn-ghost grow" @click="doSummary">AI 总结最近对话</button></div>
          <div v-for="m in getMemories(char.id, 'online')" :key="m.id" class="card" style="margin:6px 0;padding:10px">
            <div class="row"><span class="tag" :class="{ hot: m.type === 'real' }">{{ m.type === 'real' ? '现实' : '世界' }}</span>
              <span v-for="t in m.tags" :key="t" class="tag">{{ t }}</span>
              <span class="grow"></span><span class="muted">{{ relTime(m.time) }}</span></div>
            <div style="font-size:13px;margin-top:6px">{{ m.text }}</div>
            <div class="row mt8">
              <button class="btn-mini" @click="m.text = prompt('编辑记忆', m.text) || m.text">编辑</button>
              <button class="btn-mini warn" @click="S.memories = S.memories.filter(x => x.id !== m.id)">删除</button>
            </div>
          </div>
          <div v-if="!getMemories(char.id, 'online').length" class="empty">暂无记忆</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-body { padding: 12px 12px 0; }
.msg-row { display: flex; gap: 8px; margin-bottom: 12px; align-items: flex-start; }
.msg-row.mine { flex-direction: row-reverse; }
.msg-row.sys { justify-content: center; }
.sys-line { font-size: 11px; color: var(--sub); background: rgba(128,128,128,.12); padding: 3px 10px; border-radius: 10px; }
.msg-av { width: 36px; height: 36px; }
.msg-col { max-width: 72%; display: flex; flex-direction: column; }
.mine .msg-col { align-items: flex-end; }
.bubble { background: var(--bubble-char); color: var(--bubble-char-text); opacity: var(--bubble-opacity); border-radius: var(--bubble-radius); border-top-left-radius: 4px; padding: 9px 12px; font-size: var(--font-bubble); line-height: 1.55; position: relative; word-break: break-word; max-width: 100%; }
.bubble.bar { border-radius: 6px; }
.bubble.very { border-radius: 20px; }
.mine .bubble { background: var(--bubble-user); color: var(--bubble-user-text); border-radius: var(--bubble-radius); border-top-right-radius: 4px; }
.mine .bubble.bar { border-radius: 6px; }
.mine .bubble.very { border-radius: 20px; }
.b-txt { white-space: pre-wrap; }
.b-time { display: block; font-size: 10px; opacity: .6; margin-top: 4px; text-align: right; }
.heart-line { font-size: 11px; color: var(--sub); margin-top: 4px; padding: 0 4px; font-style: italic; opacity: .85; }
.voice-b { display: flex; align-items: center; gap: 8px; cursor: pointer; min-width: 100px; }
.v-play { font-size: 12px; }
.wave { display: flex; align-items: center; gap: 2px; height: 16px; }
.wave i { width: 2.5px; background: currentColor; opacity: .55; border-radius: 2px; height: 30%; }
.wave i:nth-child(2) { height: 70%; } .wave i:nth-child(3) { height: 100%; } .wave i:nth-child(4) { height: 55%; } .wave i:nth-child(5) { height: 85%; } .wave i:nth-child(6) { height: 45%; } .wave i:nth-child(7) { height: 65%; }
.wave.playing i { animation: wv .7s infinite alternate; }
.wave i:nth-child(2) { animation-delay: .1s; } .wave i:nth-child(3) { animation-delay: .2s; } .wave i:nth-child(4) { animation-delay: .3s; }
@keyframes wv { from { transform: scaleY(.5) } to { transform: scaleY(1.1) } }
.voice-text { font-size: 11px; color: var(--sub); margin-top: 3px; padding: 0 4px; }
.loading-b { padding: 12px 18px; }
.quote-box { font-size: 11px; color: var(--sub); background: rgba(128,128,128,.1); border-left: 2px solid var(--sub); padding: 3px 8px; margin-bottom: 3px; border-radius: 4px; max-width: 100%; }
.quote-bar { display: flex; align-items: center; gap: 8px; padding: 6px 14px; background: var(--card2); font-size: 12px; color: var(--sub); flex-shrink: 0; }
.input-bar { display: flex; align-items: flex-end; gap: 8px; padding: 8px 10px calc(8px + 4px); background: var(--card); border-top: 1px solid var(--border); flex-shrink: 0; min-height: 60px; }
.chat-input { flex: 1; height: 40px; min-height: 40px; border-radius: 20px; padding: 9px 14px; font-size: 14px; background: var(--card2); border: 1px solid var(--border); line-height: 1.4; }
.send-btn { width: 36px; height: 36px; border-radius: 50%; background: var(--accent); color: var(--accent-text); font-size: 18px; flex-shrink: 0; }
.send-btn.dim { background: var(--card2); color: var(--sub); }
.plus-panel { display: flex; gap: 14px; padding: 14px 18px; background: var(--card); border-top: 1px solid var(--border); flex-shrink: 0; align-items: center; flex-wrap: wrap; }
.plus-item { display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; font-size: 11px; color: var(--text); width: 48px; }
.pi-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--card2); display: flex; align-items: center; justify-content: center; font-size: 20px; }
.sticker-panel { background: var(--card); border-top: 1px solid var(--border); max-height: 220px; overflow-y: auto; flex-shrink: 0; }
.sticker-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; padding: 4px 12px 10px; }
.sticker-item { aspect-ratio: 1; background: var(--card2); border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 26px; overflow: hidden; }
.sticker-item img { width: 100%; height: 100%; object-fit: cover; }
.loc-b { min-width: 110px; }
.red-b { background: #b94a48; color: #fff; }
.img-wrap { display: flex; }
</style>
