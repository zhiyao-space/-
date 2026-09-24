<script setup>
import { S, closePage, showToast, uid, now, getChar, getChat, addMsg } from '../core/store'
import { simpleAsk, getMemories } from '../core/engine'
import { MAP_PLACES, rnd, hashStr, relTime, fmtFull, mulberry } from '../core/util'
import { ref, computed, onUnmounted } from 'vue'

const props = defineProps({ charId: String })
const char = computed(() => S.chars.find(c => c.id === props.charId))
const step = ref('confirm') // confirm / main / app
const curApp = ref(null)
const elapsed = ref(0)
const risk = ref(0)
let timer = null
const snapshots = ref(null)
const genLoading = ref(false)
const caught = ref(false)

const APPS = [
  { id: 'wechat', name: '微信', icon: '💬' }, { id: 'map', name: '地图', icon: '🗺' },
  { id: 'music', name: '音乐', icon: '🎵' }, { id: 'browser', name: '浏览器', icon: '🌐' },
  { id: 'sms', name: '短信', icon: '✉️' }, { id: 'memo', name: '备忘录', icon: '📝' },
  { id: 'wallet', name: '钱包', icon: '💳' }, { id: 'album', name: '相册', icon: '🖼' }
]
function riskPct() { return Math.min(95, Math.round(risk.value)) }
function enter() {
  step.value = 'main'
  timer = setInterval(() => {
    elapsed.value += 1
    risk.value = 8 + elapsed.value * 1.5
    if (!caught.value && Math.random() < risk.value / 100 / 60) {
      caught.value = true
      clearInterval(timer)
      onCaught()
    }
  }, 1000)
}
async function onCaught() {
  showToast('糟糕，被抓包了！')
  step.value = 'caught'
  try {
    const t = await simpleAsk(`你是${char.value.name}。用户趁你不注意偷看了你的手机，你发现了。根据人设做出反应（质问/撒娇/生气/无奈等），发一条微信消息。直接输出内容。`, '被抓包现场', { maxTokens: 150 })
    if (t) addMsg(char.value.id, { from: 'char', type: 'text', content: t.trim() })
  } catch {}
}
function leave() { clearInterval(timer); closePage() }
onUnmounted(() => clearInterval(timer))

/* 生成虚拟数据 */
async function genSnapshots() {
  genLoading.value = true
  try {
    const mem = getMemories(char.value.id, 'online').slice(0, 5).map(m => m.text).join('；')
    const raw = await simpleAsk(
      `为角色手机生成虚拟数据JSON。只输出JSON：{"npcChats":[{"npc":"NPC名","msgs":[{"from":"npc或char","text":"...","t":"HH:MM"}]}],"places":["搜索过的地方"],"favPlaces":["收藏地点"],"nav":["导航记录"],"songs":[{"name":"歌","artist":"歌手"}],"rank":["最常听"],"browser":{"bookmarks":["..."],"history":["..."]},"sms":[{"from":"发件人","text":"..."}],"memoLocked":["锁住的备忘"],"memoOpen":["开放备忘"],"spend":[{"item":"消费","amt":数字}],"steps":数字}`,
      `角色：${char.value.name}\n设定：${(char.value.persona || '').slice(0, 300)}\n近期记忆：${mem || '无'}\n要求贴合人设，中文，数据丰富真实`,
      { maxTokens: 1500 })
    snapshots.value = JSON.parse(raw.match(/\{[\s\S]*\}/)[0])
    S.snoops.unshift({ id: uid(), charId: char.value.id, time: now(), caught: false, dur: elapsed.value })
  } catch (e) { showToast('生成失败: ' + e.message.slice(0, 50)) }
  genLoading.value = false
}
function ensureSnap() {
  if (!snapshots.value) genSnapshots()
}
function openApp(id) {
  ensureSnap()
  curApp.value = id
  step.value = 'app'
}
function snapToChat(msg) {
  addMsg(char.value.id, { from: 'user', type: 'text', content: `[看到TA和${msg.npc}的聊天] "${msg.text}"，我有点在意`, quote: undefined, quoteText: undefined })
  showToast('已同步到聊天')
}
function delSnap(chatIdx, msgIdx) {
  snapshots.value.npcChats[chatIdx].msgs.splice(msgIdx, 1)
}
function clearSnap() {
  if (confirm('清空全部虚拟快照？下次进入会重新生成')) snapshots.value = null
}
const seed = computed(() => hashStr(char.value?.id || 'x'))
const albumImgs = computed(() => Array.from({ length: 9 }, (_, i) => `https://picsum.photos/seed/${seed.value + i}/200/200`))
const curMusic = computed(() => snapshots.value?.songs?.length ? snapshots.value.songs[hashStr(char.value.id) % snapshots.value.songs.length] : null)
</script>

<template>
  <div class="page" v-if="char">
    <!-- 确认弹窗 -->
    <div v-if="step === 'confirm'" class="mask" style="z-index:200">
      <div class="modal">
        <div class="modal-t">⚠️ 查看TA的手机</div>
        <div class="modal-b center">
          <div style="font-size:14px;line-height:1.8">你准备查看 <b>{{ char.name }}</b> 的手机。<br />查看越久，被抓包的概率越大。<br />当前预估风险：</div>
          <div style="font-size:36px;font-weight:700;color:#ff6b6b;margin:10px 0">{{ riskPct() }}%</div>
          <div class="muted">设备密码：{{ char.devicePass }}（备用）</div>
        </div>
        <div class="modal-f">
          <button class="btn-ghost grow" @click="leave">算了，做个体面人</button>
          <button class="btn-main grow" style="height:36px;background:#ff6b6b;color:#fff" @click="enter">赌一把</button>
        </div>
      </div>
    </div>

    <!-- 被抓 -->
    <div v-else-if="step === 'caught'" class="mask" style="z-index:200">
      <div class="modal center">
        <div style="font-size:40px">😱</div>
        <div class="modal-t">被发现了！</div>
        <div style="font-size:14px;margin-bottom:10px">TA 正好回头看向你手里的手机……</div>
        <div class="modal-f"><button class="btn-main grow" @click="leave">去聊天页面对峙</button></div>
      </div>
    </div>

    <!-- 主屏 -->
    <template v-else>
      <div class="topbar">
        <button class="tb-btn tb-back" @click="step === 'app' ? (step = 'main') : leave()">‹</button>
        <div class="grow">
          <div style="font-weight:600">{{ char.name }} 的手机</div>
          <div class="muted" style="font-size:10px">已查看 {{ elapsed }}s · 被抓风险 {{ riskPct() }}%</div>
        </div>
        <button class="tb-btn" style="font-size:16px" @click="clearSnap" v-if="step === 'app'">🗑</button>
      </div>
      <div class="body" style="padding:16px">
        <div v-if="step === 'main'">
          <div class="row" style="justify-content:space-around;margin-bottom:16px;background:var(--card);border-radius:14px;padding:10px">
            <div class="center" style="flex:1"><div style="font-size:20px">🔋</div><div class="muted" style="font-size:10px">电量 {{ 30 + (hashStr(char.id) % 60) }}%</div></div>
            <div class="center" style="flex:1"><div style="font-size:20px">📶</div><div class="muted" style="font-size:10px">在线</div></div>
            <div class="center" style="flex:1"><div style="font-size:20px">👣</div><div class="muted" style="font-size:10px">{{ snapshots ? snapshots.steps + '步' : '步数?' }}</div></div>
          </div>
          <div class="snoop-grid">
            <div v-for="a in APPS" :key="a.id" class="snoop-app" @click="openApp(a.id)">
              <div class="sa-icon">{{ a.icon }}</div><div style="font-size:11px">{{ a.name }}</div>
            </div>
          </div>
          <div v-if="genLoading" class="center muted mt16">正在生成TA的手机数据...</div>
          <div class="hint-txt">点击APP查看内容。停留越久风险越高。</div>
        </div>

        <!-- 微信快照 -->
        <template v-else-if="curApp === 'wechat'">
          <div v-for="(c, ci) in snapshots?.npcChats || []" :key="ci" class="card">
            <b>{{ c.npc }}</b>
            <div v-for="(m, mi) in c.msgs" :key="mi" class="snap-msg" :class="{ mine: m.from === 'char' }">
              <div style="max-width:80%">
                <div class="snap-bubble">{{ m.text }}</div>
                <div class="muted" style="font-size:9px">{{ m.t }}</div>
              </div>
              <div class="snap-tools">
                <button class="btn-mini" style="height:20px;padding:0 6px;font-size:10px" @click="snapToChat({ npc: c.npc, text: m.text })">同步</button>
                <button class="btn-mini warn" style="height:20px;padding:0 6px;font-size:10px" @click="delSnap(ci, mi)">删</button>
              </div>
            </div>
          </div>
          <div v-if="!snapshots?.npcChats?.length" class="empty">暂无快照</div>
        </template>

        <!-- 地图 -->
        <template v-else-if="curApp === 'map'">
          <div class="card"><div class="f-lab">近期搜索</div><div v-for="(p, i) in snapshots?.places || []" :key="i" class="m-item" style="padding:8px 0">🔍 {{ p }}</div></div>
          <div class="card"><div class="f-lab">收藏地点</div><div v-for="(p, i) in snapshots?.favPlaces || []" :key="i" class="m-item" style="padding:8px 0">⭐ {{ p }}</div></div>
          <div class="card"><div class="f-lab">导航记录</div><div v-for="(p, i) in snapshots?.nav || []" :key="i" class="m-item" style="padding:8px 0">🧭 {{ p }}</div></div>
        </template>

        <!-- 音乐 -->
        <template v-else-if="curApp === 'music'">
          <div class="card center">
            <div style="font-size:40px">🎵</div>
            <div style="font-size:16px;font-weight:600">{{ curMusic?.name }}</div>
            <div class="muted">{{ curMusic?.artist }}</div>
          </div>
          <div class="card"><div class="f-lab">收藏歌曲</div><div v-for="(s, i) in snapshots?.songs || []" :key="i" class="m-item" style="padding:8px 0">{{ s.name }} - {{ s.artist }}</div></div>
          <div class="card"><div class="f-lab">常听排行</div><div v-for="(s, i) in snapshots?.rank || []" :key="i" class="m-item" style="padding:8px 0">{{ i + 1 }}. {{ s }}</div></div>
        </template>

        <!-- 浏览器 -->
        <template v-else-if="curApp === 'browser'">
          <div class="card"><div class="f-lab">书签</div><div v-for="(b, i) in snapshots?.browser?.bookmarks || []" :key="i" class="m-item" style="padding:8px 0">🔖 {{ b }}</div></div>
          <div class="card"><div class="f-lab">历史搜索</div><div v-for="(b, i) in snapshots?.browser?.history || []" :key="i" class="m-item" style="padding:8px 0">🕘 {{ b }}</div></div>
        </template>

        <!-- 短信 -->
        <template v-else-if="curApp === 'sms'">
          <div class="card"><div class="f-lab">近期信息</div><div v-for="(s, i) in snapshots?.sms || []" :key="i" class="m-item" style="padding:8px 0"><div><b style="font-size:13px">{{ s.from }}</b><div class="muted">{{ s.text }}</div></div></div></div>
        </template>

        <!-- 备忘录 -->
        <template v-else-if="curApp === 'memo'">
          <div class="card"><div class="f-lab">未锁定</div><div v-for="(m, i) in snapshots?.memoOpen || []" :key="i" class="m-item" style="padding:8px 0">📝 {{ m }}</div></div>
          <div class="card"><div class="f-lab">🔒 已锁定</div><div v-for="(m, i) in snapshots?.memoLocked || []" :key="i" class="m-item" style="padding:8px 0;color:var(--sub)">🔒 该备忘已加密（密码：{{ char.devicePass }}）</div></div>
        </template>

        <!-- 钱包 -->
        <template v-else-if="curApp === 'wallet'">
          <div class="card"><div class="f-lab">最近一周消费</div><div v-for="(s, i) in snapshots?.spend || []" :key="i" class="m-item" style="padding:8px 0"><span class="grow">{{ s.item }}</span><span style="color:#ff6b6b">-{{ s.amt }}</span></div></div>
        </template>

        <!-- 相册 -->
        <template v-else-if="curApp === 'album'">
          <div class="alb-grid"><img v-for="(u, i) in albumImgs" :key="i" :src="u" /></div>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.snoop-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px 8px; }
.snoop-app { text-align: center; cursor: pointer; }
.sa-icon { width: 52px; height: 52px; margin: 0 auto 5px; background: var(--card); border: 1px solid var(--border); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px; }
.snap-msg { display: flex; gap: 8px; align-items: flex-end; margin-top: 8px; }
.snap-msg.mine { flex-direction: row-reverse; }
.snap-bubble { background: var(--card2); border-radius: 10px; padding: 7px 10px; font-size: 13px; }
.snap-msg.mine .snap-bubble { background: var(--bubble-user); color: var(--bubble-user-text); }
.snap-tools { display: flex; flex-direction: column; gap: 3px; opacity: .7; }
.alb-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; }
.alb-grid img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px; }
.warn { color: #ff6b6b; }
</style>
