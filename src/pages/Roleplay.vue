<script setup>
import { S, closePage, showToast, uid, now } from '../core/store'
import { chatCompletions } from '../core/engine'
import { fmtTime } from '../core/util'
import { ref, computed } from 'vue'

const props = defineProps({ scriptId: String })
const showCreate = ref(false)
const cur = ref(null)
const input = ref('')
const loading = ref(false)
const form = ref({ name: '', chars: [], relations: '', world: '', identity: '', opening: '', books: [] })

const list = computed(() => S.roleplays)
const myTurnMsgs = computed(() => cur.value?.msgs || [])

function create() {
  if (!form.value.name.trim()) return showToast('填写剧本名称')
  const rp = { id: uid(), ...JSON.parse(JSON.stringify(form.value)), msgs: [], memories: [], created: now() }
  S.roleplays.push(rp)
  showCreate.value = false
  form.value = { name: '', chars: [], relations: '', world: '', identity: '', opening: '', books: [] }
  showToast('剧本已创建')
}
function openRp(rp) {
  cur.value = rp
  if (!rp.msgs.length && rp.opening) rp.msgs.push({ id: uid(), time: now(), from: 'sys', content: rp.opening })
}
function toggleChar(cid) {
  const i = form.value.chars.indexOf(cid)
  if (i > -1) form.value.chars.splice(i, 1); else form.value.chars.push(cid)
}
function toggleBook(bid) {
  const i = form.value.books.indexOf(bid)
  if (i > -1) form.value.books.splice(i, 1); else form.value.books.push(bid)
}
async function send() {
  const text = input.value.trim()
  if (!text || loading.value || !cur.value) return
  input.value = ''
  cur.value.msgs.push({ id: uid(), time: now(), from: 'user', content: text })
  loading.value = true
  try {
    const chars = cur.value.chars.map(id => S.chars.find(c => c.id === id)).filter(Boolean)
    const sys = [
      `你在主持一个角色扮演剧本「${cur.value.name}」。出场角色：${chars.map(c => c.name).join('、') || '自由发挥'}。`,
      cur.value.relations ? `角色间关系：${cur.value.relations}` : '',
      cur.value.world ? `世界与剧情背景：${cur.value.world}` : '',
      cur.value.identity ? `用户身份：${cur.value.identity}` : '',
      chars.map(c => `【${c.name}】${(c.persona || '').slice(0, 200)}`).join('\n'),
      '以剧本形式推进：叙述+角色对话混合。对话用「角色名：台词」格式。每次推进300字以内，结尾留互动空间。'
    ]
    if (cur.value.books.length) {
      const books = S.books.filter(b => cur.value.books.includes(b.id))
      sys.push('世界观资料：' + books.flatMap(b => b.entries.filter(e => e.trigger !== 'off').map(e => e.content)).join('\n').slice(0, 2000))
    }
    if (cur.value.memories.length) sys.push('【剧本独立记忆（与线上/线下完全隔离）】\n' + cur.value.memories.slice(0, 30).map(m => '- ' + m.text).join('\n'))
    const t = await chatCompletions([
      { role: 'system', content: sys.filter(Boolean).join('\n\n') },
      ...cur.value.msgs.slice(-14).map(m => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.content }))
    ])
    cur.value.msgs.push({ id: uid(), time: now(), from: 'sys', content: t.trim() })
    // 自动总结记忆
    if (cur.value.msgs.length % 10 === 0) summarize()
  } catch (e) { showToast(e.message.slice(0, 40)) }
  loading.value = false
}
async function summarize() {
  try {
    const t = await chatCompletions([
      { role: 'system', content: '总结以下剧本剧情为3-5条要点，每条一行。' },
      { role: 'user', content: cur.value.msgs.slice(-20).map(m => m.content).join('\n').slice(-4000) }
    ], { maxTokens: 400 })
    t.split('\n').filter(l => l.trim().length > 3).forEach(l => cur.value.memories.push({ id: uid(), text: l.replace(/^[-*\d.、\s]+/, ''), time: now() }))
    showToast('已更新剧本记忆')
  } catch {}
}
function viewMem() {
  alert('剧本独立记忆：\n' + (cur.value.memories.map(m => '- ' + m.text).join('\n') || '暂无（每10轮自动总结）'))
}
</script>

<template>
  <div class="page">
    <template v-if="!cur">
      <div class="topbar">
        <button class="tb-btn tb-back" @click="closePage">‹</button>
        <b>角色扮演</b>
        <span class="grow"></span>
        <button class="tb-btn" style="font-size:22px" @click="showCreate = true">＋</button>
      </div>
      <div class="body">
        <div v-if="!list.length" class="empty">还没有剧本<br /><span class="muted">独立记忆系统，完全不与线上/线下互通</span></div>
        <div v-for="rp in list" :key="rp.id" class="cell" @click="openRp(rp)">
          <div class="avatar" style="border-radius:12px;font-size:20px">🎭</div>
          <div class="ginfo">
            <div class="t1">{{ rp.name }}</div>
            <div class="t2">{{ rp.chars.length }}位角色 · {{ rp.msgs.length }}条剧情</div>
          </div>
          <span class="muted">›</span>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="topbar">
        <button class="tb-btn tb-back" @click="cur = null">‹</button>
        <b class="line1 grow">{{ cur.name }}</b>
        <button class="tb-btn" style="font-size:15px" @click="viewMem">记忆</button>
      </div>
      <div class="body" style="padding:14px">
        <div class="hint-txt" v-if="cur.world">🌍 {{ cur.world }}</div>
        <div v-for="m in myTurnMsgs" :key="m.id" class="rp-msg" :class="{ user: m.from === 'user' }">
          <div v-if="m.from === 'sys'" class="rp-narr">{{ m.content }}</div>
          <div v-else class="rp-bubble">{{ m.content }}</div>
        </div>
        <div v-if="loading" class="muted center">剧情推进中...</div>
        <div style="height:70px"></div>
      </div>
      <div class="input-bar">
        <input v-model="input" placeholder="写下你的行动或台词..." class="grow" style="border-radius:20px" @keydown.enter="send" />
        <button class="send-btn" @click="send">↑</button>
      </div>
    </template>

    <!-- 创建 -->
    <div v-if="showCreate" class="mask" @click.self="showCreate = false">
      <div class="modal" style="height:88%">
        <div class="modal-t">创建剧本</div>
        <div class="modal-b">
          <div class="f-lab">剧本名称 *</div>
          <input v-model="form.name" style="margin-bottom:10px" />
          <div class="f-lab">出演角色（多选）</div>
          <div class="chips" style="margin-bottom:10px">
            <span v-for="c in S.chars" :key="c.id" class="chip" :class="{ on: form.chars.includes(c.id) }" @click="toggleChar(c.id)">{{ c.name }}</span>
          </div>
          <div class="f-lab">关系设定</div>
          <input v-model="form.relations" placeholder="角色之间的关系" style="margin-bottom:10px" />
          <div class="f-lab">世界与剧情背景</div>
          <textarea v-model="form.world" rows="3" style="margin-bottom:10px"></textarea>
          <div class="f-lab">我的身份</div>
          <input v-model="form.identity" placeholder="如：转学生 / 侦探 / 咖啡店常客" style="margin-bottom:10px" />
          <div class="f-lab">角色开场白</div>
          <textarea v-model="form.opening" rows="2" style="margin-bottom:10px"></textarea>
          <div class="f-lab">绑定世界书（剧本独立绑定）</div>
          <div class="chips">
            <span v-for="b in S.books" :key="b.id" class="chip" :class="{ on: form.books.includes(b.id) }" @click="toggleBook(b.id)">{{ b.name }}</span>
          </div>
        </div>
        <div class="modal-f">
          <button class="btn-ghost grow" @click="showCreate = false">取消</button>
          <button class="btn-main" style="height:36px" @click="create">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rp-msg { margin-bottom: 12px; }
.rp-narr { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px; font-size: 14px; line-height: 1.8; white-space: pre-wrap; }
.rp-bubble { background: var(--card2); border-radius: 12px; padding: 10px 12px; font-size: 13px; line-height: 1.7; }
.rp-msg.user .rp-bubble { background: var(--bubble-user); color: var(--bubble-user-text); }
.input-bar { display: flex; gap: 8px; padding: 10px 14px; background: var(--card); border-top: 1px solid var(--border); flex-shrink: 0; }
.send-btn { width: 36px; height: 36px; border-radius: 50%; background: var(--accent); color: var(--accent-text); }
</style>
