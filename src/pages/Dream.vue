<script setup>
import { S, closePage, showToast, uid, now } from '../core/store'
import { chatCompletions } from '../core/engine'
import { ref } from 'vue'

const showCreate = ref(false)
const cur = ref(null)
const input = ref('')
const loading = ref(false)
const form = ref({ name: '', charId: '', premise: '', world: '', goal: '', taboo: '', ending: 'HE', style: '梦境意识流' })
const showTaboo = ref(false)

function create() {
  if (!form.value.name.trim()) return showToast('填写梦境名称')
  const d = { id: uid(), ...JSON.parse(JSON.stringify(form.value)), turns: [], ended: false, endingText: '', created: now(), depth: 0 }
  S.dreams.push(d)
  showCreate.value = false
  cur.value = d
  continueDream('')
}
function openDream(d) { cur.value = d }
async function continueDream(choice) {
  if (!cur.value || loading.value) return
  if (choice) cur.value.turns.push({ from: 'user', content: choice })
  loading.value = true
  try {
    const c = S.chars.find(x => x.id === cur.value.charId)
    const sys = [
      `你是文字冒险游戏的主持人，这是用户的一场梦「${cur.value.name}」。`,
      cur.value.premise ? `故事前提：${cur.value.premise}` : '',
      cur.value.world ? `世界观与时代：${cur.value.world}` : '',
      c ? `梦中关键人物：${c.name}，${(c.persona || '').slice(0, 200)}` : '',
      cur.value.goal ? `核心目标：${cur.value.goal}` : '',
      cur.value.taboo ? `剧情禁区（绝不可出现）：${cur.value.taboo}` : '',
      `期望结局倾向：${cur.value.ending}（HE=好结局 / BE=坏结局，但过程要曲折，由用户的选择决定）。`,
      `文风：${cur.value.style}。每回合输出：一段梦境描述（150字内）+ 2-4个编号选项。`,
      cur.value.depth > 6 ? '梦境接近尾声，推进到高潮或结局。' : ''
    ]
    if (cur.value.turns.length) {
      sys.push('【前情】' + cur.value.turns.slice(-6).map(t => (t.from === 'user' ? '选：' : '') + t.content.slice(0, 200)).join(' / '))
    }
    const t = await chatCompletions([{ role: 'system', content: sys.filter(Boolean).join('\n') }, { role: 'user', content: choice || '开始入梦' }], { maxTokens: 800 })
    cur.value.turns.push({ from: 'sys', content: t.trim() })
    cur.value.depth++
    if (/结局|HE|BE|梦醒/.test(t) && cur.value.depth > 3) cur.value.ended = true
  } catch (e) { showToast(e.message.slice(0, 40)) }
  loading.value = false
}
function pickOption(opt) {
  if (cur.value.ended) return
  continueDream(opt)
}
function forceEnd(type) {
  cur.value.ended = true
  cur.value.endingText = type === 'HE' ? '☀️ 梦境走向了好的结局，你安然醒来。' : '🌑 梦境坠入了坏结局，你在黑暗中惊醒。'
}
</script>

<template>
  <div class="page">
    <template v-if="!cur">
      <div class="topbar">
        <button class="tb-btn tb-back" @click="closePage">‹</button>
        <b>入梦</b>
        <span class="grow"></span>
        <button class="tb-btn" style="font-size:22px" @click="showCreate = true">＋</button>
      </div>
      <div class="body">
        <div v-if="!S.dreams.length" class="empty">潜入梦境，开始一场文字冒险<br /><span class="muted">可控剧情走向与结局类型（HE/BE）</span></div>
        <div v-for="d in S.dreams" :key="d.id" class="cell" @click="openDream(d)">
          <div class="avatar" style="border-radius:12px;font-size:20px">🌙</div>
          <div class="ginfo">
            <div class="t1">{{ d.name }} <span class="tag" v-if="d.ended">已{{ d.ending === 'HE' ? '圆满' : '坠落' }}</span></div>
            <div class="t2">{{ d.premise?.slice(0, 24) || d.world || '未知的梦' }}</div>
          </div>
          <span class="muted">›</span>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="topbar">
        <button class="tb-btn tb-back" @click="cur = null">‹</button>
        <b class="line1 grow">🌙 {{ cur.name }}</b>
        <span class="tag" :class="{ hot: cur.ending === 'HE' }">{{ cur.ending }}倾向</span>
      </div>
      <div class="body dream-body" style="padding:16px">
        <div v-for="(t, i) in cur.turns" :key="i">
          <div v-if="t.from === 'sys'" class="dream-text">{{ t.content }}</div>
          <div v-else class="dream-choice">你选择了：{{ t.content }}</div>
        </div>
        <div v-if="cur.ended && cur.endingText" class="dream-end">{{ cur.endingText }}</div>
        <div v-if="loading" class="center muted mt8">梦境编织中...</div>
        <div style="height:20px"></div>
      </div>
      <div class="ctrl-bar">
        <button class="btn-mini" @click="showTaboo = true">设定</button>
        <button class="btn-mini" @click="forceEnd('HE')">导HE</button>
        <button class="btn-mini" @click="forceEnd('BE')">导BE</button>
        <button class="btn-mini" v-if="cur.ended" @click="cur.ended = false; continueDream('')">再入梦</button>
      </div>
    </template>

    <!-- 创建 -->
    <div v-if="showCreate" class="mask" @click.self="showCreate = false">
      <div class="modal" style="height:88%">
        <div class="modal-t">新梦境</div>
        <div class="modal-b">
          <div class="f-lab">梦境名称 *</div><input v-model="form.name" style="margin-bottom:10px" />
          <div class="f-lab">梦中角色</div>
          <select v-model="form.charId" style="margin-bottom:10px"><option value="">无特定角色</option><option v-for="c in S.chars" :key="c.id" :value="c.id">{{ c.name }}</option></select>
          <div class="f-lab">故事前提</div><textarea v-model="form.premise" rows="2" style="margin-bottom:10px"></textarea>
          <div class="f-lab">世界观与时代</div><input v-model="form.world" placeholder="如：赛博朋克2077 / 民国上海" style="margin-bottom:10px" />
          <div class="f-lab">核心目标</div><input v-model="form.goal" placeholder="如：找到回家的路" style="margin-bottom:10px" />
          <div class="f-lab">剧情禁区</div><input v-model="form.taboo" placeholder="如：不能出现真实暴力" style="margin-bottom:10px" />
          <div class="f-lab">期望结局</div>
          <div class="chips" style="margin-bottom:10px">
            <span class="chip" :class="{ on: form.ending === 'HE' }" @click="form.ending = 'HE'">HE 好结局</span>
            <span class="chip" :class="{ on: form.ending === 'BE' }" @click="form.ending = 'BE'">BE 坏结局</span>
          </div>
          <div class="f-lab">叙事文风</div>
          <select v-model="form.style"><option>梦境意识流</option><option>童话寓言</option><option>暗黑哥特</option><option>日式治愈</option></select>
        </div>
        <div class="modal-f">
          <button class="btn-ghost grow" @click="showCreate = false">取消</button>
          <button class="btn-main" style="height:36px" @click="create">入梦</button>
        </div>
      </div>
    </div>

    <div v-if="showTaboo" class="sheet-mask" @click.self="showTaboo = false">
      <div class="sheet">
        <div class="sheet-t">梦境设定（可实时调整）</div>
        <div class="f-lab">剧情禁区</div><input v-model="cur.taboo" style="margin-bottom:10px" />
        <div class="f-lab">结局倾向</div>
        <div class="chips" style="margin-bottom:10px">
          <span class="chip" :class="{ on: cur.ending === 'HE' }" @click="cur.ending = 'HE'">HE</span>
          <span class="chip" :class="{ on: cur.ending === 'BE' }" @click="cur.ending = 'BE'">BE</span>
        </div>
        <div class="f-lab">文风</div>
        <select v-model="cur.style"><option>梦境意识流</option><option>童话寓言</option><option>暗黑哥特</option><option>日式治愈</option></select>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dream-body { background: radial-gradient(ellipse at top, #1a1440, var(--bg)); }
.dream-text { font-size: 14px; line-height: 1.9; white-space: pre-wrap; color: #d8d4ff; margin-bottom: 14px; }
.dream-choice { font-size: 12px; color: var(--sub); margin-bottom: 14px; text-align: right; }
.dream-end { text-align: center; padding: 20px; font-size: 16px; font-weight: 600; border: 1px dashed var(--sub); border-radius: 14px; margin-top: 10px; }
.ctrl-bar { display: flex; gap: 8px; padding: 10px 14px; background: var(--card); border-top: 1px solid var(--border); flex-shrink: 0; }
</style>
