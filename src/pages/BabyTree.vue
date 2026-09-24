<script setup>
import { S, closePage, showToast, uid, now, gainCoins } from '../core/store'
import { ref, computed } from 'vue'

const STAGES = ['种子', '新芽', '幼苗', '小树', '茂树', '大树']
const MAX_BABIES = 6
const showAdd = ref(false)
const newName = ref('')
const petal = ref(0)

const branches = computed(() => {
  // 6 根树枝固定分布
  const pos = [
    { x: 26, y: 88 }, { x: 68, y: 82 }, { x: 18, y: 64 }, { x: 76, y: 60 }, { x: 38, y: 44 }, { x: 58, y: 30 }
  ]
  return pos.map((p, i) => ({ i, ...p, baby: S.babies[i] || null }))
})

function addBaby() {
  if (S.babies.length >= MAX_BABIES) return showToast('最多六个宝宝')
  if (!newName.value.trim()) return showToast('起个名字')
  S.babies.push({ id: uid(), name: newName.value.trim(), grow: 0, stage: 0, lastFeed: 0, lastPlay: 0, lastSchool: 0, mood: 60 })
  newName.value = ''
  showAdd.value = false
  showToast('新生命已种下')
}
const b = i => S.babies[i]
function act(i, kind) {
  const bb = b(i)
  if (!bb) return
  const today = new Date().toDateString()
  const last = new Date(bb['last' + kind] || 0).toDateString()
  const gain = kind === 'Feed' ? 8 : kind === 'Play' ? 6 : 5
  if (last === today) return showToast('TA今天已经被照顾过了，明天再来')
  bb['last' + kind] = now()
  bb.grow += gain
  bb.mood = Math.min(100, bb.mood + (kind === 'Play' ? 15 : 8))
  gainCoins(2, `照顾宝宝${bb.name}`)
  petal.value = (petal.value + 1) % 360
  // 升阶：每100成长值升一阶
  while (bb.grow >= 100 && bb.stage < 5) {
    bb.grow -= 100
    bb.stage++
    showToast(`${bb.name}升阶了：${STAGES[bb.stage]}！`)
  }
}
function remove(i) {
  const bb = b(i)
  if (bb && confirm(`移除「${bb.name}」？`)) S.babies.splice(i, 1)
}
const stageIcon = st => ['🌰', '🌱', '🌿', '🌳', '🌳', '🌸'][st] || '🌰'
</script>

<template>
  <div class="page">
    <div class="topbar">
      <button class="tb-btn tb-back" @click="closePage">‹</button>
      <b>宝宝树</b>
      <span class="grow"></span>
      <button class="tb-btn" style="font-size:22px" @click="showAdd = true">＋</button>
    </div>
    <div class="body" style="padding:12px">
      <div class="tree-wrap">
        <svg viewBox="0 0 100 100" class="tree-svg">
          <path d="M50 96 C48 78 46 70 50 58 C54 46 50 38 50 30" stroke="#5a4a3a" stroke-width="3.2" fill="none" />
          <path d="M50 58 C44 52 38 52 32 54 M50 46 C56 42 62 44 66 42 M50 66 C42 64 36 68 30 70 M50 40 C46 34 40 34 36 32" stroke="#5a4a3a" stroke-width="1.6" fill="none" />
          <circle cx="50" cy="26" r="12" fill="rgba(120,200,140,.18)" />
          <circle cx="34" cy="52" r="8" fill="rgba(120,200,140,.12)" />
          <circle cx="66" cy="40" r="9" fill="rgba(120,200,140,.12)" />
          <circle v-for="br in branches.filter(x => x.baby)" :key="'g' + br.i" :cx="br.x" :cy="br.y" r="5" :fill="`rgba(255,180,120,${0.06 + br.baby.stage * 0.03})`" :style="{ transform: `rotate(${petal}deg)`, transformOrigin: `${br.x}px ${br.y}px` }" />
        </svg>
        <!-- 宝宝头像挂在树枝上 -->
        <div v-for="br in branches" :key="br.i" class="branch-baby" :style="{ left: br.x + '%', top: br.y + '%' }">
          <template v-if="br.baby">
            <div class="bb-av" @click="remove(br.i)" :title="'长按/点击移除'">
              <span style="font-size:16px">{{ stageIcon(br.baby.stage) }}</span>
            </div>
            <div class="bb-name">{{ br.baby.name }}</div>
            <div class="bb-tools">
              <button class="bt" @click="act(br.i, 'Feed')" title="喂养">🍼</button>
              <button class="bt" @click="act(br.i, 'Play')" title="陪伴">🎈</button>
              <button class="bt" @click="act(br.i, 'School')" title="上学">🎒</button>
            </div>
            <div class="bb-grow"><div :style="{ width: br.baby.grow + '%' }"></div></div>
          </template>
          <div v-else class="bb-empty" @click="showAdd = true">＋</div>
        </div>
      </div>
      <div class="hint-txt center">{{ S.babies.length }}/6 个宝宝 · 每照顾一次 +成长值，每100点升一阶（种子→新芽→幼苗→小树→茂树→大树）</div>

      <div v-for="(bb, i) in S.babies" :key="bb.id" class="card">
        <div class="row">
          <span style="font-size:20px">{{ stageIcon(bb.stage) }}</span>
          <b>{{ bb.name }}</b>
          <span class="tag">{{ STAGES[bb.stage] }}</span>
          <span class="grow"></span>
          <span class="muted" style="font-size:11px">成长 {{ bb.grow }}/100 · 心情 {{ bb.mood }}</span>
        </div>
      </div>
      <div style="height:60px"></div>
    </div>

    <div v-if="showAdd" class="mask" @click.self="showAdd = false">
      <div class="modal">
        <div class="modal-t">种下新宝宝</div>
        <input v-model="newName" placeholder="宝宝的名字" />
        <div class="modal-f"><button class="btn-ghost grow" @click="showAdd = false">取消</button><button class="btn-main" style="height:36px" @click="addBaby">种下</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tree-wrap { position: relative; background: linear-gradient(180deg, rgba(30,50,40,.35), var(--card)); border: 1px solid var(--border); border-radius: 16px; aspect-ratio: 340 / 300; overflow: hidden; }
.tree-svg { width: 100%; height: 100%; }
.branch-baby { position: absolute; transform: translate(-50%, -50%); text-align: center; width: 56px; }
.bb-av { width: 34px; height: 34px; margin: 0 auto; border-radius: 50%; background: var(--card); border: 2px solid var(--accent); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.bb-name { font-size: 9px; margin-top: 2px; color: var(--text); }
.bb-tools { display: flex; gap: 2px; justify-content: center; margin-top: 2px; }
.bt { width: 18px; height: 18px; font-size: 11px; background: var(--card2); border-radius: 50%; display: flex; align-items: center; justify-content: center; padding: 0; }
.bb-grow { height: 3px; background: var(--card2); border-radius: 2px; margin-top: 3px; overflow: hidden; }
.bb-grow div { height: 100%; background: #7ac87f; }
.bb-empty { width: 28px; height: 28px; margin: 0 auto; border: 1px dashed var(--sub); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--sub); cursor: pointer; font-size: 14px; }
</style>
