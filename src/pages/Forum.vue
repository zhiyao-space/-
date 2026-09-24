<script setup>
import { S, closePage, showToast, uid, now, getChar } from '../core/store'
import { simpleAsk } from '../core/engine'
import { relTime, rnd } from '../core/util'
import { ref, computed } from 'vue'

const boards = ['随便聊聊', '情感', '深夜', '问答']
const board = ref('随便聊聊')
const showPost = ref(false)
const form = ref({ title: '', content: '' })
const cur = ref(null)
const comment = ref('')
const showDM = ref(null)
const dmInput = ref('')
const dmLoading = ref(false)

const posts = computed(() => S.forum.posts.filter(p => p.board === board.value))
const boardsCount = b => S.forum.posts.filter(p => p.board === b).length

function post() {
  if (!form.value.content.trim() && !form.value.title.trim()) return showToast('写点内容')
  S.forum.posts.unshift({ id: uid(), board: board.value, title: form.value.title || '（无标题）', content: form.value.content, author: 'user', time: now(), likes: [], comments: [] })
  showPost.value = false
  form.value = { title: '', content: '' }
  showToast('已发布，等大家来聊')
  // 角色来评论
  if (S.chars.length && Math.random() < 0.8) {
    const c = rnd(S.chars)
    setTimeout(async () => {
      try {
        const t = await simpleAsk(`你是${c.name}。在论坛「${board.value}」板块刷到一个帖子：《${form.value.title || '无题'}》：${S.forum.posts[0].content.slice(0, 150)}。以你的口吻回帖（口语化30字内）。直接输出。`, '回帖', { maxTokens: 80 })
        if (t) S.forum.posts[0].comments.push({ id: uid(), charId: c.id, text: t.trim().slice(0, 80), time: now() })
      } catch {}
    }, 2500)
  }
}
function like(p) {
  const i = p.likes.indexOf('user')
  if (i > -1) p.likes.splice(i, 1); else p.likes.push('user')
}
function sendComment(p) {
  if (!comment.value.trim()) return
  p.comments.push({ id: uid(), charId: 'user', text: comment.value.trim(), time: now() })
  comment.value = ''
  if (S.chars.length) {
    const c = rnd(S.chars)
    setTimeout(async () => {
      try {
        const t = await simpleAsk(`你是${c.name}。论坛评论区，用户说：「${p.comments[p.comments.length - 1].text}」。简短回复。直接输出。`, '回复', { maxTokens: 60 })
        if (t) p.comments.push({ id: uid(), charId: c.id, text: t.trim().slice(0, 60), time: now() })
      } catch {}
    }, 2000)
  }
}
async function sendDM() {
  const c = getChar(showDM.value)
  if (!c || !dmInput.value.trim()) return
  S.forum.dms.push({ id: uid(), charId: showDM.value, from: 'user', text: dmInput.value.trim(), time: now() })
  dmInput.value = ''
  dmLoading.value = true
  try {
    const t = await simpleAsk(`你是${c.name}。论坛私信里收到用户消息。以你的口吻回复（口语化）。直接输出。`, dmInput.value || 'hi', { maxTokens: 120 })
    if (t) S.forum.dms.push({ id: uid(), charId: showDM.value, from: 'char', text: t.trim(), time: now() })
  } catch {}
  dmLoading.value = false
}
const dmList = computed(() => S.forum.dms.filter(d => d.charId === showDM.value))
</script>

<template>
  <div class="page">
    <template v-if="!cur && !showDM">
      <div class="topbar">
        <button class="tb-btn tb-back" @click="closePage">‹</button>
        <b>论坛</b>
        <span class="grow"></span>
        <button class="tb-btn" style="font-size:14px" @click="showDM = prompt('私信角色（输入角色名）') || S.chars[0]?.id || null; showDM = S.chars.find(c => c.name === showDM)?.id || showDM" v-if="S.chars.length">私信</button>
        <button class="tb-btn" style="font-size:22px" @click="showPost = true">＋</button>
      </div>
      <div class="tabs">
        <div v-for="b in boards" :key="b" class="tab" :class="{ on: board === b }" @click="board = b">{{ b }}({{ boardsCount(b) }})</div>
      </div>
      <div class="body">
        <div v-if="!posts.length" class="empty">这个板块还很安静</div>
        <div v-for="p in posts" :key="p.id" class="card" style="cursor:pointer" @click="cur = p">
          <div class="row"><b style="font-size:15px" class="grow">{{ p.title }}</b><span class="muted" style="font-size:11px">{{ relTime(p.time) }}</span></div>
          <div class="muted mt8" style="font-size:13px" v-if="p.content">{{ p.content.slice(0, 60) }}</div>
          <div class="row mt8"><span class="muted" style="font-size:11px">👍{{ p.likes.length }} · 💬{{ p.comments.length }}</span></div>
        </div>
        <div style="height:80px"></div>
      </div>
    </template>

    <!-- 帖子详情 -->
    <template v-else-if="cur">
      <div class="topbar">
        <button class="tb-btn tb-back" @click="cur = null">‹</button>
        <b class="line1 grow">{{ cur.title }}</b>
      </div>
      <div class="body" style="padding:16px">
        <div class="muted" style="font-size:11px">{{ cur.board }} · {{ relTime(cur.time) }}</div>
        <div style="font-size:14px;line-height:1.8;margin-top:8px;white-space:pre-wrap">{{ cur.content }}</div>
        <div class="row mt12"><button class="btn-mini" @click="like(cur)">👍 {{ cur.likes.length }}</button></div>
        <div class="f-lab mt12">评论（{{ cur.comments.length }}）</div>
        <div v-for="c in cur.comments" :key="c.id" class="mo-comment">
          <b>{{ c.charId === 'user' ? '我' : getChar(c.charId)?.name || '路人' }}</b>：{{ c.text }}
        </div>
        <div class="row mt8"><input v-model="comment" placeholder="回帖..." class="grow" style="padding:8px" @keydown.enter="sendComment(cur)" /><button class="btn-mini" @click="sendComment(cur)">发送</button></div>
      </div>
    </template>

    <!-- 私信 -->
    <template v-else-if="showDM">
      <div class="topbar">
        <button class="tb-btn tb-back" @click="showDM = null">‹</button>
        <select v-model="showDM" class="grow" style="width:auto">
          <option v-for="c in S.chars" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="body" style="padding:14px">
        <div v-for="d in dmList" :key="d.id" class="dm-row" :class="{ mine: d.from === 'user' }">
          <div class="dm-bubble">{{ d.text }}</div>
        </div>
        <div v-if="dmLoading" class="center muted">对方正在输入...</div>
      </div>
      <div class="dm-bar"><input v-model="dmInput" placeholder="私信..." class="grow" style="border-radius:20px" @keydown.enter="sendDM" /><button class="btn-mini" @click="sendDM">发送</button></div>
    </template>

    <!-- 发帖 -->
    <div v-if="showPost" class="mask" @click.self="showPost = false">
      <div class="modal">
        <div class="modal-t">发帖 · {{ board }}</div>
        <div class="f-lab">标题</div><input v-model="form.title" style="margin-bottom:10px" />
        <div class="f-lab">内容</div><textarea v-model="form.content" rows="5"></textarea>
        <div class="modal-f"><button class="btn-ghost grow" @click="showPost = false">取消</button><button class="btn-main" style="height:36px" @click="post">发布</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mo-comment { font-size: 12px; color: var(--sub); margin-top: 6px; background: rgba(128,128,128,.08); padding: 5px 8px; border-radius: 6px; }
.dm-row { display: flex; margin-bottom: 10px; }
.dm-row.mine { justify-content: flex-end; }
.dm-bubble { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 8px 12px; font-size: 13px; max-width: 75%; }
.dm-row.mine .dm-bubble { background: var(--bubble-user); color: var(--bubble-user-text); }
.dm-bar { display: flex; gap: 8px; padding: 10px 14px; background: var(--card); border-top: 1px solid var(--border); flex-shrink: 0; }
</style>
