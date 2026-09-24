<script setup>
import { S, showToast, uid, now, wallet, gainCoins, payCoins, nav } from '../core/store'
import { pickFile, readAsDataURL, compressImage, relTime } from '../core/util'
import { ref, computed } from 'vue'

const editProfile = ref(false)
const showMasks = ref(false)
const showWallet = ref(false)
const showStickers = ref(false)
const form = ref({ nickname: '', sign: '', avatar: '' })
const newMask = ref({ name: '', desc: '', color: '#888' })
const sgForm = ref({ name: '', desc: '' })
const urlImport = ref('')
const jsonImport = ref('')
const sgSel = computed(() => S.stickers.find(g => g.id === stickerTab.value))
const stickerTab = ref(S.stickers[0]?.id)
const multiSel = ref([])

function openEdit() {
  form.value = { nickname: S.user.nickname, sign: S.user.sign, avatar: S.user.avatar }
  editProfile.value = true
}
async function pickAvatar() {
  const f = await pickFile('image/*')
  if (f) form.value.avatar = await compressImage(f, 300)
}
function saveProfile() {
  S.user.nickname = form.value.nickname || '我'
  S.user.sign = form.value.sign
  S.user.avatar = form.value.avatar
  editProfile.value = false
}
function addMask() {
  if (!newMask.value.name.trim()) return showToast('填写面具名')
  S.user.masks.push({ id: uid(), ...newMask.value })
  newMask.value = { name: '', desc: '', color: '#888' }
}
function delMask(m) {
  if (m.id === 'm0') return showToast('默认面具不可删除')
  if (confirm(`删除面具「${m.name}」？其钱包资产将保留`)) S.user.masks = S.user.masks.filter(x => x.id !== m.id)
}
function switchMask(m) {
  S.user.activeMask = m.id
  showToast(`已切换为「${m.name}」`)
}
const curWallet = computed(() => wallet())
function dailySign() {
  const today = new Date().toDateString()
  if (S.user.lastSign === today) return showToast('今日已签到')
  const streak = (new Date(S.user.lastSign).toDateString() === new Date(Date.now() - 86400000).toDateString()) ? S.user.signStreak + 1 : 1
  S.user.signStreak = streak
  S.user.lastSign = today
  const gain = 5 + Math.min(streak, 7) * 2
  gainCoins(gain, `每日签到（连续${streak}天）`)
  showToast(`签到成功 +${gain}币`)
}

/* 表情包 */
async function importImages() {
  const files = await pickFile('image/*', true)
  if (!files?.length || !sgSel.value) return
  for (const f of files) {
    const url = await compressImage(f, 200)
    sgSel.value.items.push({ id: uid(), name: f.name.slice(0, 12), url })
  }
  showToast(`已导入${files.length}张`)
}
function importUrls() {
  const urls = urlImport.value.split(/\n|\s+/).filter(u => u.startsWith('http'))
  if (!urls.length || !sgSel.value) return showToast('未检测到有效URL')
  urls.forEach(u => sgSel.value.items.push({ id: uid(), name: '网络表情', url: u }))
  urlImport.value = ''
  showToast(`已导入${urls.length}张`)
}
function importUrlsByPrompt() {
  urlImport.value = prompt('每行一个图片URL：') || ''
  if (urlImport.value) importUrls()
}
function importJsonByPrompt() {
  jsonImport.value = prompt('粘贴JSON数组 [{name,url}]：') || ''
  if (jsonImport.value) importJson()
}
function importJson() {
  try {
    const arr = JSON.parse(jsonImport.value)
    if (!Array.isArray(arr) || !sgSel.value) throw new Error('格式错误')
    arr.forEach(x => sgSel.value.items.push({ id: uid(), name: x.name || 'JSON表情', url: x.url || '', emoji: x.emoji }))
    showToast(`已导入${arr.length}条`)
    jsonImport.value = ''
  } catch (e) { showToast('JSON解析失败') }
}
function exportStickers() {
  const data = JSON.stringify(S.stickers, null, 2)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([data]))
  a.download = 'stickers.json'; a.click()
}
function dedupe() {
  if (!sgSel.value) return
  const seen = new Set()
  const before = sgSel.value.items.length
  sgSel.value.items = sgSel.value.items.filter(i => {
    if (!i.url) return true
    if (seen.has(i.url)) return false
    seen.add(i.url); return true
  })
  showToast(`清理了${before - sgSel.value.items.length}张重复`)
}
function toggleSel(sid) {
  const i = multiSel.value.indexOf(sid)
  if (i > -1) multiSel.value.splice(i, 1); else multiSel.value.push(sid)
}
function delSelected() {
  if (!sgSel.value || !multiSel.value.length) return
  sgSel.value.items = sgSel.value.items.filter(i => !multiSel.value.includes(i.id))
  multiSel.value = []
}
function moveSelected() {
  if (!sgSel.value || !multiSel.value.length) return
  const target = prompt('移动到哪个分组？\n' + S.stickers.map((g, i) => `${i + 1}.${g.name}`).join(' '))
  const g = S.stickers[Number(target) - 1]
  if (!g) return
  const moved = sgSel.value.items.filter(i => multiSel.value.includes(i.id))
  sgSel.value.items = sgSel.value.items.filter(i => !multiSel.value.includes(i.id))
  g.items.push(...moved)
  multiSel.value = []
}
function addStickerGroup() {
  if (!sgForm.value.name.trim()) return showToast('填写分组名')
  S.stickers.push({ id: uid(), ...sgForm.value, items: [] })
  stickerTab.value = S.stickers[S.stickers.length - 1].id
  sgForm.value = { name: '', desc: '' }
}
const totalItems = computed(() => S.stickers.reduce((a, g) => a + g.items.length, 0))
</script>

<template>
  <div class="page">
    <div class="body">
      <!-- 个人卡片 -->
      <div class="card" style="margin:12px;display:flex;gap:14px;align-items:center;cursor:pointer" @click="openEdit">
        <div class="avatar" style="width:64px;height:64px">
          <img v-if="S.user.avatar" :src="S.user.avatar" /><span v-else class="ph" style="font-size:26px">{{ S.user.nickname[0] }}</span>
        </div>
        <div class="grow">
          <div style="font-size:20px;font-weight:700">{{ S.user.nickname }}</div>
          <div class="muted mt8">{{ S.user.sign || '写个签名吧' }}</div>
          <div class="muted mt8">面具：{{ S.user.masks.find(m => m.id === S.user.activeMask)?.name }} · 连签{{ S.user.signStreak }}天</div>
        </div>
      </div>

      <div class="cell" @click="showMasks = true"><span style="font-size:20px">🎭</span><div class="ginfo"><div class="t1">面具管理</div><div class="t2">{{ S.user.masks.length }}个身份 · 不同身份不同关系</div></div><span class="muted">›</span></div>
      <div class="cell" @click="showWallet = true"><span style="font-size:20px">👛</span><div class="ginfo"><div class="t1">钱包</div><div class="t2">{{ curWallet.coins }} 币 · {{ curWallet.logs.length }}条记录</div></div><span class="muted">›</span></div>
      <div class="cell" @click="showStickers = true"><span style="font-size:20px">😀</span><div class="ginfo"><div class="t1">表情包管理</div><div class="t2">{{ S.stickers.length }}个分组 · 共{{ totalItems }}张</div></div><span class="muted">›</span></div>
      <div class="cell" @click="nav.tab = 'settings'"><span style="font-size:20px">⚙️</span><div class="ginfo"><div class="t1">设置</div><div class="t2">API / 主题 / 字体 / 备份</div></div><span class="muted">›</span></div>
      <div style="height:120px"></div>
    </div>

    <!-- 编辑资料 -->
    <div v-if="editProfile" class="mask" @click.self="editProfile = false">
      <div class="modal">
        <div class="modal-t">编辑个人信息</div>
        <div class="row" style="margin-bottom:12px">
          <div class="avatar" style="width:64px;height:64px;cursor:pointer" @click="pickAvatar">
            <img v-if="form.avatar" :src="form.avatar" /><span v-else class="ph" style="font-size:22px">＋</span>
          </div>
          <div class="grow">
            <input v-model="form.nickname" placeholder="昵称" style="margin-bottom:8px" />
            <input v-model="form.sign" placeholder="签名" />
          </div>
        </div>
        <div class="modal-f">
          <button class="btn-ghost grow" @click="editProfile = false">取消</button>
          <button class="btn-main" style="height:36px" @click="saveProfile">保存</button>
        </div>
      </div>
    </div>

    <!-- 面具 -->
    <div v-if="showMasks" class="mask" @click.self="showMasks = false">
      <div class="modal" style="height:75%">
        <div class="modal-t">面具管理</div>
        <div class="modal-b">
          <div v-for="m in S.user.masks" :key="m.id" class="card" style="margin:6px 0;padding:12px">
            <div class="row">
              <span style="width:14px;height:14px;border-radius:50%;flex-shrink:0" :style="{ background: m.color }"></span>
              <b>{{ m.name }}</b>
              <span class="tag" v-if="m.id === S.user.activeMask">使用中</span>
              <span class="grow"></span>
              <button class="btn-mini" @click="switchMask(m)">切换</button>
              <button class="btn-mini warn" @click="delMask(m)">删除</button>
            </div>
            <div class="muted mt8">{{ m.desc }}</div>
          </div>
          <div class="card" style="margin-top:12px">
            <div class="f-lab">添加新面具</div>
            <input v-model="newMask.name" placeholder="面具名（如：温柔学姐）" style="margin-bottom:8px" />
            <input v-model="newMask.desc" placeholder="描述：对应什么角色关系" style="margin-bottom:8px" />
            <div class="row"><input type="color" v-model="newMask.color" style="width:48px;height:32px;padding:2px" /><button class="btn-main grow" style="height:36px" @click="addMask">添加</button></div>
          </div>
        </div>
        <div class="modal-f"><button class="btn-ghost grow" @click="showMasks = false">关闭</button></div>
      </div>
    </div>

    <!-- 钱包 -->
    <div v-if="showWallet" class="mask" @click.self="showWallet = false">
      <div class="modal" style="height:75%">
        <div class="modal-t">钱包 · {{ S.user.masks.find(m => m.id === S.user.activeMask)?.name }}</div>
        <div class="modal-b">
          <div class="center" style="padding:16px">
            <div style="font-size:34px;font-weight:700">{{ curWallet.coins }}</div>
            <div class="muted">虚拟币</div>
            <div class="row mt12" style="justify-content:center;gap:10px">
              <button class="btn-ghost" @click="dailySign">每日签到</button>
            </div>
          </div>
          <div class="f-lab" style="padding:0 8px">各面具资产</div>
          <div class="row" style="flex-wrap:wrap;gap:8px;padding:0 8px;margin-bottom:10px">
            <span v-for="m in S.user.masks" :key="m.id" class="tag">{{ m.name }}: {{ (S.user.wallets[m.id]?.coins || 0) }}币</span>
          </div>
          <div class="f-lab" style="padding:0 8px">消费记录</div>
          <div v-for="(l, i) in curWallet.logs" :key="i" class="m-item">
            <span class="grow" style="font-size:13px">{{ l.desc }}</span>
            <span :style="{ color: l.amount > 0 ? '#4cd964' : '#ff6b6b' }">{{ l.amount > 0 ? '+' : '' }}{{ l.amount }}</span>
            <span class="muted" style="font-size:10px;width:52px;text-align:right">{{ relTime(l.t) }}</span>
          </div>
          <div v-if="!curWallet.logs.length" class="empty">暂无记录</div>
        </div>
        <div class="modal-f"><button class="btn-ghost grow" @click="showWallet = false">关闭</button></div>
      </div>
    </div>

    <!-- 表情包 -->
    <div v-if="showStickers" class="mask" @click.self="showStickers = false">
      <div class="modal" style="height:88%">
        <div class="modal-t">表情包管理</div>
        <div class="modal-b">
          <div class="chips" style="margin-bottom:10px">
            <span v-for="g in S.stickers" :key="g.id" class="chip" :class="{ on: stickerTab === g.id }" @click="stickerTab = g.id; multiSel = []">{{ g.name }}({{ g.items.length }})</span>
          </div>
          <div v-if="sgSel" class="card" style="margin:0 0 10px">
            <div class="f-lab">分组名与描述（描述帮助AI理解使用场景）</div>
            <input v-model="sgSel.name" style="margin-bottom:8px" />
            <input v-model="sgSel.desc" placeholder="如：委屈/开心/无语 时使用" />
          </div>
          <div class="row" style="flex-wrap:wrap;gap:8px;margin-bottom:10px">
            <button class="btn-mini" @click="importImages">单图/批量导入</button>
            <button class="btn-mini" @click="importUrlsByPrompt">批量URL导入</button>
            <button class="btn-mini" @click="importJsonByPrompt">JSON导入</button>
            <button class="btn-mini" @click="exportStickers">导出JSON</button>
            <button class="btn-mini" @click="dedupe">查重清理</button>
            <button class="btn-mini" @click="multiSel.length ? delSelected() : showToast('先长按/点击图片多选')">{{ multiSel.length ? `删除(${multiSel.length})` : '多选删除' }}</button>
            <button class="btn-mini" @click="moveSelected">移动分组</button>
          </div>
          <div class="sticker-mgr-grid">
            <div v-for="s in sgSel?.items || []" :key="s.id" class="sm-item" :class="{ sel: multiSel.includes(s.id) }" @click="toggleSel(s.id)">
              <img v-if="s.url" :src="s.url" /><span v-else style="font-size:28px">{{ s.emoji || '🙂' }}</span>
            </div>
          </div>
          <div v-if="sgSel && !sgSel.items.length" class="empty">该分组暂无表情</div>
          <div class="card" style="margin-top:12px">
            <div class="f-lab">新建分组</div>
            <input v-model="sgForm.name" placeholder="分组名" style="margin-bottom:8px" />
            <input v-model="sgForm.desc" placeholder="描述（供AI理解）" style="margin-bottom:8px" />
            <button class="btn-main" style="height:36px" @click="addStickerGroup">创建</button>
          </div>
        </div>
        <div class="modal-f"><button class="btn-ghost grow" @click="showStickers = false">完成</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sticker-mgr-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.sm-item { aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: var(--card2); display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid transparent; }
.sm-item img { width: 100%; height: 100%; object-fit: cover; }
.sm-item.sel { border-color: var(--accent); }
</style>
