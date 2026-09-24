<script setup>
import { S, closePage, uid, now, showToast, gainCoins } from '../core/store'
import { simpleAsk } from '../core/engine'
import { ref, onMounted, onUnmounted } from 'vue'

const curLive = ref(null)
const msgs = ref([])
const input = ref('')
const liveTimer = ref(null)
const likes = ref(0)
const sending = ref(false)

function startRandomLive() {
  if (!S.chars.length) return showToast('还没有角色')
  const char = S.chars[Math.floor(Math.random() * S.chars.length)]
  curLive.value = { char, title: `${char.name} 的日常直播`, viewers: Math.floor(Math.random() * 500) + 50 }
  msgs.value.push({ id: uid(), name: '系统', text: '欢迎来到直播间！请大家文明发言。', sys: true })
  
  liveTimer.value = setInterval(() => {
    if (Math.random() < 0.3) {
      curLive.value.viewers += Math.floor(Math.random() * 10) - 3
    }
    if (Math.random() < 0.1) {
      genAudienceMsg()
    }
  }, 2000)

  genCharMsg('开场白')
}

async function genAudienceMsg() {
  const names = ['飞鸟', '小猫', '路人甲', '吃瓜群众', '忠实粉丝', 'AAA建材王哥']
  try {
    const t = await simpleAsk(`你是直播间观众。当前主播是${curLive.value.char.name}。发一条简短的弹幕（15字内）。直接输出。`, '观众弹幕', { maxTokens: 30 })
    if (t) {
      msgs.value.push({ id: uid(), name: names[Math.floor(Math.random() * names.length)], text: t.trim() })
      scrollBottom()
    }
  } catch {}
}

async function genCharMsg(context = '') {
  if (!curLive.value) return
  try {
    const p = `你是${curLive.value.char.name}。你正在开直播。${context} 说一两句话跟观众互动（口语化）。直接输出。`
    const t = await simpleAsk(p, '主播说话', { maxTokens: 60 })
    if (t) {
      msgs.value.push({ id: uid(), name: curLive.value.char.name, text: t.trim(), isHost: true })
      scrollBottom()
    }
  } catch {}
}

async function sendMsg() {
  const q = input.value.trim()
  if (!q || !curLive.value || sending.value) return
  input.value = ''
  msgs.value.push({ id: uid(), name: S.user.name || '我', text: q, isMe: true })
  scrollBottom()
  sending.value = true
  await genCharMsg(`观众弹幕说："${q}"，请回应这条弹幕。`)
  sending.value = false
}

function like() {
  likes.value++
  curLive.value.viewers++
  if (likes.value === 10) {
    gainCoins(1, '直播点赞')
    showToast('点赞达人 +1 币')
  }
}

function scrollBottom() {
  setTimeout(() => {
    const el = document.querySelector('.live-chat')
    if (el) el.scrollTop = el.scrollHeight
  }, 50)
}

onUnmounted(() => {
  if (liveTimer.value) clearInterval(liveTimer.value)
})
</script>

<template>
  <div class="page" style="background:#000; color:#fff">
    <!-- 未开播 -->
    <div v-if="!curLive" class="center" style="padding-top:150px">
      <div class="muted">当前没有直播</div>
      <button class="btn-main mt16" @click="startRandomLive">随便看看</button>
      <button class="btn-ghost mt16" style="color:#fff;border-color:#555" @click="closePage">返回</button>
    </div>

    <!-- 直播中 -->
    <div v-else class="live-container">
      <div class="live-bg">
        <img v-if="curLive.char.avatar" :src="curLive.char.avatar" class="bg-img" />
        <div v-else class="bg-ph">{{ curLive.char.name }}</div>
      </div>
      
      <div class="live-top">
        <div class="host-info">
          <div class="avatar" style="width:32px;height:32px;border:1px solid #fff">
            <img v-if="curLive.char.avatar" :src="curLive.char.avatar" />
            <span v-else class="ph" style="color:#000">{{ curLive.char.name[0] }}</span>
          </div>
          <div>
            <div style="font-size:13px;font-weight:600">{{ curLive.char.name }}</div>
            <div style="font-size:10px;opacity:0.8">{{ curLive.viewers }} 观看</div>
          </div>
        </div>
        <button class="close-btn" @click="closePage">✕</button>
      </div>

      <div class="live-bottom">
        <div class="live-chat">
          <div v-for="m in msgs" :key="m.id" class="msg-line">
            <span :class="{'sys': m.sys, 'host': m.isHost, 'me': m.isMe, 'other': !m.sys && !m.isHost && !m.isMe}">
              {{ m.name }}{{ m.sys ? '' : '：' }}
            </span>
            <span style="opacity:0.9">{{ m.text }}</span>
          </div>
        </div>
        <div class="live-input-row">
          <input v-model="input" placeholder="说点什么..." class="live-input grow" @keydown.enter="sendMsg" />
          <button class="like-btn" @click="like">❤ {{ likes || '' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.live-container { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; }
.live-bg { position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.bg-img { width: 100%; height: 100%; object-fit: cover; filter: blur(20px) brightness(0.6); transform: scale(1.1); }
.bg-ph { font-size: 80px; font-weight: bold; opacity: 0.1; }

.live-top { position: relative; z-index: 1; padding: 12px; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent); }
.host-info { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.4); padding: 4px 12px 4px 4px; border-radius: 20px; }
.close-btn { width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,0.4); color: #fff; border: none; font-size: 16px; cursor: pointer; }

.live-bottom { position: relative; z-index: 1; margin-top: auto; padding: 12px; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); }
.live-chat { max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; font-size: 13px; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
.msg-line { background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 8px; width: fit-content; max-width: 90%; line-height: 1.4; }
.sys { color: #f5a623; }
.host { color: #ff4d4f; font-weight: bold; }
.me { color: #1890ff; }
.other { color: #a0d911; }

.live-input-row { display: flex; gap: 10px; align-items: center; }
.live-input { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 20px; padding: 8px 16px; color: #fff; outline: none; }
.live-input::placeholder { color: rgba(255,255,255,0.6); }
.like-btn { background: #ff4d4f; border: none; border-radius: 20px; padding: 0 16px; height: 36px; color: #fff; font-weight: bold; cursor: pointer; }
</style>
