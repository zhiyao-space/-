<script setup>
import { S, closePage, openPage, showToast, getChat } from '../core/store'
import { pickFile, readAsDataURL, compressImage, compressImageLen, hashStr, fmtFull } from '../core/util'
import { simpleAsk } from '../core/engine'
import { ref, computed } from 'vue'

const props = defineProps({ charId: String })
const char = computed(() => S.chars.find(c => c.id === props.charId))
const showEdit = ref(false)
const showArch = ref(false)
const archLoading = ref(false)
const archive = ref(null)
const showCert = ref(false)

const OCCUPATIONS = [
  { key: '学生', id: '学生证', color: '#2b6cb0', extra: '在读学校' },
  { key: '警察', id: '警官证', color: '#8B0000', extra: '警号' },
  { key: '医生', id: '工作证', color: '#2c7a7b', extra: '执业编号' },
  { key: '教师', id: '教师证', color: '#6b46c1', extra: '任教科目' },
  { key: '咖啡师|店员|店长', id: '员工卡', color: '#975a16', extra: '门店' },
  { key: '偶像|歌手|演员', id: '艺人证', color: '#b83280', extra: '经纪公司' },
]
function detectOcc() {
  const p = (char.value.persona || '') + (char.value.note || '')
  for (const o of OCCUPATIONS) {
    if (o.key.split('|').some(k => p.includes(k))) return o
  }
  return { id: '身份卡', color: '#444', extra: '登记信息' }
}
const certNo = computed(() => String(hashStr(char.value.id + char.value.name)).slice(0, 8))

function editPersona() { showEdit.value = true }
async function pickAvatar() {
  const f = await pickFile('image/*')
  if (f) char.value.avatar = await compressImage(f, 300)
}
async function pickBg() {
  const f = await pickFile('image/*')
  if (f) char.value.bg = await compressImageLen(await readAsDataURL(f), 700, 0.7)
}
function setVoice() {
  const v = prompt('设置人声描述（用于TTS参考/展示）', char.value.voice || '清澈温柔')
  if (v !== null) char.value.voice = v
}
function toggleSpecial() {
  getChat(char.value.id).special = !getChat(char.value.id).special
  showToast(getChat(char.value.id).special ? '已设为特别关心' : '已取消特别关心')
}
function viewChat() {
  const chat = getChat(char.value.id)
  chat.unread = 0
  closePage()
  openPage('ChatDetail', { charId: props.charId })
}
async function genArchive() {
  archLoading.value = true
  try {
    const raw = await simpleAsk(
      '根据角色设定生成分层档案，只输出JSON：{"基本信息":"...","性格分析":"...","行为习惯":"...","隐藏面向":"...","关系解读":"..."} 每项80字内',
      `角色：${char.value.name}\n设定：${char.value.persona || '（简单）'}${char.value.relation ? '\n与用户关系：' + char.value.relation : ''}`, { maxTokens: 1200 })
    archive.value = JSON.parse(raw.match(/\{[\s\S]*\}/)[0])
    showArch.value = true
  } catch (e) { showToast('生成失败: ' + e.message.slice(0, 50)) }
  archLoading.value = false
}
function saveEdit() { showEdit.value = false; showToast('已保存') }
</script>

<template>
  <div class="page" v-if="char">
    <div class="body">
      <!-- 背景与头像 -->
      <div class="prof-head" :style="char.bg ? { backgroundImage: `url(${char.bg})` } : { background: 'linear-gradient(160deg, var(--card2), var(--bg))' }">
        <button class="tb-btn tb-back" @click="closePage" style="position:absolute;left:8px;top:8px;z-index:2">‹</button>
        <button class="tb-btn" @click="showEdit = true" style="position:absolute;right:8px;top:8px;z-index:2">
          <svg class="icon24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.5a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/></svg>
        </button>
        <div class="prof-av" @click="pickAvatar">
          <img v-if="char.avatar" :src="char.avatar" /><span v-else class="ph" style="font-size:40px">{{ char.name[0] }}</span>
        </div>
      </div>

      <div class="prof-info">
        <div class="row" style="justify-content:space-between">
          <div>
            <div style="font-size:22px;font-weight:700">{{ char.name }}</div>
            <div class="row mt8" style="gap:6px">
              <span class="tag hot" v-if="char.relation">{{ char.relation }}</span>
              <span class="tag">{{ char.group || '好友' }}</span>
              <span class="tag" v-if="char.birthday">🎂 {{ char.birthday }}</span>
            </div>
          </div>
          <div class="muted" style="text-align:right">设备密码<br /><b style="color:var(--text);font-size:14px">{{ char.devicePass }}</b></div>
        </div>
        <div class="muted mt8">个性签名：{{ char.sign || '这个人很懒，什么都没写' }}</div>
        <div class="muted mt8" v-if="char.note">备注：{{ char.note }}</div>
        <div class="muted mt8" v-if="S.settings.emotion && char.emotion">当前情绪：{{ char.emotion }}</div>
      </div>

      <button class="btn-ghost" style="margin:0 16px;width:calc(100% - 32px)" @click="showCert = true">🪪 角色证件卡（{{ detectOcc().id }}）</button>
      <button class="btn-ghost" style="margin:10px 16px 0;width:calc(100% - 32px)" @click="genArchive" :disabled="archLoading">{{ archLoading ? '档案生成中...' : '🗂 生成角色档案' }}</button>

      <div class="card mt16">
        <div class="f-lab">人设预览</div>
        <div style="font-size:13px;line-height:1.7;white-space:pre-wrap">{{ char.persona || '（未填写）' }}</div>
      </div>
      <div class="card" v-if="char.books?.length">
        <div class="f-lab">绑定世界书</div>
        <div class="chips"><span v-for="bid in char.books" :key="bid" class="chip on">{{ S.books.find(b => b.id === bid)?.name || '?' }}</span></div>
      </div>
      <div style="height:110px"></div>
    </div>

    <div class="prof-bottom">
      <button class="btn-main grow" @click="viewChat">查看聊天</button>
      <button class="btn-ghost" style="height:50px" @click="toggleSpecial">{{ getChat(char.id).special ? '♥ 已关心' : '♡ 特别关心' }}</button>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="showEdit" class="mask" @click.self="showEdit = false">
      <div class="modal" style="height:85%">
        <div class="modal-t">编辑角色</div>
        <div class="modal-b">
          <div class="row" style="margin-bottom:10px">
            <div class="avatar" style="width:56px;height:56px;cursor:pointer" @click="pickAvatar">
              <img v-if="char.avatar" :src="char.avatar" /><span v-else class="ph">＋</span>
            </div>
            <button class="btn-ghost grow" @click="pickBg">更换背景图</button>
          </div>
          <div class="row" style="margin-bottom:10px">
            <div class="grow"><div class="f-lab">姓名</div><input v-model="char.name" /></div>
            <div class="grow"><div class="f-lab">备注</div><input v-model="char.note" /></div>
          </div>
          <div class="row" style="margin-bottom:10px">
            <div class="grow"><div class="f-lab">关系标签</div><input v-model="char.relation" /></div>
            <div class="grow"><div class="f-lab">生日</div><input v-model="char.birthday" type="date" /></div>
          </div>
          <div class="f-lab">签名</div><input v-model="char.sign" style="margin-bottom:10px" />
          <div class="row" style="margin-bottom:10px">
            <div class="grow"><div class="f-lab">状态</div>
              <select v-model="char.status"><option>在线</option><option>忙碌</option><option>离线</option></select>
            </div>
            <div class="grow"><div class="f-lab">分组</div>
              <select v-model="char.group"><option>好友</option><option>NPC</option><option>群聊</option></select>
            </div>
          </div>
          <div class="f-lab">人设（长文本）</div>
          <textarea v-model="char.persona" rows="8" style="margin-bottom:10px"></textarea>
          <div class="f-lab">开场白</div>
          <textarea v-model="char.greeting" rows="2" style="margin-bottom:10px"></textarea>
          <div class="f-lab">绑定世界书</div>
          <div class="chips" style="margin-bottom:10px">
            <span v-for="b in S.books" :key="b.id" class="chip" :class="{ on: char.books.includes(b.id) }" @click="char.books.includes(b.id) ? char.books.splice(char.books.indexOf(b.id), 1) : char.books.push(b.id)">{{ b.name }}</span>
          </div>
          <div class="f-lab">设置人声</div>
          <div class="row"><input v-model="char.voice" placeholder="如：低沉温柔" class="grow" /><button class="btn-mini" @click="setVoice">描述</button></div>
        </div>
        <div class="modal-f">
          <button class="btn-ghost grow" @click="showEdit = false">取消</button>
          <button class="btn-main" style="height:36px" @click="saveEdit">保存</button>
        </div>
      </div>
    </div>

    <!-- 证件卡 -->
    <div v-if="showCert" class="mask" @click.self="showCert = false">
      <div class="modal">
        <div class="modal-t">角色证件</div>
        <div class="cert" :style="{ background: `linear-gradient(135deg, ${detectOcc().color}, #111)` }">
          <div class="cert-head">{{ detectOcc().id }}</div>
          <div class="row" style="gap:12px;margin:12px 0">
            <div class="cert-av"><img v-if="char.avatar" :src="char.avatar" /><span v-else>{{ char.name[0] }}</span></div>
            <div>
              <div style="font-size:17px;font-weight:700;color:#fff">{{ char.name }}</div>
              <div style="font-size:11px;color:rgba(255,255,255,.75)">{{ char.relation || '关系：未标注' }}</div>
              <div style="font-size:11px;color:rgba(255,255,255,.75)">{{ detectOcc().extra }}：{{ certNo }}</div>
            </div>
          </div>
          <div class="cert-foot">签发于 {{ fmtFull(Date.now()).slice(0, 10) }} · 小手机管理局</div>
        </div>
        <div class="modal-f"><button class="btn-ghost grow" @click="showCert = false">关闭</button></div>
      </div>
    </div>

    <!-- 档案 -->
    <div v-if="showArch" class="mask" @click.self="showArch = false">
      <div class="modal" style="height:80%">
        <div class="modal-t">{{ char.name }} · 角色档案</div>
        <div class="modal-b">
          <div v-for="(v, k) in archive" :key="k" class="card" style="margin:8px 0">
            <div class="f-lab">{{ k }}</div>
            <div style="font-size:13px;line-height:1.7">{{ v }}</div>
          </div>
        </div>
        <div class="modal-f"><button class="btn-ghost grow" @click="showArch = false">关闭</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prof-head { height: 200px; background-size: cover; background-position: center; position: relative; display: flex; align-items: flex-end; padding: 0 20px; }
.prof-av { width: 84px; height: 84px; border-radius: 20px; overflow: hidden; margin-bottom: -30px; border: 3px solid var(--bg); background: var(--card2); cursor: pointer; position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; }
.prof-av img { width: 100%; height: 100%; object-fit: cover; }
.prof-info { padding: 40px 20px 14px; }
.prof-bottom { position: absolute; bottom: 0; left: 0; right: 0; display: flex; gap: 10px; padding: 12px 16px; background: var(--card); border-top: 1px solid var(--border); z-index: 5; }
.cert { border-radius: 16px; padding: 16px; color: #fff; margin-top: 6px; }
.cert-head { font-size: 13px; letter-spacing: 4px; opacity: .85; border-bottom: 1px solid rgba(255,255,255,.25); padding-bottom: 8px; }
.cert-av { width: 52px; height: 52px; border-radius: 8px; overflow: hidden; background: rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.cert-av img { width: 100%; height: 100%; object-fit: cover; }
.cert-foot { font-size: 10px; opacity: .6; margin-top: 10px; }
</style>
