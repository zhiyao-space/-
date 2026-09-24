<script setup>
import { S, closePage, openPage, showToast, uid, now, payCoins, wallet } from '../core/store'
import { fmtTime, relTime } from '../core/util'
import { groupReply, getMemories } from '../core/engine'
import { ref, computed, nextTick, onMounted } from 'vue'

const props = defineProps({ groupId: String })
const group = computed(() => S.groups.find(g => g.id === props.groupId))
const input = ref('')
const sending = ref(false)
const bodyRef = ref(null)
const showMore = ref(false)
const showAt = ref(false)
const showPanel = ref(false)
const atTarget = ref(null)

function scrollBottom() { nextTick(() => { if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight }) }
onMounted(scrollBottom)
const cname = id => id === 'user' ? maskName() : (S.chars.find(c => c.id === id)?.name || '未知')
const cavatar = id => id === 'user' ? S.user.avatar : S.chars.find(c => c.id === id)?.avatar
function maskName() {
  const m = S.user.masks.find(m => m.id === group.value.settings?.maskId)
  return m?.name || S.user.nickname
}

async function send(at) {
  const text = input.value.trim()
  if (!text || sending.value) return
  input.value = ''
  group.value.msgs.push({ id: uid(), time: now(), from: 'user', type: 'text', content: (at ? `@${cname(at)} ` : '') + text })
  scrollBottom()
  sending.value = true
  try { await groupReply(group.value, at) } catch (e) { group.value.msgs.push({ id: uid(), time: now(), from: 'sys', content: '⚠ ' + e.message }) }
  sending.value = false
  group.value.unread = 0
  scrollBottom()
}

/* 投票 */
const showVote = ref(false)
const voteForm = ref({ title: '', options: '' })
function createVote() {
  const opts = voteForm.value.options.split(/\n|,/).map(s => s.trim()).filter(Boolean)
  if (!voteForm.value.title.trim() || opts.length < 2) return showToast('标题和至少2个选项')
  const vote = { id: uid(), title: voteForm.value.title, options: opts.map(o => ({ text: o, voters: [] })) }
  group.value.msgs.push({ id: uid(), time: now(), from: 'user', type: 'vote', vote })
  showVote.value = false
  voteForm.value = { title: '', options: '' }
  send(null)
}
function castVote(m, oi) {
  if (m.vote.options[oi].voters.includes('user')) return
  m.vote.options[oi].voters.push('user')
  for (const mid of group.value.members) {
    if (Math.random() < 0.5 && !m.vote.options.some(o => o.voters.includes(mid))) {
      m.vote.options[Math.floor(Math.random() * m.vote.options.length)].voters.push(mid)
    }
  }
}

/* 接龙 */
function startRelay() {
  const first = prompt('接龙开头（如：#接龙\\n1. 周末爬山 报名）', '#接龙\n1. ')
  if (!first) return
  group.value.msgs.push({ id: uid(), time: now(), from: 'user', type: 'relay', content: first })
  send(null)
}

/* 转账/红包 */
function transfer() {
  const amt = Number(prompt('转账金额（虚拟币）', '20'))
  if (!amt || amt <= 0) return
  if (!payCoins(amt, '群转账')) return showToast('余额不足')
  group.value.msgs.push({ id: uid(), time: now(), from: 'user', type: 'transfer', content: amt })
  send(null)
}
function redPacket(lucky) {
  const amt = Number(prompt(lucky ? '拼手气红包总额（虚拟币）' : '专属红包金额（虚拟币）', '50'))
  if (!amt || amt <= 0) return
  if (!payCoins(amt, '群红包')) return showToast('余额不足')
  group.value.msgs.push({ id: uid(), time: now(), from: 'user', type: 'redpacket', content: amt, lucky: !!lucky, target: lucky ? null : group.value.members[0] })
  send(null)
}
function grabRP(m) {
  if (m.grabbed) return
  m.grabbed = true
  const amt = Math.max(1, Math.round(m.content * (m.lucky ? Math.random() * 0.6 + 0.2 : 1)))
  wallet().coins += amt
  group.value.msgs.push({ id: uid(), time: now(), from: 'sys', content: `你领取了 ${amt} 币红包` })
}

/* 群设置 */
function addMember() {
  const avail = S.chars.filter(c => !group.value.members.includes(c.id))
  if (!avail.length) return showToast('没有可添加的角色')
  const names = avail.map((c, i) => `${i + 1}.${c.name}`).join(' ')
  const n = Number(prompt('添加成员，输入编号：\n' + names))
  if (n >= 1 && avail[n - 1]) group.value.members.push(avail[n - 1].id)
}
function toggleAdmin(cid) {
  group.value.admins = group.value.admins || []
  const i = group.value.admins.indexOf(cid)
  if (i > -1) group.value.admins.splice(i, 1); else group.value.admins.push(cid)
}
function toggleBan(cid) {
  group.value.banned = group.value.banned || {}
  group.value.banned[cid] = !group.value.banned[cid]
}
function removeMember(cid) {
  group.value.members = group.value.members.filter(m => m !== cid)
}
function createGroupBook() {
  openPage('WorldBook')
}
const panelItems = [
  { k: 'vote', icon: '📊', label: '投票' }, { k: 'relay', icon: '🔗', label: '接龙' },
  { k: 'transfer', icon: '💸', label: '转账' }, { k: 'rp', icon: '🧧', label: '红包' },
  { k: 'lucky', icon: '🎁', label: '手气红包' }
]
function panelClick(k) {
  showPanel.value = false
  if (k === 'vote') showVote.value = true
  else if (k === 'relay') startRelay()
  else if (k === 'transfer') transfer()
  else if (k === 'rp') redPacket(false)
  else if (k === 'lucky') redPacket(true)
}
</script>

<template>
  <div class="page" v-if="group">
    <div class="topbar">
      <button class="tb-btn tb-back" @click="closePage">‹</button>
      <div class="grow">
        <div style="font-weight:600;font-size:16px">{{ group.name }} <span class="muted" style="font-size:11px">({{ group.members.length + 1 }})</span></div>
        <div class="muted line1" style="font-size:10px">{{ group.intro }}</div>
      </div>
      <button class="tb-btn" @click="showMore = true">
        <svg class="icon24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.5a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/></svg>
      </button>
    </div>

    <div class="body" ref="bodyRef" style="padding:12px">
      <div v-for="m in group.msgs" :key="m.id" class="msg-row" :class="{ mine: m.from === 'user', sys: m.from === 'sys' }">
        <div v-if="m.from === 'sys'" class="sys-line">{{ m.content }}</div>
        <template v-else>
          <div class="avatar msg-av">
            <img v-if="cavatar(m.from)" :src="cavatar(m.from)" /><span v-else class="ph">{{ cname(m.from)[0] }}</span>
          </div>
          <div class="msg-col">
            <div class="muted" style="font-size:10px;margin-bottom:2px">{{ cname(m.from) }} {{ fmtTime(m.time) }}</div>
            <div v-if="m.type === 'text'" class="bubble">{{ m.content }}</div>
            <div v-else-if="m.type === 'vote'" class="bubble vote-b">
              <b>📊 {{ m.vote.title }}</b>
              <div v-for="(o, oi) in m.vote.options" :key="oi" class="vote-opt" @click="castVote(m, oi)">
                <span>{{ o.text }}</span><span class="muted">{{ o.voters.length }}票</span>
              </div>
            </div>
            <div v-else-if="m.type === 'relay'" class="bubble" style="white-space:pre-wrap">{{ m.content }}</div>
            <div v-else-if="m.type === 'transfer'" class="bubble money-b">💸 转账 {{ m.content }} 币</div>
            <div v-else-if="m.type === 'redpacket'" class="bubble money-b" @click="grabRP(m)">
              🧧 {{ m.lucky ? '拼手气红包' : '专属红包' }} {{ m.content }} 币<br /><span style="font-size:11px;opacity:.8">{{ m.grabbed ? '已领取' : '点击领取' }}</span>
            </div>
            <div v-if="m.heart" class="heart-line">💭 {{ m.heart }}</div>
          </div>
        </template>
      </div>
      <div v-if="sending" class="msg-row"><div class="bubble loading-b"><span class="loading-dots"></span></div></div>
      <div style="height:10px"></div>
    </div>

    <div class="input-bar">
      <button class="tb-btn" style="font-size:20px" @click="showAt = true">@</button>
      <button class="tb-btn" @click="showPanel = !showPanel" style="font-size:22px">＋</button>
      <textarea v-model="input" rows="1" class="chat-input" placeholder="群聊说点什么..." @keydown.enter.exact.prevent="send(atTarget)"></textarea>
      <button class="send-btn" @click="send(atTarget)">↑</button>
    </div>

    <div v-if="showPanel" class="plus-panel">
      <div v-for="it in panelItems" :key="it.k" class="plus-item" @click="panelClick(it.k)">
        <div class="pi-icon">{{ it.icon }}</div><div style="font-size:11px">{{ it.label }}</div>
      </div>
    </div>

    <!-- @选择 -->
    <div v-if="showAt" class="sheet-mask" @click.self="showAt = false">
      <div class="sheet"><div class="sheet-t">@成员</div>
        <div class="m-item" @click="showAt = false"><span class="grow">取消@</span></div>
        <div v-for="cid in group.members" :key="cid" class="m-item" @click="atTarget = cid; showAt = false">
          <div class="avatar" style="width:30px;height:30px"><img v-if="cavatar(cid)" :src="cavatar(cid)" /><span v-else class="ph">{{ cname(cid)[0] }}</span></div>
          {{ cname(cid) }}
        </div>
      </div>
    </div>

    <!-- 投票创建 -->
    <div v-if="showVote" class="mask" @click.self="showVote = false">
      <div class="modal">
        <div class="modal-t">发起投票</div>
        <div class="f-lab">投票标题</div>
        <input v-model="voteForm.title" placeholder="如：周末去哪玩" style="margin-bottom:10px" />
        <div class="f-lab">选项（每行一个）</div>
        <textarea v-model="voteForm.options" rows="3" placeholder="爬山\n看电影\n宅家"></textarea>
        <div class="modal-f">
          <button class="btn-ghost grow" @click="showVote = false">取消</button>
          <button class="btn-main" style="height:36px" @click="createVote">发起</button>
        </div>
      </div>
    </div>

    <!-- 群设置 -->
    <div v-if="showMore" class="sheet-mask" @click.self="showMore = false">
      <div class="sheet" style="height:80%">
        <div class="sheet-t">群聊设置 · {{ group.name }}</div>
        <div class="sheet-b">
          <div class="f-lab">成员管理（点击名字操作）</div>
          <div v-for="cid in group.members" :key="cid" class="card" style="margin:6px 0;padding:10px">
            <div class="row">
              <div class="avatar" style="width:32px;height:32px"><img v-if="cavatar(cid)" :src="cavatar(cid)" /><span v-else class="ph">{{ cname(cid)[0] }}</span></div>
              <b style="font-size:14px">{{ cname(cid) }}</b>
              <span class="tag hot" v-if="group.admins?.includes(cid)">管理员</span>
              <span class="tag" v-if="group.banned?.[cid]">已禁言</span>
              <span class="grow"></span>
              <button class="btn-mini" @click="toggleAdmin(cid)">管理员</button>
              <button class="btn-mini" @click="toggleBan(cid)">禁言</button>
              <button class="btn-mini warn" @click="removeMember(cid)">移除</button>
            </div>
          </div>
          <button class="btn-ghost mt8" style="width:100%" @click="addMember">＋ 添加成员</button>

          <div class="f-lab mt12">记忆注入条数：{{ group.settings?.injectN || S.settings.injectN }} 条</div>
          <input type="range" min="1" max="200" :value="group.settings?.injectN || S.settings.injectN" @input="group.settings = group.settings || {}; group.settings.injectN = Number($event.target.value)" style="width:100%" />

          <div class="f-lab mt12">我的身份（面具）</div>
          <div class="chips">
            <span v-for="m in S.user.masks" :key="m.id" class="chip" :class="{ on: group.settings?.maskId === m.id }" @click="group.settings = group.settings || {}; group.settings.maskId = m.id">{{ m.name }}</span>
          </div>

          <div class="f-lab mt12">关联世界书</div>
          <div class="chips">
            <span v-for="b in S.books" :key="b.id" class="chip" :class="{ on: group.settings?.bookIds?.includes(b.id) }" @click="group.settings = group.settings || {}; group.settings.bookIds = group.settings.bookIds || []; const i = group.settings.bookIds.indexOf(b.id); i > -1 ? group.settings.bookIds.splice(i, 1) : group.settings.bookIds.push(b.id)">{{ b.name }}</span>
            <span v-if="!S.books.length" class="muted">暂无世界书</span>
          </div>

          <div class="f-lab mt12">表情包分组绑定</div>
          <div class="chips">
            <span v-for="g in S.stickers" :key="g.id" class="chip" :class="{ on: group.settings?.stickerGroup === g.id }" @click="group.settings = group.settings || {}; group.settings.stickerGroup = g.id">{{ g.name }}</span>
          </div>

          <div class="row mt12"><span class="grow">跟随角色状态与作息</span><div class="switch" :class="{ on: group.settings?.followStatus }" @click="group.settings = group.settings || {}; group.settings.followStatus = !group.settings.followStatus"></div></div>
          <div class="row mt8"><span class="grow">群记忆（与成员记忆互通）</span><span class="muted">{{ getMemories(group.members[0], 'online').length }}条</span></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.msg-row { display: flex; gap: 8px; margin-bottom: 14px; }
.msg-row.mine { flex-direction: row-reverse; }
.msg-row.sys { justify-content: center; }
.sys-line { font-size: 11px; color: var(--sub); background: rgba(128,128,128,.12); padding: 3px 10px; border-radius: 10px; }
.msg-av { width: 34px; height: 34px; }
.msg-col { max-width: 75%; }
.mine .msg-col { display: flex; flex-direction: column; align-items: flex-end; }
.bubble { background: var(--bubble-char); color: var(--bubble-char-text); border-radius: var(--bubble-radius); border-top-left-radius: 4px; padding: 9px 12px; font-size: var(--font-bubble); line-height: 1.55; word-break: break-word; display: inline-block; }
.mine .bubble { background: var(--bubble-user); color: var(--bubble-user-text); border-radius: var(--bubble-radius); border-top-right-radius: 4px; }
.vote-b { min-width: 180px; }
.vote-opt { display: flex; justify-content: space-between; padding: 7px 10px; margin-top: 6px; background: rgba(128,128,128,.12); border-radius: 8px; cursor: pointer; font-size: 13px; }
.money-b { background: #b98a4a; color: #fff; cursor: pointer; }
.heart-line { font-size: 11px; color: var(--sub); margin-top: 4px; font-style: italic; }
.input-bar { display: flex; align-items: flex-end; gap: 6px; padding: 8px 10px; background: var(--card); border-top: 1px solid var(--border); flex-shrink: 0; }
.chat-input { flex: 1; height: 40px; min-height: 40px; border-radius: 20px; padding: 9px 14px; font-size: 14px; line-height: 1.4; }
.send-btn { width: 36px; height: 36px; border-radius: 50%; background: var(--accent); color: var(--accent-text); font-size: 18px; }
.plus-panel { display: flex; gap: 14px; padding: 14px 18px; background: var(--card); border-top: 1px solid var(--border); flex-shrink: 0; }
.plus-item { display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; font-size: 11px; width: 52px; }
.pi-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--card2); display: flex; align-items: center; justify-content: center; font-size: 20px; }
.loading-b { padding: 12px 18px; }
</style>
