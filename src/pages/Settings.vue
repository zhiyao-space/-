<script setup>
import { S, showToast, THEMES, applyTheme, exportBackup, importBackup, activeChatCfg, activeImageCfg, uid } from '../core/store'
import { testChat, testImage, sttTranscribe, ttsSpeak, playDataUrl, playUrl } from '../core/api'
import { pickFile, readAsText, readAsDataURL, download } from '../core/util'
import { ref } from 'vue'

const sec = ref('api') // api / theme / font / beautify / data / other
const apiTab = ref('chat')
const editingCfg = ref(null)
const cfgType = ref('chat')
const recording = ref(false)
let mediaRec = null, recChunks = []
const sttResult = ref('')
const testResult = ref({})

function newCfg(type) {
  cfgType.value = type
  editingCfg.value = type === 'chat'
    ? { id: uid(), name: '新配置', baseUrl: '', key: '', model: '', style: 'live', extraParams: '' }
    : { id: uid(), name: '新配置', baseUrl: '', key: '', model: '', size: '512x512', steps: 25, cfg: 7 }
}
function saveCfg() {
  const arr = cfgType.value === 'chat' ? S.apiCfg.chat : S.apiCfg.image
  const i = arr.findIndex(c => c.id === editingCfg.value.id)
  if (i > -1) arr[i] = editingCfg.value; else arr.push(editingCfg.value)
  if (!S.apiCfg.activeChat && cfgType.value === 'chat') S.apiCfg.activeChat = editingCfg.value.id
  if (!S.apiCfg.activeImage && cfgType.value === 'image') S.apiCfg.activeImage = editingCfg.value.id
  editingCfg.value = null
  showToast('已保存')
}
function delCfg(c) {
  if (!confirm(`删除配置「${c.name}」？`)) return
  if (cfgType.value === 'chat') { S.apiCfg.chat = S.apiCfg.chat.filter(x => x.id !== c.id); if (S.apiCfg.activeChat === c.id) S.apiCfg.activeChat = S.apiCfg.chat[0]?.id || '' }
  else { S.apiCfg.image = S.apiCfg.image.filter(x => x.id !== c.id); if (S.apiCfg.activeImage === c.id) S.apiCfg.activeImage = S.apiCfg.image[0]?.id || '' }
}
async function doTestChat() {
  testResult.value.chat = '测试中...'
  try { testResult.value.chat = '✓ ' + await testChat() } catch (e) { testResult.value.chat = '✗ ' + e.message.slice(0, 80) }
}
async function doTestImage() {
  testResult.value.image = '测试中...'
  try { const u = await testImage(); testResult.value.image = '✓ 生成成功'; testResult.value.imgUrl = u } catch (e) { testResult.value.image = '✗ ' + e.message.slice(0, 80) }
}

/* 语音测试 */
async function testVoiceFlow() {
  recording.value = true
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRec = new MediaRecorder(stream); recChunks = []
    mediaRec.ondataavailable = e => recChunks.push(e.data)
    mediaRec.onstop = async () => {
      recording.value = false
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(recChunks, { type: 'audio/webm' })
      try {
        sttResult.value = '识别中...'
        const text = await sttTranscribe(blob)
        sttResult.value = '识别：' + (text || '(空)')
        sttResult.value += '\nTTS播报中...'
        const audio = await ttsSpeak(text || '语音测试完成')
        if (audio) playUrl(audio); else sttResult.value += '\n(TTS未配置，跳过播报)'
      } catch (e) { sttResult.value = '✗ ' + e.message.slice(0, 80) }
    }
    mediaRec.start()
    setTimeout(() => mediaRec.state === 'recording' && mediaRec.stop(), 4000)
  } catch { recording.value = false; showToast('无法访问麦克风') }
}

/* 字体 */
const fontPreview = ref(false)
async function uploadFont() {
  const f = await pickFile('.ttf,.otf,font/*')
  if (!f) return
  const url = await readAsDataURL(f)
  S.fonts.mode = 'local'
  S.fonts.dataUrl = url
  S.fonts.name = f.name
  applyTheme()
  fontPreview.value = true
  showToast('字体已注入')
}
function useFontUrl() {
  const u = prompt('字体文件在线地址(.ttf/.otf/.woff2)')
  if (!u) return
  S.fonts.mode = 'url'; S.fonts.name = u; S.fonts.dataUrl = ''
  applyTheme(); fontPreview.value = true
}
function clearFont() {
  S.fonts.mode = 'sys'; S.fonts.dataUrl = ''; S.fonts.name = ''
  applyTheme(); showToast('已恢复系统字体')
}

/* 备份 */
function doExport() { download(`aiphone-backup-${Date.now()}.json`, exportBackup()); showToast('已导出') }
async function doImport() {
  const f = await pickFile('.json,application/json')
  if (!f) return
  try { importBackup(await readAsText(f)); applyTheme(); showToast('导入成功') } catch (e) { showToast('导入失败：文件格式错误') }
}

/* 图标批量 */
async function importIcons() {
  const files = await pickFile('image/*', true)
  if (!files?.length) return
  let i = 0
  for (const k in S.phone.icons) delete S.phone.icons[k]
  for (const f of files.slice(0, 24)) {
    S.phone.icons['custom' + i] = await readAsDataURL(f)
    i++
  }
  showToast(`已替换${i}张图标素材`)
}

function resetBeautify() {
  if (!confirm('清空自定义美化代码？')) return
  S.beautify.css = ''; S.beautify.js = ''; S.beautify.enabled = false
  applyTheme()
}
async function importCodeFile(type) {
  const f = await pickFile(type === 'css' ? '.css' : '.js')
  if (!f) return
  const text = await readAsText(f)
  if (type === 'css') { S.beautify.css = text }
  else {
    if (/eval\s*\(/.test(text)) return showToast('包含eval()，已阻止导入')
    S.beautify.js = text
  }
  showToast('已导入，可预览后启用')
}
function previewCode() {
  const enabled = S.beautify.enabled
  S.beautify.enabled = true
  applyTheme()
  setTimeout(() => { if (!enabled) { S.beautify.enabled = false; applyTheme(); showToast('预览5秒后恢复（已重新禁用）') } }, 5000)
  if (!enabled) setTimeout(() => applyTheme(), 5100)
}
function warnBeautify() {
  if (!S.beautify.warned && (S.beautify.css || S.beautify.js)) {
    S.beautify.warned = true
    alert('自定义代码有风险，请确认来源可信。JS将被注入页面运行（已过滤eval与网络请求）。')
  }
}
function saveScheme() {
  const name = prompt('方案名称', '我的方案')
  if (!name) return
  S.beautify.schemes.push({ name, css: S.beautify.css, js: S.beautify.js })
  showToast('已保存方案')
}
function loadScheme(s) {
  S.beautify.css = s.css; S.beautify.js = s.js
  showToast(`已载入「${s.name}」`)
}
const SNIPPETS = [
  { name: '纯黑玻璃态', css: `.bubble{backdrop-filter:blur(8px)!important}.bottom-nav,.statusbar{background:rgba(0,0,0,.6)!important;backdrop-filter:blur(14px)!important}` },
  { name: '霓虹边框', css: `.icon-box{box-shadow:0 0 8px rgba(0,212,255,.6),inset 0 0 4px rgba(0,212,255,.3)!important;border-color:rgba(0,212,255,.5)!important}` },
  { name: '极简黑白', css: `*{border-radius:2px!important}` },
  { name: '聊天气泡渐变', css: `.mine .bubble{background:linear-gradient(135deg,#2c5e4f,#3a7a66)!important}` }
]
function applySnippet(s) { S.beautify.css = (S.beautify.css ? S.beautify.css + '\n' : '') + s.css; showToast('已追加片段') }
</script>

<template>
  <div class="page">
    <div class="body">
      <div class="cell" @click="sec = 'api'"><span>🔌</span><div class="ginfo"><div class="t1">API 配置</div><div class="t2">聊天 / 生图 / 语音 中转站配置</div></div><span class="muted">›</span></div>
      <div class="cell" @click="sec = 'theme'"><span>🎨</span><div class="ginfo"><div class="t1">主题设置</div><div class="t2">{{ THEMES[S.theme.preset]?.name }}</div></div><span class="muted">›</span></div>
      <div class="cell" @click="sec = 'font'"><span>🔤</span><div class="ginfo"><div class="t1">字体设置</div><div class="t2">{{ S.fonts.mode === 'sys' ? '系统默认' : S.fonts.name || '自定义' }}</div></div><span class="muted">›</span></div>
      <div class="cell" @click="sec = 'beautify'"><span>💎</span><div class="ginfo"><div class="t1">高级美化</div><div class="t2">自定义 CSS / JS 代码注入</div></div><span class="muted">›</span></div>
      <div class="cell" @click="sec = 'other'"><span>🧠</span><div class="ginfo"><div class="t1">活人感与记忆</div><div class="t2">主动消息 / 时间感知 / 情绪 / 记忆</div></div><span class="muted">›</span></div>
      <div class="cell" @click="sec = 'data'"><span>💾</span><div class="ginfo"><div class="t1">备份与恢复</div><div class="t2">导入 / 导出完整备份</div></div><span class="muted">›</span></div>

      <!-- API 配置 -->
      <template v-if="sec === 'api'">
        <div class="section-t">API 配置（所有 key 加密存于本机 localStorage）</div>
        <div class="tabs">
          <div class="tab" :class="{ on: apiTab === 'chat' }" @click="apiTab = 'chat'">聊天</div>
          <div class="tab" :class="{ on: apiTab === 'image' }" @click="apiTab = 'image'">生图</div>
          <div class="tab" :class="{ on: apiTab === 'voice' }" @click="apiTab = 'voice'">语音</div>
        </div>
        <!-- 聊天配置 -->
        <template v-if="apiTab === 'chat'">
          <div v-if="!S.apiCfg.chat.length" class="empty">还未配置，点下方 + 添加<br /><button class="btn-main mt16" style="width:auto;padding:0 24px;height:36px" @click="newCfg('chat')">＋ 添加聊天配置</button></div>
          <div v-for="c in S.apiCfg.chat" :key="c.id" class="card">
            <div class="row">
              <b>{{ c.name }}</b>
              <span class="tag hot" v-if="S.apiCfg.activeChat === c.id">默认</span>
              <span class="grow"></span>
              <button class="btn-mini" v-if="S.apiCfg.activeChat !== c.id" @click="S.apiCfg.activeChat = c.id; showToast('已切换默认')">设为默认</button>
              <button class="btn-mini" @click="cfgType = 'chat'; editingCfg = { ...c }">编辑</button>
              <button class="btn-mini warn" @click="delCfg(c)">删除</button>
            </div>
            <div class="muted mt8">{{ c.baseUrl || '未填写 base_url' }} · {{ c.model || '智能选择' }}</div>
          </div>
          <div style="padding:0 12px"><button class="btn-ghost" style="width:100%" @click="newCfg('chat')">＋ 添加配置组</button></div>
          <div class="card mt12" v-if="activeChatCfg()">
            <button class="btn-main" style="height:36px" @click="doTestChat">测试连接</button>
            <div class="muted mt8" style="white-space:pre-wrap">{{ testResult.chat || '' }}</div>
          </div>
        </template>
        <!-- 生图配置 -->
        <template v-else-if="apiTab === 'image'">
          <div v-if="!S.apiCfg.image.length" class="empty">还未配置，点下方 + 添加<br /><button class="btn-main mt16" style="width:auto;padding:0 24px;height:36px" @click="newCfg('image')">＋ 添加生图配置</button></div>
          <div v-for="c in S.apiCfg.image" :key="c.id" class="card">
            <div class="row">
              <b>{{ c.name }}</b>
              <span class="tag hot" v-if="S.apiCfg.activeImage === c.id">默认</span>
              <span class="grow"></span>
              <button class="btn-mini" v-if="S.apiCfg.activeImage !== c.id" @click="S.apiCfg.activeImage = c.id">设为默认</button>
              <button class="btn-mini" @click="cfgType = 'image'; editingCfg = { ...c }">编辑</button>
              <button class="btn-mini warn" @click="delCfg(c)">删除</button>
            </div>
            <div class="muted mt8">{{ c.baseUrl || '未填写' }} · {{ c.model || '未选模型' }}</div>
          </div>
          <div style="padding:0 12px"><button class="btn-ghost" style="width:100%" @click="newCfg('image')">＋ 添加配置组</button></div>
          <div class="card mt12" v-if="activeImageCfg()">
            <button class="btn-main" style="height:36px" @click="doTestImage">测试生成</button>
            <div class="muted mt8">{{ testResult.image || '' }}</div>
            <img v-if="testResult.imgUrl" :src="testResult.imgUrl" style="max-width:120px;border-radius:8px;margin-top:8px" />
          </div>
        </template>
        <!-- 语音配置 -->
        <template v-else>
          <div class="card">
            <div class="f-lab">语音转文字 STT</div>
            <input v-model="S.apiCfg.stt.key" placeholder="API Key" type="password" style="margin-bottom:8px" />
            <input v-model="S.apiCfg.stt.model" placeholder="模型（如 whisper-1）" style="margin-bottom:8px" />
            <div class="muted">使用聊天配置的 base_url + /audio/transcriptions</div>
          </div>
          <div class="card">
            <div class="f-lab">文字转语音 TTS</div>
            <input v-model="S.apiCfg.tts.key" placeholder="API Key" type="password" style="margin-bottom:8px" />
            <div class="row" style="margin-bottom:8px">
              <div class="grow"><div class="f-lab">音色</div>
                <select v-model="S.apiCfg.tts.voice"><option>alloy</option><option>echo</option><option>fable</option><option>onyx</option><option>nova</option><option>shimmer</option></select>
              </div>
              <div class="grow"><div class="f-lab">语速 {{ S.apiCfg.tts.speed }}</div>
                <input type="range" min="0.5" max="2" step="0.1" v-model="S.apiCfg.tts.speed" />
              </div>
            </div>
            <button class="btn-main" style="height:36px" @click="testVoiceFlow">{{ recording ? '录音中(4秒)...' : '测试：录音→识别→播报' }}</button>
            <div class="muted mt8" style="white-space:pre-wrap">{{ sttResult }}</div>
          </div>
        </template>

        <!-- 配置编辑弹窗 -->
        <div v-if="editingCfg" class="mask" @click.self="editingCfg = null">
          <div class="modal" style="height:80%">
            <div class="modal-t">{{ cfgType === 'chat' ? '聊天' : '生图' }}配置</div>
            <div class="modal-b">
              <div class="f-lab">配置名称</div>
              <input v-model="editingCfg.name" placeholder="如：档1-聊天" style="margin-bottom:10px" />
              <div class="f-lab">base_url</div>
              <input v-model="editingCfg.baseUrl" placeholder="https://api.xxx.com/v1" style="margin-bottom:10px" />
              <div class="f-lab">API Key</div>
              <input v-model="editingCfg.key" type="password" placeholder="sk-..." style="margin-bottom:10px" />
              <div class="f-lab">模型（留空 = 智能选择/中转站默认；可直接输入自定义模型名）</div>
              <input v-model="editingCfg.model" placeholder="gpt-4o / claude-xxx / 自定义" style="margin-bottom:10px" />
              <template v-if="cfgType === 'chat'">
                <div class="f-lab">响应风格预设</div>
                <div class="chips" style="margin-bottom:10px">
                  <span v-for="s in [['live', '活人感'], ['short', '短回复'], ['detail', '详细'], ['roleplay', '角色扮演']]" :key="s[0]" class="chip" :class="{ on: editingCfg.style === s[0] }" @click="editingCfg.style = s[0]">{{ s[1] }}</span>
                </div>
                <div class="f-lab">额外参数 JSON（可选，如 {"temperature":1}）</div>
                <textarea v-model="editingCfg.extraParams" rows="2"></textarea>
              </template>
              <template v-else>
                <div class="f-lab">模型</div>
                <div class="chips" style="margin-bottom:6px">
                  <span v-for="m in ['stable-diffusion', 'novelai', 'sdxl']" :key="m" class="chip" :class="{ on: editingCfg.model === m }" @click="editingCfg.model = m">{{ m }}</span>
                </div>
                <input v-model="editingCfg.model" placeholder="或手动输入自定义模型名" style="margin-bottom:10px" />
                <div class="f-lab">默认尺寸</div>
                <div class="chips" style="margin-bottom:10px">
                  <span v-for="s in ['512x512', '768x768', '512x768', '768x512']" :key="s" class="chip" :class="{ on: editingCfg.size === s }" @click="editingCfg.size = s">{{ s }}</span>
                </div>
                <div class="f-lab">采样步数：{{ editingCfg.steps }}</div>
                <input type="range" min="1" max="50" v-model.number="editingCfg.steps" style="margin-bottom:10px" />
                <div class="f-lab">CFG：{{ editingCfg.cfg }}</div>
                <input type="range" min="1" max="20" v-model.number="editingCfg.cfg" />
              </template>
            </div>
            <div class="modal-f">
              <button class="btn-ghost grow" @click="editingCfg = null">取消</button>
              <button class="btn-main" style="height:36px" @click="saveCfg">保存</button>
            </div>
          </div>
        </div>
      </template>

      <!-- 主题 -->
      <template v-else-if="sec === 'theme'">
        <div class="section-t">预设主题（单选，实时预览）</div>
        <div class="chips" style="padding:0 16px;flex-wrap:wrap">
          <span v-for="(t, k) in THEMES" :key="k" class="chip" :class="{ on: S.theme.preset === k }" @click="S.theme.preset = k; applyTheme()">{{ t.name }}</span>
        </div>
        <div class="card mt16">
          <div class="f-lab">聊天气泡样式</div>
          <div class="chips" style="margin-bottom:10px">
            <span v-for="b in [['round', '圆角矩形'], ['very', '极圆角'], ['bar', '横条']]" :key="b[0]" class="chip" :class="{ on: S.theme.bubble.style === b[0] }" @click="S.theme.bubble.style = b[0]; applyTheme()">{{ b[1] }}</span>
          </div>
          <div class="f-lab">头像形态</div>
          <div class="chips" style="margin-bottom:10px">
            <span v-for="a in [['circle', '圆形'], ['r8', '圆角方形'], ['square', '方形']]" :key="a[0]" class="chip" :class="{ on: S.theme.bubble.avatarShape === a[0] }" @click="S.theme.bubble.avatarShape = a[0]">{{ a[1] }}</span>
          </div>
          <div class="f-lab">气泡透明度 {{ S.theme.bubble.opacity }}%</div>
          <input type="range" min="50" max="100" v-model.number="S.theme.bubble.opacity" @change="applyTheme" />
          <div class="f-lab mt8">底部栏</div>
          <div class="chips" style="margin-bottom:10px">
            <span v-for="b in [['glass', '玻璃态'], ['plain', '纯色'], ['transparent', '透明']]" :key="b[0]" class="chip" :class="{ on: S.theme.barStyle === b[0] }" @click="S.theme.barStyle = b[0]">{{ b[1] }}</span>
          </div>
          <div class="slider-row"><span class="muted">高度</span><input type="range" min="50" max="70" v-model.number="S.theme.bar.height" @change="applyTheme" /><span class="muted">{{ S.theme.bar.height }}px</span></div>
          <div class="slider-row"><span class="muted">透明度</span><input type="range" min="0" max="100" v-model.number="S.theme.bar.opacity" @change="applyTheme" /><span class="muted">{{ S.theme.bar.opacity }}%</span></div>
          <div class="f-lab mt8">凸起程度</div>
          <div class="chips"><span class="chip" :class="{ on: S.theme.bar.raise === 0 }" @click="S.theme.bar.raise = 0">扁平</span><span class="chip" :class="{ on: S.theme.bar.raise === 1 }" @click="S.theme.bar.raise = 1">轻微</span><span class="chip" :class="{ on: S.theme.bar.raise === 2 }" @click="S.theme.bar.raise = 2">明显</span></div>
          <div class="f-lab mt8">动画</div>
          <div class="chips" style="margin-bottom:8px">
            <span v-for="a in [['none', '无动画'], ['fade', '淡入淡出'], ['slide', '轻微滑动']]" :key="a[0]" class="chip" :class="{ on: S.theme.anim.page === a[0] }" @click="S.theme.anim.page = a[0]">{{ a[1] }}</span>
          </div>
          <div class="row"><span class="grow">气泡出现动画</span><div class="switch" :class="{ on: S.theme.anim.bubbleMsg }" @click="S.theme.anim.bubbleMsg = !S.theme.anim.bubbleMsg"></div></div>
          <div class="row mt8"><span class="grow">装饰浮动动画</span><div class="switch" :class="{ on: S.theme.anim.deco }" @click="S.theme.anim.deco = !S.theme.anim.deco"></div></div>
        </div>
      </template>

      <!-- 字体 -->
      <template v-else-if="sec === 'font'">
        <div class="card">
          <div class="f-lab">字体来源</div>
          <div class="chips" style="margin-bottom:10px">
            <span class="chip" :class="{ on: S.fonts.mode === 'sys' }" @click="clearFont">系统默认</span>
            <span class="chip" :class="{ on: S.fonts.mode === 'local' }" @click="uploadFont">本地文件</span>
            <span class="chip" :class="{ on: S.fonts.mode === 'url' }" @click="useFontUrl">远程URL</span>
          </div>
          <div v-if="S.fonts.name" class="muted">当前：{{ S.fonts.name }}</div>
          <div style="font-size:18px;margin:10px 0" v-if="fontPreview || S.fonts.mode !== 'sys'">Aa 你好世界 123</div>
          <div class="hint-txt">上传 .ttf/.otf 读取后注入页面。文件过大可能超出 localStorage 容量导致保存失败。</div>
          <button class="btn-ghost" @click="clearFont">恢复系统字体</button>
        </div>
        <div class="card">
          <div class="f-lab">全局字号</div>
          <div class="slider-row"><span class="muted">标题</span><input type="range" min="18" max="28" v-model.number="S.fonts.sizes.title" @change="applyTheme" /><span class="muted">{{ S.fonts.sizes.title }}</span></div>
          <div class="slider-row"><span class="muted">按钮</span><input type="range" min="12" max="16" v-model.number="S.fonts.sizes.btn" @change="applyTheme" /><span class="muted">{{ S.fonts.sizes.btn }}</span></div>
          <div class="slider-row"><span class="muted">气泡</span><input type="range" min="13" max="18" v-model.number="S.fonts.sizes.bubble" @change="applyTheme" /><span class="muted">{{ S.fonts.sizes.bubble }}</span></div>
          <div class="slider-row"><span class="muted">次文本</span><input type="range" min="10" max="14" v-model.number="S.fonts.sizes.sub" @change="applyTheme" /><span class="muted">{{ S.fonts.sizes.sub }}</span></div>
        </div>
      </template>

      <!-- 美化 -->
      <template v-else-if="sec === 'beautify'">
        <div class="card">
          <div class="row" style="margin-bottom:10px"><span class="grow"><b>启用自定义代码</b><div class="muted">优先级最高，覆盖一切样式</div></span><div class="switch" :class="{ on: S.beautify.enabled }" @click="warnBeautify(); S.beautify.enabled = !S.beautify.enabled; applyTheme()"></div></div>
          <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">
            <button class="btn-mini" @click="importCodeFile('css')">导入CSS文件</button>
            <button class="btn-mini" @click="importCodeFile('js')">导入JS脚本</button>
            <button class="btn-mini" @click="previewCode">预览效果</button>
            <button class="btn-mini" @click="saveScheme">存为方案</button>
            <button class="btn-mini warn" @click="resetBeautify">一键清空</button>
          </div>
          <div class="f-lab">CSS（直接编辑）</div>
          <textarea v-model="S.beautify.css" rows="5" style="margin-bottom:10px;font-family:monospace;font-size:12px"></textarea>
          <div class="f-lab">JS（过滤 eval 与网络请求）</div>
          <textarea v-model="S.beautify.js" rows="4" style="font-family:monospace;font-size:12px"></textarea>
          <div v-if="S.beautify.schemes.length" class="mt12">
            <div class="f-lab">已存方案</div>
            <div class="chips"><span v-for="(s, i) in S.beautify.schemes" :key="i" class="chip" @click="loadScheme(s)">{{ s.name }}</span></div>
          </div>
          <div class="mt12">
            <div class="f-lab">预设美化片段（一键套用）</div>
            <div class="chips"><span v-for="s in SNIPPETS" :key="s.name" class="chip" @click="applySnippet(s)">{{ s.name }}</span></div>
          </div>
          <div class="hint-txt">安全机制：JS 注入前过滤 eval()，并禁用页面内 fetch/XHR/WebSocket 防止 Key 泄露。首次使用会弹风险提醒。</div>
        </div>
      </template>

      <!-- 活人感 -->
      <template v-else-if="sec === 'other'">
        <div class="card">
          <div class="row" style="margin-bottom:10px"><div class="grow"><b>角色主动发消息</b><div class="muted">不打开聊天也可能收到消息（每分钟检测）</div></div><div class="switch" :class="{ on: S.settings.proactive }" @click="S.settings.proactive = !S.settings.proactive"></div></div>
          <div class="row" style="margin-bottom:10px"><div class="grow"><b>时间感知</b><div class="muted">角色知道几点、白天黑夜、工作日周末</div></div><div class="switch" :class="{ on: S.settings.timeAware }" @click="S.settings.timeAware = !S.settings.timeAware"></div></div>
          <div class="row" style="margin-bottom:10px"><div class="grow"><b>心声显示</b><div class="muted">说出口的话和内心想法分开</div></div><div class="switch" :class="{ on: S.settings.heart }" @click="S.settings.heart = !S.settings.heart"></div></div>
          <div class="row" style="margin-bottom:10px"><div class="grow"><b>情绪识别</b><div class="muted">根据对话内容调整语气情绪</div></div><div class="switch" :class="{ on: S.settings.emotion }" @click="S.settings.emotion = !S.settings.emotion"></div></div>
          <div class="row" style="margin-bottom:10px"><div class="grow"><b>跨会话记忆互通</b><div class="muted">不同聊天之间记忆互通（防串戏可关闭）</div></div><div class="switch" :class="{ on: S.settings.crossMemory }" @click="S.settings.crossMemory = !S.settings.crossMemory"></div></div>
        </div>
        <div class="card">
          <div class="f-lab">上下文条数：{{ S.settings.injectN }} 条（1-200）</div>
          <input type="range" min="1" max="200" v-model.number="S.settings.injectN" />
          <div class="f-lab mt8">自动总结记忆间隔：每 {{ S.settings.memSumN }} 条消息</div>
          <input type="range" min="0" max="100" v-model.number="S.settings.memSumN" />
          <div class="f-lab mt8">世界书注入 token 上限：{{ S.settings.tokenLimit }}</div>
          <input type="range" min="500" max="10000" step="500" v-model.number="S.settings.tokenLimit" />
          <div class="f-lab mt8">状态栏透明度</div>
          <input type="range" min="0.2" max="1" step="0.02" v-model.number="S.settings.statusbarOpacity" />
        </div>
        <div class="card">
          <div class="f-lab">模式间记忆互通（防串戏开关）</div>
          <div class="row" style="margin-bottom:8px"><span class="grow">线上聊天 ↔ 线下模式</span><div class="switch" :class="{ on: S.settings.memLink.online_offline }" @click="S.settings.memLink.online_offline = !S.settings.memLink.online_offline"></div></div>
          <div class="row" style="margin-bottom:8px"><span class="grow">线上聊天 ↔ 角色扮演</span><div class="switch" :class="{ on: S.settings.memLink.online_roleplay }" @click="S.settings.memLink.online_roleplay = !S.settings.memLink.online_roleplay"></div></div>
          <div class="row"><span class="grow">线下模式 ↔ 角色扮演</span><div class="switch" :class="{ on: S.settings.memLink.offline_roleplay }" @click="S.settings.memLink.offline_roleplay = !S.settings.memLink.offline_roleplay"></div></div>
        </div>
      </template>

      <!-- 备份 -->
      <template v-else-if="sec === 'data'">
        <div class="card">
          <button class="btn-main" style="margin-bottom:10px" @click="doExport">导出完整备份（JSON）</button>
          <button class="btn-ghost" style="width:100%" @click="doImport">导入备份（覆盖当前数据）</button>
          <div class="hint-txt">备份包含：角色、聊天记录、世界书、记忆、API配置、所有虚拟资产。请妥善保管，注意其中含 API Key。</div>
        </div>
      </template>
      <div style="height:120px"></div>
    </div>
  </div>
</template>
