<script setup>
import { S, getChat, openPage, showToast, uid, now, persist } from '../core/store'
import { relTime, pickFile, readAsDataURL, compressImage } from '../core/util'
import { simpleAsk } from '../core/engine'
import { ref, computed } from 'vue'

const kw = ref('')
const showMenu = ref(null) // charId
const showCreate = ref(false)
const showAIGen = ref(false)
let pressTimer = null

const pinned = computed(() => S.chars.filter(c => getChat(c.id).pinned))
const specials = computed(() => S.chars.filter(c => !getChat(c.id).pinned && getChat(c.id).special))
const normals = computed(() => S.chars.filter(c => !getChat(c.id).pinned && !getChat(c.id).special))
const lastMsg = cid => { const m = getChat(cid).msgs; return m[m.length - 1] }
const filtered = list => kw.value ? list.filter(c => c.name.includes(kw.value) || (c.note || '').includes(kw.value)) : list

function startPress(e, cid) {
  pressTimer = setTimeout(() => { showMenu.value = cid; pressTimer = null }, 500)
}
function cancelPress() { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null } }
function enterChat(c) {
  getChat(c.id).unread = 0
  openPage('ChatDetail', { charId: c.id })
}
function delChat(c) {
  const i = S.chars.findIndex(x => x.id === c.id)
  if (confirm(`删除与「${c.name}」的聊天？角色也会一并移除`)) {
    S.chars.splice(i, 1); delete S.chats[c.id]
    showMenu.value = null
  }
}
function toggleSpecial(c) { getChat(c.id).special = !getChat(c.id).special; showMenu.value = null }
function togglePin(c) { getChat(c.id).pinned = !getChat(c.id).pinned; showMenu.value = null }

/* 创建角色 */
const form = ref({ name: '', note: '', avatar: '', persona: '', greeting: '', books: [], birthday: '', relation: '' })
async function pickAvatar() {
  const f = await pickFile('image/*')
  if (f) form.value.avatar = await compressImage(f, 300)
}
function saveChar() {
  if (!form.value.name.trim()) return showToast('请填写姓名')
  const c = {
    id: uid(), name: form.value.name.trim(), note: form.value.note, avatar: form.value.avatar,
    persona: form.value.persona, greeting: form.value.greeting, books: [...form.value.books],
    birthday: form.value.birthday, relation: form.value.relation,
    sign: '', status: '在线', group: '好友', devicePass: String(Math.floor(100000 + Math.random() * 900000)),
    emotion: '', schedule: '', scheduleItems: []
  }
  S.chars.push(c)
  if (form.value.greeting) {
    getChat(c.id).msgs.push({ id: uid(), time: now(), from: 'char', type: 'text', content: form.value.greeting })
  }
  showCreate.value = false
  form.value = { name: '', note: '', avatar: '', persona: '', greeting: '', books: [], birthday: '', relation: '' }
  showToast('角色已创建')
}

/* AI 生成角色 */
const aiForm = ref({ pref: '', world: '', count: 3 })
const aiGening = ref(false)
const aiResults = ref([])
async function aiGen() {
  if (!aiForm.value.pref.trim()) return showToast('先描述你的偏好')
  aiGening.value = true
  try {
    const raw = await simpleAsk(
      '你是角色生成器。根据用户偏好与世界观，生成角色列表。只输出JSON数组：[{"name":"名字","note":"一句话备注","persona":"详细人设(200字内,性格/背景/说话风格)","greeting":"符合人设的开场白(微信第一句)","relation":"与用户的关系标签"}]',
      `偏好：${aiForm.value.pref}\n世界观：${aiForm.value.world || '自由发挥'}\n数量：${aiForm.value.count}`,
      { maxTokens: 2000 })
    aiResults.value = JSON.parse(raw.match(/\[[\s\S]*\]/)[0])
  } catch (e) { showToast('生成失败: ' + e.message.slice(0, 60)) }
  aiGening.value = false
}
function adopt(r) {
  const c = {
    id: uid(), name: r.name, note: r.note, avatar: '', persona: r.persona, greeting: r.greeting,
    books: [], birthday: '', relation: r.relation, sign: '', status: '在线', group: '好友',
    devicePass: String(Math.floor(100000 + Math.random() * 900000)), emotion: '', schedule: '', scheduleItems: []
  }
  S.chars.push(c)
  if (r.greeting) getChat(c.id).msgs.push({ id: uid(), time: now(), from: 'char', type: 'text', content: r.greeting })
  aiResults.value = aiResults.value.filter(x => x !== r)
  showToast('已添加「' + r.name + '」')
}
</script>

<template>
  <div class="page">
    <div class="topbar" style="padding-right:6px">
      <div class="searchbar">
        <svg class="icon16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--sub)"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input v-model="kw" placeholder="搜索角色" />
      </div>
      <button class="tb-btn" @click="showCreate = true" style="font-size:22px">＋</button>
    </div>

    <div class="body">
      <div v-if="!S.chars.length && !S.groups.length" class="empty">
        还没有角色<br /><br />
        <button class="btn-main" style="width:auto;padding:0 30px" @click="showCreate = true">创建第一个角色</button>
      </div>

      <template v-for="(list, label) in { '置顶': filtered(pinned), '特别关心': filtered(specials), '': filtered(normals) }">
        <template v-if="list.length">
          <div class="section-t" v-if="label">{{ label }}</div>
          <div v-for="c in list" :key="c.id" class="cell" @pointerdown="startPress($event, c.id)" @pointerup="cancelPress" @pointerleave="cancelPress" @contextmenu.prevent="showMenu = c.id" @click="enterChat(c)">
            <div class="avatar" :style="{ borderRadius: S.theme.bubble.avatarShape === 'square' ? '0' : S.theme.bubble.avatarShape === 'r8' ? '8px' : '50%' }">
              <img v-if="c.avatar" :src="c.avatar" />
              <span v-else class="ph">{{ c.name[0] }}</span>
            </div>
            <div class="ginfo">
              <div class="t1">{{ c.name }} <span class="tag" v-if="c.relation">{{ c.relation }}</span><span class="tag" v-if="c.emotion && S.settings.emotion">{{ c.emotion }}</span></div>
              <div class="t2">{{ lastMsg(c.id)?.content?.slice(0, 30) || '开始对话吧' }}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">
              <span class="time-r" v-if="lastMsg(c.id)">{{ relTime(lastMsg(c.id).time) }}</span>
              <span class="badge" v-if="getChat(c.id).unread">{{ getChat(c.id).unread }}</span>
            </div>
          </div>
        </template>
      </template>

      <template v-if="S.groups.filter(g => !kw.value || g.name.includes(kw)).length">
        <div class="section-t">群聊</div>
        <div v-for="g in S.groups.filter(g => !kw || g.name.includes(kw))" :key="g.id" class="cell" @click="getChat(g.id).unread = 0; openPage('GroupChat', { groupId: g.id })">
          <div class="avatar">
            <img v-if="g.avatar" :src="g.avatar" />
            <span v-else class="ph" style="font-size:12px;display:grid;grid-template-columns:1fr 1fr;gap:1px;width:100%;height:100%">
              <template v-for="m in g.members.slice(0, 4)"><img v-if="S.chars.find(c => c.id === m)?.avatar" :src="S.chars.find(c => c.id === m).avatar" style="width:100%;height:100%;object-fit:cover" /><span v-else style="background:var(--card2);width:100%;display:flex;align-items:center;justify-content:center;font-size:9px">{{ S.chars.find(c => c.id === m)?.name?.[0] || '?' }}</span></template>
            </span>
          </div>
          <div class="ginfo">
            <div class="t1">{{ g.name }}</div>
            <div class="t2">{{ g.msgs.length ? g.msgs[g.msgs.length - 1].content.slice(0, 30) : (g.intro || '群聊') }}</div>
          </div>
          <span class="badge" v-if="g.unread">{{ g.unread }}</span>
        </div>
      </template>
      <div style="height:80px"></div>
    </div>

    <!-- 长按菜单 -->
    <div v-if="showMenu" class="mask" @click.self="showMenu = null">
      <div class="modal" style="max-width:280px;padding:8px">
        <div class="m-item" @click="togglePin(S.chars.find(c => c.id === showMenu))">{{ getChat(showMenu).pinned ? '取消置顶' : '置顶' }}</div>
        <div class="m-item" @click="toggleSpecial(S.chars.find(c => c.id === showMenu))">{{ getChat(showMenu).special ? '取消特别关心' : '设为特别关心' }}</div>
        <div class="m-item" @click="openPage('Profile', { charId: showMenu }); showMenu = null">编辑人设</div>
        <div class="m-item" style="color:#ff6b6b" @click="delChat(S.chars.find(c => c.id === showMenu))">删除聊天</div>
      </div>
    </div>

    <!-- 创建角色 -->
    <div v-if="showCreate" class="mask" @click.self="showCreate = false">
      <div class="modal" style="height:86%">
        <div class="modal-t">创建角色</div>
        <div class="modal-b">
          <div class="row" style="margin-bottom:14px">
            <div class="avatar" style="width:64px;height:64px;cursor:pointer" @click="pickAvatar">
              <img v-if="form.avatar" :src="form.avatar" />
              <span v-else class="ph" style="font-size:24px">＋</span>
            </div>
            <div class="grow">
              <input v-model="form.name" placeholder="姓名 *（必填）" style="margin-bottom:8px" />
              <input v-model="form.note" placeholder="备注" />
            </div>
          </div>
          <div class="row" style="margin-bottom:8px">
            <div class="grow"><div class="f-lab">生日</div><input v-model="form.birthday" type="date" /></div>
            <div class="grow"><div class="f-lab">关系标签</div><input v-model="form.relation" placeholder="如：青梅竹马" /></div>
          </div>
          <div class="f-lab">角色设定（人设长文本）</div>
          <textarea v-model="form.persona" rows="6" placeholder="性格、背景、说话风格、与用户的关系..." style="margin-bottom:12px"></textarea>
          <div class="f-lab">开场白</div>
          <textarea v-model="form.greeting" rows="2" placeholder="TA的第一条微信消息" style="margin-bottom:12px"></textarea>
          <div class="f-lab">绑定世界书（可多选）</div>
          <div class="chips" style="margin-bottom:12px">
            <span v-for="b in S.books" :key="b.id" class="chip" :class="{ on: form.books.includes(b.id) }" @click="form.books.includes(b.id) ? form.books.splice(form.books.indexOf(b.id), 1) : form.books.push(b.id)">{{ b.name }}</span>
            <span v-if="!S.books.length" class="muted">暂无世界书，可稍后在聊天中挂接</span>
          </div>
          <div class="hint-txt">角色创建时会自动生成一部设备密码（查手机用）。单独 API 可在角色名片页配置。</div>
        </div>
        <div class="modal-f">
          <button class="btn-ghost grow" @click="showCreate = false">取消</button>
          <button class="btn-main" style="height:36px" @click="saveChar">保存</button>
        </div>
      </div>
    </div>

    <!-- AI 生成角色 -->
    <div v-if="showAIGen" class="mask" @click.self="showAIGen = false">
      <div class="modal" style="height:80%">
        <div class="modal-t">AI 生成角色</div>
        <div class="modal-b">
          <div class="f-lab">描述你的偏好</div>
          <textarea v-model="aiForm.pref" rows="2" placeholder="如：温柔年上、会做饭、话少但靠谱" style="margin-bottom:10px"></textarea>
          <div class="f-lab">绑定世界观（可选）</div>
          <textarea v-model="aiForm.world" rows="2" placeholder="现代都市 / 修仙 / 末世..." style="margin-bottom:10px"></textarea>
          <div class="row" style="margin-bottom:10px">
            <span class="muted">数量</span>
            <div class="chips"><span v-for="n in [3, 4, 5]" :key="n" class="chip" :class="{ on: aiForm.count === n }" @click="aiForm.count = n">{{ n }}</span></div>
          </div>
          <button class="btn-main" @click="aiGen" :disabled="aiGening">{{ aiGening ? '生成中...' : 'AI 生成' }}</button>
          <div v-for="(r, i) in aiResults" :key="i" class="card" style="margin:10px 0">
            <div class="row"><b>{{ r.name }}</b><span class="tag">{{ r.relation }}</span><span class="grow"></span><button class="btn-mini" @click="adopt(r)">收下TA</button></div>
            <div class="muted mt8">{{ r.note }}</div>
            <div style="font-size:13px;margin-top:6px;line-height:1.6">{{ r.persona }}</div>
            <div class="muted mt8">开场白：{{ r.greeting }}</div>
          </div>
        </div>
        <div class="modal-f"><button class="btn-ghost grow" @click="showAIGen = false">关闭</button></div>
      </div>
    </div>
  </div>
</template>
