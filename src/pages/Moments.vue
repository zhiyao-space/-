<script setup>
import { S, showToast, uid, now, getChar } from '../core/store'
import { pickFile, readAsDataURL, compressImageLen, relTime } from '../core/util'
import { simpleAsk } from '../core/engine'
import { ref, computed } from 'vue'

const tab = ref('all')
const showPublish = ref(false)
const pub = ref({ text: '', images: [], loc: '', mentions: [] })
const commentFor = ref(null)
const commentText = ref('')

const myPosts = computed(() => S.moments.filter(m => !m.sys))
const favList = computed(() => S.user.favs || [])
const notis = computed(() => S.moments.flatMap(m => (m.comments || []).map(c => ({ m, c }))))

async function pickImages() {
  const files = await pickFile('image/*', true)
  if (!files) return
  for (const f of files.slice(0, 6)) pub.value.images.push(await compressImageLen(await readAsDataURL(f), 600, 0.7))
}
function toggleMention(id) {
  const i = pub.value.mentions.indexOf(id)
  if (i > -1) pub.value.mentions.splice(i, 1); else pub.value.mentions.push(id)
}
async function publish() {
  if (!pub.value.text.trim() && !pub.value.images.length) return showToast('写点什么吧')
  S.moments.unshift({ id: uid(), text: pub.value.text, images: [...pub.value.images], loc: pub.value.loc, mentions: [...pub.value.mentions], likes: [], comments: [], pinned: false, time: now(), maskId: S.user.activeMask })
  showPublish.value = false
  pub.value = { text: '', images: [], loc: '', mentions: [] }
  showToast('已发布')
  // 被提到的角色随机来评论
  for (const cid of S.moments[0].mentions) {
    const c = getChar(cid)
    if (!c) continue
    try {
      const t = await simpleAsk(`你是${c.name}。用户发了条朋友圈：「${S.moments[0].text || '[图片]'}」。用一句话评论（符合人设口语化）。直接输出评论内容。`, '评论这条朋友圈', { maxTokens: 80 })
      if (t) S.moments[0].comments.push({ id: uid(), charId: cid, text: t.trim().slice(0, 100), time: now() })
    } catch {}
  }
}
function toggleLike(m) {
  const i = m.likes.indexOf('user')
  if (i > -1) m.likes.splice(i, 1); else m.likes.push('user')
}
function togglePin(m) { m.pinned = !m.pinned }
function delMoment(m) {
  if (confirm('删除这条动态？')) S.moments = S.moments.filter(x => x.id !== m.id)
}
function sendComment(m) {
  if (!commentText.value.trim()) return
  m.comments.push({ id: uid(), charId: 'user', text: commentText.value.trim(), time: now() })
  commentText.value = ''
  commentFor.value = null
  // 随机角色回复
  if (m.mentions?.length && Math.random() < 0.7) {
    const c = getChar(m.mentions[Math.floor(Math.random() * m.mentions.length)])
    if (c) setTimeout(async () => {
      try {
        const t = await simpleAsk(`你是${c.name}。朋友圈评论区，用户回复了：「${m.comments[m.comments.length - 1].text}」。简短回复一句。直接输出。`, '回复评论', { maxTokens: 60 })
        if (t) m.comments.push({ id: uid(), charId: c.id, text: t.trim().slice(0, 80), time: now() })
      } catch {}
    }, 1500)
  }
}
function favPost(m) {
  S.user.favs = S.user.favs || []
  S.user.favs.push({ id: uid(), text: m.text, from: '朋友圈', img: m.images[0] || '', time: now() })
  showToast('已收藏')
}
const sorted = computed(() => [...myPosts.value].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.time - a.time))
</script>

<template>
  <div class="page">
    <div class="body">
      <!-- 头部 -->
      <div class="mo-head">
        <div style="text-align:right;padding:44px 16px 0">
          <div style="display:inline-flex;align-items:center;gap:10px;background:rgba(0,0,0,.35);padding:8px 14px;border-radius:40px;backdrop-filter:blur(8px)">
            <div style="font-size:15px;font-weight:600">{{ S.user.nickname }}</div>
            <div class="avatar" style="width:44px;height:44px"><img v-if="S.user.avatar" :src="S.user.avatar" /><span v-else class="ph">{{ S.user.nickname[0] }}</span></div>
          </div>
        </div>
      </div>

      <div class="tabs" style="position:sticky;top:0;z-index:3">
        <div class="tab" :class="{ on: tab === 'all' }" @click="tab = 'all'">动态</div>
        <div class="tab" :class="{ on: tab === 'fav' }" @click="tab = 'fav'">我收藏的</div>
        <div class="tab" :class="{ on: tab === 'noti' }" @click="tab = 'noti'">通知</div>
      </div>

      <template v-if="tab === 'all'">
        <div class="pub-fab" @click="showPublish = true">＋</div>
        <div v-for="m in sorted" :key="m.id" class="card">
          <div class="row" v-if="m.pinned"><span class="tag hot">置顶</span></div>
          <div style="font-size:14px;line-height:1.65;white-space:pre-wrap">{{ m.text }}</div>
          <div v-if="m.images.length" class="mo-imgs" :class="{ one: m.images.length === 1 }">
            <img v-for="(img, i) in m.images" :key="i" :src="img" />
          </div>
          <div class="muted mt8" style="font-size:11px">
            {{ relTime(m.time) }} <span v-if="m.loc">· 📍{{ m.loc }}</span>
            <span v-if="m.mentions.length"> · 与 {{ m.mentions.map(id => getChar(id)?.name).filter(Boolean).join('、') }} 同框</span>
          </div>
          <div class="row mt12" style="gap:14px">
            <button class="btn-mini" @click="toggleLike(m)">👍 {{ m.likes.length }}</button>
            <button class="btn-mini" @click="favPost(m)">⭐ 收藏</button>
            <button class="btn-mini" @click="commentFor = commentFor === m.id ? null : m.id">💬 {{ m.comments.length }}</button>
            <button class="btn-mini" @click="togglePin(m)">{{ m.pinned ? '取消置顶' : '置顶' }}</button>
            <button class="btn-mini warn" @click="delMoment(m)">删除</button>
          </div>
          <div v-if="m.likes.length" class="muted mt8" style="font-size:11px">👍 {{ m.likes.map(id => id === 'user' ? '我' : getChar(id)?.name || '?').join('、') }}</div>
          <div v-if="commentFor === m.id" class="row mt8">
            <input v-model="commentText" placeholder="评论..." class="grow" style="padding:8px" @keydown.enter="sendComment(m)" />
            <button class="btn-mini" @click="sendComment(m)">发送</button>
          </div>
          <div v-for="c in m.comments" :key="c.id" class="mo-comment">
            <b>{{ c.charId === 'user' ? '我' : getChar(c.charId)?.name || '路人' }}</b>：{{ c.text }}
          </div>
        </div>
        <div v-if="!sorted.length" class="empty">还没有动态，点右下角 + 发布</div>
      </template>

      <template v-else-if="tab === 'fav'">
        <div v-for="f in favList" :key="f.id" class="card">
          <div class="muted" style="font-size:11px">{{ f.from }} · {{ relTime(f.time) }}</div>
          <div style="font-size:14px;margin-top:6px">{{ f.text }}</div>
          <img v-if="f.img" :src="f.img" style="max-width:150px;border-radius:8px;margin-top:8px" />
        </div>
        <div v-if="!favList.length" class="empty">暂无收藏</div>
      </template>

      <template v-else>
        <div v-for="(n, i) in notis" :key="i" class="card">
          <div class="row">
            <b>{{ n.c.charId === 'user' ? '我' : getChar(n.c.charId)?.name || '路人' }}</b>
            <span class="grow"></span><span class="muted" style="font-size:11px">{{ relTime(n.c.time) }}</span>
          </div>
          <div style="font-size:13px;margin-top:4px">评论了你的动态：{{ n.c.text }}</div>
        </div>
        <div v-if="!notis.length" class="empty">暂无互动通知</div>
      </template>
      <div style="height:120px"></div>
    </div>

    <!-- 发布 -->
    <div v-if="showPublish" class="mask" @click.self="showPublish = false">
      <div class="modal" style="height:80%">
        <div class="modal-t">发布动态</div>
        <div class="modal-b">
          <textarea v-model="pub.text" rows="4" placeholder="这一刻的想法..." style="margin-bottom:10px"></textarea>
          <div class="mo-imgs one" v-if="pub.images.length" style="margin-bottom:10px">
            <img v-for="(img, i) in pub.images" :key="i" :src="img" />
          </div>
          <div class="row" style="flex-wrap:wrap;gap:8px;margin-bottom:10px">
            <button class="btn-mini" @click="pickImages">＋ 图片</button>
            <button class="btn-mini" @click="pub.loc = prompt('绑定位置', '家') || ''">📍 {{ pub.loc || '位置' }}</button>
          </div>
          <div class="f-lab">@ 角色</div>
          <div class="chips">
            <span v-for="c in S.chars" :key="c.id" class="chip" :class="{ on: pub.mentions.includes(c.id) }" @click="toggleMention(c.id)">{{ c.name }}</span>
            <span v-if="!S.chars.length" class="muted">暂无角色</span>
          </div>
        </div>
        <div class="modal-f">
          <button class="btn-ghost grow" @click="showPublish = false">取消</button>
          <button class="btn-main" style="height:36px" @click="publish">发布</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mo-head { height: 190px; background: linear-gradient(160deg, var(--card2), var(--bg)); }
.pub-fab { position: fixed; right: 18px; bottom: 130px; width: 52px; height: 52px; border-radius: 50%; background: var(--accent); color: var(--accent-text); font-size: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 20; box-shadow: 0 6px 18px rgba(0,0,0,.4); }
.mo-imgs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-top: 8px; }
.mo-imgs.one { grid-template-columns: repeat(3, minmax(0, 140px)); }
.mo-imgs img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; }
.mo-comment { font-size: 12px; color: var(--sub); margin-top: 6px; background: rgba(128,128,128,.08); padding: 5px 8px; border-radius: 6px; }
.warn { color: #ff6b6b; border-color: #ff6b6b44; }
</style>
