<script setup>
import { S, closePage, showToast, uid, now } from '../core/store'
import { randName, hashStr, getConstellation, mulberry } from '../core/util'
import { simpleAsk } from '../core/engine'
import { ref } from 'vue'

const tab = ref('hole') // hole / astro
const titles = ['夜色', '心事', '想念', '秘密']
const curTitle = ref('心事')
const content = ref('')
const showAstro = ref(false)
const astro = ref({ charId: '', date: '' })
const astroResult = ref(null)
const astroLoading = ref(false)

const anonColors = ['#5a7ad4', '#8a5ad4', '#d45a8a', '#5ad4a0', '#d4a05a', '#5ac8d4']
function publish() {
  if (!content.value.trim()) return showToast('写点什么再发布')
  const seed = hashStr(content.value + Date.now())
  const anon = { name: randName(), color: anonColors[seed % anonColors.length] }
  S.treehole.unshift({ id: uid(), title: curTitle.value, content: content.value.trim(), time: now(), anon, replies: [] })
  content.value = ''
  showToast(`已匿名发布，你是「${anon.name}」`)
}
function reply(t) {
  const text = prompt('回复这条树洞')
  if (text?.trim()) t.replies.push({ id: uid(), text: text.trim(), anon: { name: randName(), color: anonColors[hashStr(text) % anonColors.length] } })
}
/* 星盘（本机计算） */
async function calcAstro() {
  if (!astro.value.date) return showToast('选择生日')
  astroLoading.value = true
  const d = new Date(astro.value.date + 'T12:00:00')
  const sun = getConstellation(d.getMonth() + 1, d.getDate())
  // 月亮星座：按日期偏移的确定性近似（本机计算，月周期27.3天映射12星座）
  const days = Math.floor(d.getTime() / 86400000) % 273
  const moonIdx = Math.floor(days / 273 * 12) % 12
  const names = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座']
  const moon = names[moonIdx]
  // 上升星座：以一天24h近似旋转（本机近似计算）
  const ascIdx = (Math.floor(days / 273 * 12) + 6 + d.getHours()) % 12
  const asc = names[ascIdx]
  const rndGen = mulberry(hashStr(astro.value.date))
  const traits = [
    `太阳${sun}：核心人格，${sun}的典型能量主导你的外在表现`,
    `月亮${moon}：情绪模式，内心安全感来自${moon}的领域`,
    `上升${asc}：给人的第一印象，社交面具呈现${asc}气质`
  ]
  const c = S.chars.find(x => x.id === astro.value.charId)
  let aiTxt = ''
  if (c) {
    try {
      aiTxt = await simpleAsk(`你是占星师。根据星盘（太阳${sun}、月亮${moon}、上升${asc}）解读角色「${c.name}」（设定：${(c.persona || '').slice(0, 120)}）的感情相处之道，80字内。`, '解读', { maxTokens: 150 })
    } catch {}
  }
  astroResult.value = { sun, moon, asc, traits, aiTxt, lucky: Math.floor(rndGen() * 90) + 10 }
  astroLoading.value = false
}
</script>

<template>
  <div class="page">
    <div class="topbar">
      <button class="tb-btn tb-back" @click="closePage">‹</button>
      <b>匿名树洞</b>
      <span class="grow"></span>
    </div>
    <div class="tabs">
      <div class="tab" :class="{ on: tab === 'hole' }" @click="tab = 'hole'">树洞</div>
      <div class="tab" :class="{ on: tab === 'astro' }" @click="tab = 'astro'">星盘</div>
    </div>

    <!-- 树洞 -->
    <template v-if="tab === 'hole'">
      <div class="body" style="padding:14px">
        <div class="card">
          <div class="chips" style="margin-bottom:10px">
            <span v-for="t in titles" :key="t" class="chip" :class="{ on: curTitle === t }" @click="curTitle = t">{{ t }}</span>
          </div>
          <textarea v-model="content" rows="3" placeholder="匿名说出来吧，没人知道你是谁..." style="margin-bottom:10px"></textarea>
          <button class="btn-main" @click="publish">匿名发布</button>
          <div class="muted center mt8" style="font-size:11px">发布后将获得随机匿名身份</div>
        </div>
        <div v-for="t in S.treehole" :key="t.id" class="card">
          <div class="row">
            <span class="anon-av" :style="{ background: t.anon.color }">{{ t.anon.name.slice(2, 3) }}</span>
            <b style="font-size:13px">{{ t.anon.name }}</b>
            <span class="tag">{{ t.title }}</span>
            <span class="grow"></span><span class="muted" style="font-size:10px">刚刚</span>
          </div>
          <div style="font-size:14px;line-height:1.7;margin-top:8px;white-space:pre-wrap">{{ t.content }}</div>
          <div class="row mt8"><button class="btn-mini" @click="reply(t)">💬 回应 {{ t.replies.length }}</button></div>
          <div v-for="r in t.replies" :key="r.id" class="mo-comment"><span class="anon-av sm" :style="{ background: r.anon.color }"></span><b>{{ r.anon.name }}</b>：{{ r.text }}</div>
        </div>
        <div v-if="!S.treehole.length" class="empty">树洞还是空的</div>
      </div>
    </template>

    <!-- 星盘 -->
    <template v-else>
      <div class="body" style="padding:14px">
        <div class="card">
          <div class="f-lab">选择角色</div>
          <select v-model="astro.charId" style="margin-bottom:10px"><option value="">仅看星盘</option><option v-for="c in S.chars" :key="c.id" :value="c.id">{{ c.name }}</option></select>
          <div class="f-lab">生日</div>
          <input v-model="astro.date" type="date" style="margin-bottom:12px" />
          <button class="btn-main" @click="calcAstro" :disabled="astroLoading">{{ astroLoading ? '推算中...' : '🔮 看星盘（本机计算）' }}</button>
        </div>
        <div v-if="astroResult" class="card center">
          <div style="font-size:34px">🪐</div>
          <div class="row mt8" style="justify-content:center;gap:8px;flex-wrap:wrap">
            <span class="tag hot">太阳 {{ astroResult.sun }}</span>
            <span class="tag">月亮 {{ astroResult.moon }}</span>
            <span class="tag">上升 {{ astroResult.asc }}</span>
          </div>
          <div class="mt12" style="text-align:left">
            <div v-for="(t, i) in astroResult.traits" :key="i" class="muted" style="font-size:13px;margin-bottom:6px">{{ t }}</div>
          </div>
          <div class="muted mt8">今日运势指数：{{ astroResult.lucky }} / 100</div>
          <div v-if="astroResult.aiTxt" class="card mt12" style="margin:12px 0 0;background:var(--card2)"><div class="f-lab">角色占星解读</div><div style="font-size:13px;line-height:1.7">{{ astroResult.aiTxt }}</div></div>
        </div>
      </div>
    </template>
    <div style="height:80px"></div>
  </div>
</template>

<style scoped>
.anon-av { width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; flex-shrink: 0; }
.anon-av.sm { width: 18px; height: 18px; font-size: 0; display: inline-block; }
.mo-comment { font-size: 12px; color: var(--sub); margin-top: 6px; display: flex; align-items: center; gap: 6px; }
</style>
