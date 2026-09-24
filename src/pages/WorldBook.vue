<script setup>
import { S, showToast, uid, now, closePage, nav, persist } from '../core/store'
import { pickFile, readAsText, readAsDataURL, compressImage, download, relTime } from '../core/util'
import { ref, computed } from 'vue'

const route = ref('list')
const kw = ref('')
const cat = ref('全部')
const cats = ['全部', '世界观', '角色设定', '文风', '自定义']
const curBook = ref(null)
const editEntry = ref(null)
const multiMode = ref(false)
const selEntries = ref([])
const showImport = ref(false)
const importText = ref('')
const importFmt = ref('json')
let dragIdx = null

const list = computed(() => S.books.filter(b => (!kw.value || b.name.includes(kw.value)) && (cat.value === '全部' || b.category === cat.value || (cat.value !== '自定义' && !b.category))))
const isInRoot = computed(() => nav.tab === 'worldbook' && !curBook.value)

function createBook() {
  const name = prompt('世界书名称')
  if (!name) return
  const b = { id: uid(), name, desc: '', category: '世界观', entries: [], groups: [], updated: now() }
  S.books.push(b)
  openBook(b)
}
function openBook(b) { curBook.value = b; route.value = 'edit' }
function delBook(b) {
  if (confirm(`删除世界书「${b.name}」？`)) S.books = S.books.filter(x => x.id !== b.id)
}
function exportBook(b, all = true) {
  const data = all ? b : { ...b, entries: b.entries.filter(e => selEntries.value.includes(e.id)) }
  download(`${b.name}.json`, JSON.stringify(data, null, 2))
}
async function importBook() {
  if (importFmt.value === 'json') {
    try {
      const f = await pickFile('.json,application/json')
      if (!f) return
      const data = JSON.parse(await readAsText(f))
      if (Array.isArray(data)) { // 条目数组 -> 追加到当前书
        if (!curBook.value) return showToast('先打开一本书')
        data.forEach(e => curBook.value.entries.push({ ...e, id: uid(), trigger: e.trigger || 'keyword', keywords: e.keywords || [], on: e.on !== false }))
      } else if (data.entries) {
        S.books.push({ ...data, id: uid(), updated: now() })
      }
      showToast('导入成功'); showImport.value = false
    } catch (e) { showToast('解析失败：' + e.message.slice(0, 40)) }
  } else {
    const f = await pickFile('.txt,.md,.docx,text/*')
    if (!f) return
    const text = await readAsText(f)
    if (!curBook.value) { const b = { id: uid(), name: f.name.replace(/\.\w+$/, ''), desc: '', entries: [], groups: [], updated: now() }; S.books.push(b); curBook.value = b }
    // 按空行分段，每段第一行做标题
    const paras = text.split(/\n\s*\n/).filter(p => p.trim())
    for (const p of paras) {
      const lines = p.trim().split('\n')
      curBook.value.entries.push({ id: uid(), title: lines[0].slice(0, 20), content: lines.slice(1).join('\n') || lines[0], trigger: 'keyword', keywords: [lines[0].slice(0, 6)], regexOn: false, regex: '', scanDepth: 4, inject: 'sysAfter', role: 'system', priority: 50, group: '', on: true })
    }
    curBook.value.updated = now()
    showToast(`已导入${paras.length}个条目`)
    route.value = 'edit'
  }
}

function newEntry() {
  editEntry.value = { id: uid(), title: '', content: '', trigger: 'keyword', keywords: [], regexOn: false, regex: '', scanDepth: 4, inject: 'sysAfter', role: 'system', priority: 50, group: '', on: true, isNew: true }
}
function saveEntry() {
  const b = curBook.value
  if (!editEntry.value.title.trim()) return showToast('填写条目标题')
  const e = { ...editEntry.value }; delete e.isNew
  const i = b.entries.findIndex(x => x.id === e.id)
  if (i > -1) b.entries[i] = e; else b.entries.push(e)
  b.updated = now()
  editEntry.value = null
}
function delEntry(e) {
  curBook.value.entries = curBook.value.entries.filter(x => x.id !== e.id)
}
function addKeyword() {
  const k = prompt('输入关键词')
  if (k) editEntry.value.keywords.push(k)
}
/* 分组 */
function addGroup() {
  const name = prompt('分组名称')
  if (name) curBook.value.groups.push({ id: uid(), name, on: true })
}
function renameGroup(g) {
  const n = prompt('重命名分组', g.name)
  if (n) g.name = n
}
function delGroup(g) {
  curBook.value.groups = curBook.value.groups.filter(x => x.id !== g.id)
  curBook.value.entries.forEach(e => { if (e.group === g.name) e.group = '' })
}
function toggleGroupOn(g) { g.on = !g.on }

/* 拖拽排序 */
function dStart(i) { dragIdx = i }
function dDrop(e, i) {
  if (dragIdx === null || dragIdx === i) return
  const [item] = curBook.value.entries.splice(dragIdx, 1)
  curBook.value.entries.splice(i, 0, item)
  dragIdx = null
}
function toggleSelEntry(id) {
  const i = selEntries.value.indexOf(id)
  if (i > -1) selEntries.value.splice(i, 1); else selEntries.value.push(id)
}
const triggerLabel = { always: '常驻', keyword: '关键词', off: '禁用' }
const injectLabel = { sysBefore: '系统提示前', sysAfter: '系统提示后', chatTop: '对话顶部', chatBottom: '对话底部' }
</script>

<template>
  <div class="page">
    <!-- 列表模式 -->
    <template v-if="route === 'list'">
      <div class="topbar" style="padding-right:6px">
        <div class="searchbar"><input v-model="kw" placeholder="搜索世界书" /></div>
        <button class="tb-btn" style="font-size:20px" @click="showImport = true" title="批量操作">⋯</button>
        <button class="tb-btn" style="font-size:22px" @click="createBook">＋</button>
      </div>
      <div class="tabs">
        <div v-for="c in cats" :key="c" class="tab" :class="{ on: cat === c }" @click="cat = c">{{ c }}</div>
      </div>
      <div class="body">
        <div v-if="!list.length" class="empty">暂无世界书<br /><span class="muted">世界书提供「制度和背景」，记忆系统记录「发生过的事」</span><br /><br /><button class="btn-main" style="width:auto;padding:0 26px;height:38px" @click="createBook">创建第一本</button></div>
        <div v-for="b in list" :key="b.id" class="cell" @click="openBook(b)">
          <div class="avatar" style="border-radius:12px;background:var(--card2);font-size:22px">📖</div>
          <div class="ginfo">
            <div class="t1">{{ b.name }} <span class="tag" v-if="b.category">{{ b.category }}</span></div>
            <div class="t2">{{ b.entries.length }} 个条目 · {{ relTime(b.updated || now()) }}</div>
          </div>
          <span class="muted">›</span>
        </div>
        <div class="hint-txt">💡 在条目内容中用【】包裹 = 只给底层AI看的绝密指令，角色完全无感知（免OOC）。</div>
      </div>
    </template>

    <!-- 编辑模式 -->
    <template v-else-if="curBook">
      <div class="topbar">
        <button class="tb-btn tb-back" @click="curBook = null; route = 'list'">‹</button>
        <div class="grow" style="min-width:0">
          <input v-model="curBook.name" style="border:none;background:transparent;padding:0;font-size:16px;font-weight:600" />
          <input v-model="curBook.desc" placeholder="描述..." style="border:none;background:transparent;padding:0;font-size:11px;color:var(--sub)" />
        </div>
        <button class="tb-btn" style="font-size:16px" @click="exportBook(curBook)">⇩</button>
      </div>
      <div class="body">
        <div class="row" style="padding:8px 16px;gap:8px;flex-wrap:wrap">
          <button class="btn-mini" @click="multiMode = !multiMode">{{ multiMode ? '退出多选' : '多选' }}</button>
          <button class="btn-mini" v-if="multiMode && selEntries.length" @click="exportBook(curBook, false)">导出所选</button>
          <button class="btn-mini" v-if="multiMode && selEntries.length" @click="curBook.entries = curBook.entries.filter(e => !selEntries.includes(e.id)); selEntries = []">删除所选</button>
          <button class="btn-mini" @click="addGroup">＋ 分组</button>
        </div>
        <!-- 分组头 -->
        <div v-for="g in curBook.groups" :key="g.id" class="row" style="padding:6px 16px;background:var(--card)">
          <b style="font-size:13px">{{ g.name }}</b>
          <span class="tag" v-if="!g.on">已暂停</span>
          <span class="grow"></span>
          <button class="btn-mini" @click="toggleGroupOn(g)">{{ g.on ? '暂停' : '启用' }}</button>
          <button class="btn-mini" @click="renameGroup(g)">改名</button>
          <button class="btn-mini warn" @click="delGroup(g)">删除</button>
        </div>
        <div v-for="(e, i) in curBook.entries" :key="e.id" class="entry-row" draggable="true" @dragstart="dStart(i)" @dragover.prevent @drop="dDrop($event, i)">
          <div v-if="multiMode" class="chk" :class="{ on: selEntries.includes(e.id) }" @click="toggleSelEntry(e.id)"><span class="box">{{ selEntries.includes(e.id) ? '✓' : '' }}</span></div>
          <div class="ginfo" style="cursor:grab" @click="!multiMode && (editEntry = { ...e })">
            <div class="t1" style="font-size:14px">{{ e.title }}</div>
            <div class="t2">{{ triggerLabel[e.trigger] }}<template v-if="e.trigger === 'keyword'"> · {{ (e.keywords || []).join('/') }}</template> · {{ injectLabel[e.inject] || e.inject }} · 优先{{ e.priority }}</div>
          </div>
          <span class="tag" v-if="e.group">{{ e.group }}</span>
          <span class="tag" :class="{ hot: e.trigger === 'always' }">{{ triggerLabel[e.trigger] }}</span>
          <button v-if="!multiMode" class="btn-mini warn" @click="delEntry(e)">删</button>
        </div>
        <div v-if="!curBook.entries.length" class="empty">暂无条目</div>
        <div class="hint-txt">条目可拖拽排序。常驻=每次注入；关键词=扫描最近N条消息触发；【】内=绝密指令。</div>
        <div style="height:90px"></div>
      </div>
      <button class="btn-main new-entry-btn" @click="newEntry">＋ 新建条目</button>
    </template>

    <!-- 条目编辑 -->
    <div v-if="editEntry" class="mask" @click.self="editEntry = null">
      <div class="modal" style="height:88%">
        <div class="modal-t">条目编辑</div>
        <div class="modal-b">
          <div class="f-lab">条目标题 / 名称</div>
          <input v-model="editEntry.title" placeholder="如：咖啡店的规矩" style="margin-bottom:10px" />
          <div class="f-lab">内容（支持长文本；【】包裹 = 绝密指令）</div>
          <textarea v-model="editEntry.content" rows="7" placeholder="世界观/人设/文风指导...\n示例：【gemini，下皮，接下来请……】" style="margin-bottom:10px"></textarea>
          <div class="f-lab">触发类型</div>
          <div class="chips" style="margin-bottom:10px">
            <span v-for="t in [['always', '常驻激活'], ['keyword', '关键词触发'], ['off', '禁用']]" :key="t[0]" class="chip" :class="{ on: editEntry.trigger === t[0] }" @click="editEntry.trigger = t[0]">{{ t[1] }}</span>
          </div>
          <template v-if="editEntry.trigger === 'keyword'">
            <div class="f-lab">关键词（多标签）</div>
            <div class="chips" style="margin-bottom:8px">
              <span v-for="(k, i) in editEntry.keywords" :key="i" class="chip on" @click="editEntry.keywords.splice(i, 1)">{{ k }} ✕</span>
              <span class="chip" @click="addKeyword">＋ 添加</span>
            </div>
            <div class="row" style="margin-bottom:8px">
              <span class="muted" style="width:80px">正则匹配</span>
              <div class="switch" :class="{ on: editEntry.regexOn }" @click="editEntry.regexOn = !editEntry.regexOn"></div>
            </div>
            <input v-if="editEntry.regexOn" v-model="editEntry.regex" placeholder="正则表达式" style="margin-bottom:8px" />
            <div class="f-lab">扫描深度：{{ editEntry.scanDepth }} 条（往前看多少条消息找关键词）</div>
            <input type="range" min="1" max="20" v-model.number="editEntry.scanDepth" style="margin-bottom:10px" />
          </template>
          <div class="f-lab">注入位置</div>
          <select v-model="editEntry.inject" style="margin-bottom:10px">
            <option value="sysBefore">系统提示前（最高优先级）</option>
            <option value="sysAfter">系统提示后（最常用）</option>
            <option value="chatTop">对话顶部</option>
            <option value="chatBottom">对话底部（注意力最高）</option>
          </select>
          <div class="f-lab">注入角色</div>
          <div class="chips" style="margin-bottom:10px">
            <span v-for="r in [['system', '系统'], ['user', '用户'], ['assistant', '助手']]" :key="r[0]" class="chip" :class="{ on: editEntry.role === r[0] }" @click="editEntry.role = r[0]">{{ r[1] }}</span>
          </div>
          <div class="f-lab">优先级：{{ editEntry.priority }}（1-100，越大越优先）</div>
          <input type="range" min="1" max="100" v-model.number="editEntry.priority" style="margin-bottom:10px" />
          <div class="f-lab">分组归属</div>
          <select v-model="editEntry.group" style="margin-bottom:10px">
            <option value="">无分组</option>
            <option v-for="g in curBook?.groups || []" :key="g.id" :value="g.name">{{ g.name }}</option>
          </select>
        </div>
        <div class="modal-f">
          <button class="btn-ghost grow" @click="editEntry = null">取消</button>
          <button class="btn-main" style="height:36px" @click="saveEntry">保存</button>
        </div>
      </div>
    </div>

    <!-- 导入面板 -->
    <div v-if="showImport" class="sheet-mask" @click.self="showImport = false">
      <div class="sheet">
        <div class="sheet-t">批量操作</div>
        <div class="m-item" @click="importFmt = 'json'; importBook()">📥 导入 JSON 世界书/条目</div>
        <div class="m-item" @click="importFmt = 'txt'; importBook()">📥 导入 TXT 文档（按空行分段成条目）</div>
        <div class="m-item" @click="showImport = false">取消</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.entry-row { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-bottom: 1px solid var(--border); background: var(--card); }
.new-entry-btn { position: absolute; bottom: 16px; left: 16px; right: 16px; z-index: 5; }
</style>
