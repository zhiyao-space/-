<script setup>
import { S, closePage, showToast, uid, now } from '../core/store'
import { chatCompletions } from '../core/engine'
import { relTime } from '../core/util'
import { ref } from 'vue'

const boards = ['恋爱', '冒险', '日常', '脑洞', '续写']
const showCreate = ref(false)
const cur = ref(null)
const form = ref({ title: '', board: '恋爱', premise: '' })
const loading = ref(false)
const comment = ref('')

function create() {
  if (!form.value.title.trim()) return showToast('起个标题')
  const f = { id: uid(), ...JSON.parse(JSON.stringify(form.value)), chapters: [], comments: [], updated: now(), up: 0 }
  S.fanfics.push(f)
  showCreate.value = false
  cur.value = f
  form.value = { title: '', board: '恋爱', premise: '' }
}
async function aiWrite() {
  if (!cur.value) return
  loading.value = true
  try {
    const prev = cur.value.chapters.map(c => c.text).join('\n').slice(-1500)
    const t = await chatCompletions([
      { role: 'system', content: `你是同人文作者。板块「${cur.value.board}」。${cur.value.premise ? '故事设定：' + cur.value.premise : ''}${prev ? '\n【前文】' + prev : ''}\n续写下一章，800字以内，网文风格，结尾留悬念。直接输出正文。` },
      { role: 'user', content: prev ? '催更！继续写' : '开始写第一章' }
    ], { maxTokens: 1600 })
    cur.value.chapters.push({ id: uid(), text: t.trim(), time: now() })
    cur.value.updated = now()
  } catch (e) { showToast(e.message.slice(0, 40)) }
  loading.value = false
}
async function urge() {
  showToast('已催更！')
  await aiWrite()
}
function sendComment() {
  if (!comment.value.trim()) return
  cur.value.comments.push({ id: uid(), text: comment.value.trim(), time: now() })
  comment.value = ''
}
</script>

<template>
  <div class="page">
    <template v-if="!cur">
      <div class="topbar">
        <button class="tb-btn tb-back" @click="closePage">‹</button>
        <b>同人文</b>
        <span class="grow"></span>
        <button class="tb-btn" style="font-size:22px" @click="showCreate = true">＋</button>
      </div>
      <div class="body">
        <div v-if="!S.fanfics.length" class="empty">写一篇属于你们的故事</div>
        <div v-for="f in [...S.fanfics].sort((a, b) => b.updated - a.updated)" :key="f.id" class="cell" @click="cur = f">
          <div class="avatar" style="border-radius:10px;font-size:20px">📜</div>
          <div class="ginfo">
            <div class="t1">{{ f.title }} <span class="tag">{{ f.board }}</span></div>
            <div class="t2">{{ f.chapters.length }}章 · {{ relTime(f.updated) }}</div>
          </div>
          <span class="muted">›</span>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="topbar">
        <button class="tb-btn tb-back" @click="cur = null">‹</button>
        <div class="grow"><b class="line1">{{ cur.title }}</b><div class="muted" style="font-size:10px">{{ cur.board }} · {{ cur.chapters.length }}章</div></div>
        <button class="btn-mini" @click="urge" :disabled="loading">{{ loading ? '更新中' : '催更' }}</button>
      </div>
      <div class="body" style="padding:14px">
        <div class="hint-txt" v-if="cur.premise">📖 {{ cur.premise }}</div>
        <div v-for="(c, i) in cur.chapters" :key="c.id" class="chapter">
          <div class="f-lab">第{{ i + 1 }}章 · {{ relTime(c.time) }}</div>
          <div class="novel">{{ c.text }}</div>
        </div>
        <div v-if="!cur.chapters.length" class="empty">还没有章节<br /><button class="btn-main mt16" style="width:auto;padding:0 26px;height:38px" @click="aiWrite">AI 开写第一章</button></div>
        <div class="card mt12">
          <div class="f-lab">评论区</div>
          <div class="row"><input v-model="comment" placeholder="说点什么..." class="grow" style="padding:8px" @keydown.enter="sendComment" /><button class="btn-mini" @click="sendComment">发送</button></div>
          <div v-for="c in cur.comments" :key="c.id" class="muted mt8" style="font-size:13px">读者：{{ c.text }}</div>
        </div>
        <div style="height:80px"></div>
      </div>
      <div class="write-bar"><button class="btn-main grow" @click="aiWrite" :disabled="loading">{{ loading ? 'AI 正在写...' : '✍ AI 续写下一章' }}</button></div>
    </template>

    <div v-if="showCreate" class="mask" @click.self="showCreate = false">
      <div class="modal">
        <div class="modal-t">开始写文</div>
        <div class="f-lab">标题 *</div><input v-model="form.title" style="margin-bottom:10px" />
        <div class="f-lab">板块分类</div>
        <div class="chips" style="margin-bottom:10px"><span v-for="b in boards" :key="b" class="chip" :class="{ on: form.board === b }" @click="form.board = b">{{ b }}</span></div>
        <div class="f-lab">故事设定（可选）</div>
        <textarea v-model="form.premise" rows="3"></textarea>
        <div class="modal-f"><button class="btn-ghost grow" @click="showCreate = false">取消</button><button class="btn-main" style="height:36px" @click="create">创建</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chapter { margin-bottom: 18px; }
.novel { font-size: 14px; line-height: 1.9; white-space: pre-wrap; text-indent: 2em; }
.write-bar { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 16px; background: var(--card); border-top: 1px solid var(--border); z-index: 5; }
</style>
