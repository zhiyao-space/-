<script setup>
import { S, showToast, uid, now, closePage, gainCoins, payCoins, getChar } from '../core/store'
import { chatCompletions, simpleAsk } from '../core/engine'
import { pickFile, readAsText, fmtTime } from '../core/util'
import { ref, computed, onUnmounted } from 'vue'

const songs = computed(() => S.music.songs)
const cur = ref(null)
const playing = ref(false)
const audioEl = ref(null)
const progress = ref(0)
const curLyric = ref('')
const showUpload = ref(false)
const lyricText = ref('')
const showListen = ref(false)
const listenChar = ref('')
const listenChat = ref([])
const lrcArr = ref([]) // [{t, text}]
const showShare = ref(false)

async function uploadSong() {
  const f = await pickFile('audio/*')
  if (!f) return
  const url = URL.createObjectURL(f)
  S.music.songs.push({ id: uid(), name: f.name.replace(/\.\w+$/, ''), artist: '未知歌手', url, lrc: lyricText.value || '', fav: false, playCount: 0, lastPlay: 0, local: true })
  showToast('已上传')
  showUpload.value = false
  lyricText.value = ''
}
function parseLrc() {
  if (!cur.value?.lrc) { lrcArr.value = []; return }
  lrcArr.value = cur.value.lrc.split('\n').map(l => {
    const m = l.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/)
    if (m) return { t: Number(m[1]) * 60 + Number(m[2]), text: m[3].trim() }
    return null
  }).filter(Boolean).sort((a, b) => a.t - b.t)
}
function play(s) {
  if (audioEl.value) { audioEl.value.pause() }
  cur.value = s
  parseLrc()
  audioEl.value = new Audio(s.url)
  audioEl.value.ontimeupdate = () => {
    if (!audioEl.value) return
    progress.value = audioEl.value.currentTime / (audioEl.value.duration || 1) * 100
    const t = audioEl.value.currentTime
    const line = [...lrcArr.value].reverse().find(l => l.t <= t)
    curLyric.value = line?.text || ''
    if (S.music.listening && Math.random() < 0.02) listenComment()
  }
  audioEl.value.onended = () => { playing.value = false; S.music.listening = null }
  audioEl.value.play().then(() => { playing.value = true; s.playCount++; s.lastPlay = now() }).catch(() => showToast('无法播放'))
}
function toggle() {
  if (!audioEl.value || !cur.value) return
  if (playing.value) { audioEl.value.pause(); playing.value = false }
  else { audioEl.value.play(); playing.value = true }
}
function seek(e) {
  if (!audioEl.value) return
  const rect = e.currentTarget.getBoundingClientRect()
  audioEl.value.currentTime = (e.clientX - rect.left) / rect.width * (audioEl.value.duration || 0)
}
function toggleFav(s) { s.fav = !s.fav }
onUnmounted(() => { audioEl.value?.pause() })

/* 一起听 */
function startListen() {
  if (!listenChar.value || !cur.value) return showToast('先播放歌曲并选择角色')
  S.music.listening = listenChar.value
  listenChat.value = []
  showToast(`邀请成功，${getChar(listenChar.value)?.name} 已加入听歌房`)
  listenComment()
}
async function listenComment() {
  const c = getChar(S.music.listening)
  if (!c) return
  const line = curLyric.value || cur.value.name
  try {
    const t = await simpleAsk(`你是${c.name}。正和用户一起听歌，当前播放《${cur.value.name}》，歌词："${line}"。发一句弹幕式的感受（20字内）。直接输出。`, '一起听歌', { maxTokens: 60 })
    if (t) listenChat.value.push({ id: uid(), from: c.id, text: t.trim().slice(0, 50) })
  } catch {}
}
function sendListen() {
  const input = prompt('对TA说：')
  if (input) listenChat.value.push({ id: uid(), from: 'user', text: input })
}
/* 分享音乐卡片 */
function shareCard() {
  if (!cur.value) return
  const c = prompt('分享给哪个角色？\n' + S.chars.map((c, i) => `${i + 1}.${c.name}`).join(' '))
  const target = S.chars[Number(c) - 1]
  if (!target) return
  const chat = S.chats[target.id] || (S.chats[target.id] = { msgs: [], unread: 0, pinned: false, special: false, attachedBooks: [] })
  chat.msgs.push({ id: uid(), time: now(), from: 'user', type: 'musicshare', content: `🎵 ${cur.value.name} - ${cur.value.artist}`, song: cur.value.name })
  chat.unread++
  showToast('已分享音乐卡片')
  showShare.value = false
}
</script>

<template>
  <div class="page">
    <div class="topbar">
      <button class="tb-btn tb-back" @click="closePage">‹</button>
      <b>音乐</b>
      <span class="grow"></span>
      <button class="tb-btn" style="font-size:14px" @click="showListen = true">一起听</button>
      <button class="tb-btn" style="font-size:22px" @click="showUpload = true">＋</button>
    </div>

    <div class="body" style="padding:12px">
      <!-- 播放器 -->
      <div class="card player" v-if="cur">
        <div class="disc" :class="{ spin: playing }">🎵</div>
        <div class="center mt8"><b>{{ cur.name }}</b><div class="muted" style="font-size:12px">{{ cur.artist }}</div></div>
        <div class="prog mt8" @click="seek"><div :style="{ width: progress + '%' }"></div></div>
        <div class="row mt8" style="justify-content:center;gap:20px">
          <button style="font-size:20px" @click="toggleFav(cur)">{{ cur.fav ? '♥' : '♡' }}</button>
          <button style="font-size:26px" @click="toggle">{{ playing ? '⏸' : '▶' }}</button>
          <button style="font-size:20px" @click="showShare = true">↗</button>
        </div>
        <div class="lyric-box mt8">
          <div v-if="curLyric" class="lyric-line on">{{ curLyric }}</div>
          <div v-else class="muted center" style="font-size:11px">{{ cur.lrc ? '前奏中...' : '暂无歌词' }}</div>
        </div>
        <div v-if="S.music.listening && listenChat.length" class="listen-box">
          <div class="f-lab">一起听 · {{ getChar(S.music.listening)?.name }}</div>
          <div v-for="l in listenChat" :key="l.id" class="listen-line" :class="{ mine: l.from === 'user' }">{{ l.text }}</div>
          <button class="btn-mini mt8" @click="sendListen">说句话</button>
        </div>
      </div>

      <!-- 歌单 -->
      <div class="f-lab mt12">我的音乐（{{ songs.length }}）</div>
      <div v-for="s in [...songs].sort((a, b) => b.playCount - a.playCount)" :key="s.id" class="cell" style="border-radius:10px;margin-bottom:4px" @click="play(s)">
        <div class="avatar" style="border-radius:8px;font-size:18px">🎵</div>
        <div class="ginfo">
          <div class="t1" style="font-size:14px">{{ s.name }} <span class="tag" v-if="s.fav">♥</span></div>
          <div class="t2">{{ s.artist }} · 播放{{ s.playCount }}次 {{ s.lastPlay ? '· 最近 ' + fmtTime(s.lastPlay) : '' }}</div>
        </div>
      </div>
      <div v-if="!songs.length" class="empty">上传本地音乐开始使用<br /><span class="muted">支持歌词同步（LRC）</span></div>
      <div style="height:100px"></div>
    </div>

    <!-- 上传 -->
    <div v-if="showUpload" class="mask" @click.self="showUpload = false">
      <div class="modal">
        <div class="modal-t">自定义上传</div>
        <button class="btn-main" style="height:38px" @click="uploadSong">选择音频文件</button>
        <div class="f-lab mt12">歌词（LRC格式，可选）</div>
        <textarea v-model="lyricText" rows="5" placeholder="[00:12.5]第一句歌词&#10;[00:18.2]第二句"></textarea>
        <div class="modal-f"><button class="btn-ghost grow" @click="showUpload = false">完成</button></div>
      </div>
    </div>

    <!-- 一起听 -->
    <div v-if="showListen" class="mask" @click.self="showListen = false">
      <div class="modal">
        <div class="modal-t">一起听歌</div>
        <div class="f-lab">邀请角色（需先播放一首歌）</div>
        <div class="m-item" v-for="c in S.chars" :key="c.id" @click="listenChar = c.id; startListen(); showListen = false">
          <div class="avatar" style="width:32px;height:32px"><img v-if="c.avatar" :src="c.avatar" /><span v-else class="ph">{{ c.name[0] }}</span></div>
          {{ c.name }}
        </div>
        <div v-if="!S.chars.length" class="empty">先创建角色</div>
        <div class="modal-f"><button class="btn-ghost grow" @click="showListen = false">取消</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player { text-align: center; }
.disc { width: 90px; height: 90px; margin: 0 auto; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #333, #111); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 34px; }
.disc.spin { animation: spin 6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg) } }
.prog { height: 4px; background: var(--card2); border-radius: 2px; cursor: pointer; overflow: hidden; }
.prog div { height: 100%; background: var(--accent); }
.lyric-box { min-height: 40px; background: var(--card2); border-radius: 10px; padding: 10px; }
.lyric-line { font-size: 14px; color: var(--text); transition: all .3s; }
.listen-box { margin-top: 10px; text-align: left; }
.listen-line { font-size: 12px; color: var(--sub); padding: 3px 0; }
.listen-line.mine { text-align: right; color: var(--text); }
</style>
