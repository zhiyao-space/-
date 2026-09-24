<script setup>
import { S, showToast, uid, closePage } from '../core/store'
import { hashStr } from '../core/util'
import { ref, computed } from 'vue'

const showAdd = ref(false)
const form = ref({ name: '', relation: '', persona: '', history: '', status: '' })
const cur = ref(null)
const svgW = 340, svgH = 380

const nodes = computed(() => {
  const chars = S.chars.slice(0, 8).map((c, i) => {
    const ang = (i / Math.max(1, S.chars.length)) * Math.PI * 2 - Math.PI / 2
    return { id: c.id, name: c.name, avatar: c.avatar, x: svgW / 2 + Math.cos(ang) * 110, y: svgH / 2 + Math.sin(ang) * 120, color: '#3a7afe', isChar: true }
  })
  const npcs = S.redline.map((n, i) => {
    const ang = (i / Math.max(1, S.redline.length)) * Math.PI * 2
    return { id: n.id, name: n.name, avatar: '', x: svgW / 2 + Math.cos(ang) * 52, y: svgH / 2 + Math.sin(ang) * 58, color: '#e6439f', isChar: false, npc: n }
  })
  return [...chars, ...npcs]
})
function addNpc() {
  if (!form.value.name.trim()) return showToast('填写名字')
  S.redline.push({ id: uid(), ...JSON.parse(JSON.stringify(form.value)) })
  showAdd.value = false
  form.value = { name: '', relation: '', persona: '', history: '', status: '' }
  showToast('NPC 已加入关系网')
}
function lineColor(rel) {
  if (/恋|爱|情侣|暗恋/.test(rel)) return '#e6439f'
  if (/敌|恨|对手/.test(rel)) return '#e64340'
  if (/亲|家/.test(rel)) return '#4cd964'
  return '#3a7afe'
}
</script>

<template>
  <div class="page">
    <div class="topbar">
      <button class="tb-btn tb-back" @click="closePage">‹</button>
      <b>红线 · 关系网</b>
      <span class="grow"></span>
      <button class="tb-btn" style="font-size:22px" @click="showAdd = true">＋</button>
    </div>
    <div class="body" style="padding:10px">
      <div class="net-svg">
        <svg :width="svgW" :height="svgH" viewBox="0 0 340 380">
          <g v-for="n in nodes.filter(x => x.isChar)" :key="'l' + n.id">
            <line :x1="svgW / 2" :y1="svgH / 2" :x2="n.x" :y2="n.y" stroke="#3a7afe" stroke-width="1" opacity=".35" />
          </g>
          <g v-for="n in nodes.filter(x => !x.isChar)" :key="'ln' + n.id">
            <line :x1="svgW / 2" :y1="svgH / 2" :x2="n.x" :y2="n.y" :stroke="lineColor(n.npc.relation)" stroke-width="1.4" opacity=".6" />
          </g>
          <g v-for="n in nodes" :key="'n' + n.id" class="net-node" @click="!n.isChar && (cur = n.npc)">
            <circle :cx="n.x" :cy="n.y" :r="n.isChar ? 18 : 14" :fill="n.isChar ? '#2c3e5a' : '#3d1f33'" :stroke="n.color" stroke-width="1.5" />
            <image v-if="n.avatar" :x="n.x - 14" :y="n.y - 14" width="28" height="28" :href="n.avatar" clip-path="circle()" />
            <text v-else :x="n.x" :y="n.y + 4" text-anchor="middle" fill="#fff" font-size="11">{{ n.name[0] }}</text>
            <text :x="n.x" :y="n.y + (n.isChar ? 30 : 26)" text-anchor="middle" fill="currentColor" font-size="10" style="fill:var(--text)">{{ n.name }}</text>
            <text v-if="!n.isChar" :x="n.x" :y="n.y + 38" text-anchor="middle" font-size="8" style="fill:var(--sub)">{{ n.npc.relation }}</text>
          </g>
          <text :x="svgW / 2" :y="svgH / 2 - 22" text-anchor="middle" font-size="9" style="fill:var(--sub)">关系核心</text>
        </svg>
      </div>
      <div class="hint-txt">角色自动连入网络；手动添加NPC（名字/关系/性格/经历/目前状态）。红线=恋爱，绿线=亲人，蓝线=普通，红线深红=敌对。</div>

      <div v-for="n in S.redline" :key="n.id" class="card" style="cursor:pointer" @click="cur = n">
        <div class="row"><b>{{ n.name }}</b><span class="tag" :style="{ color: lineColor(n.relation), borderColor: lineColor(n.relation) }">{{ n.relation || '未知关系' }}</span>
          <span class="grow"></span>
          <button class="btn-mini warn" @click.stop="S.redline = S.redline.filter(x => x.id !== n.id)">删除</button>
        </div>
        <div class="muted mt8" v-if="n.persona">性格：{{ n.persona }}</div>
      </div>
      <div style="height:60px"></div>
    </div>

    <div v-if="showAdd" class="mask" @click.self="showAdd = false">
      <div class="modal" style="height:80%">
        <div class="modal-t">添加 NPC</div>
        <div class="modal-b">
          <div class="f-lab">名字 *</div><input v-model="form.name" style="margin-bottom:10px" />
          <div class="f-lab">关系</div><input v-model="form.relation" placeholder="如：发小 / 情敌 / 姐姐" style="margin-bottom:10px" />
          <div class="f-lab">性格</div><input v-model="form.persona" style="margin-bottom:10px" />
          <div class="f-lab">经历</div><textarea v-model="form.history" rows="3" style="margin-bottom:10px"></textarea>
          <div class="f-lab">目前状态</div><input v-model="form.status" placeholder="如：在外地读研" />
        </div>
        <div class="modal-f"><button class="btn-ghost grow" @click="showAdd = false">取消</button><button class="btn-main" style="height:36px" @click="addNpc">添加</button></div>
      </div>
    </div>

    <div v-if="cur" class="mask" @click.self="cur = null">
      <div class="modal">
        <div class="modal-t">{{ cur.name }}</div>
        <div class="modal-b">
          <div class="row" style="margin-bottom:10px"><span class="tag">{{ cur.relation || '未知关系' }}</span><span class="tag" v-if="cur.status">{{ cur.status }}</span></div>
          <div class="f-lab">性格</div><input v-model="cur.persona" style="margin-bottom:10px" />
          <div class="f-lab">经历</div><textarea v-model="cur.history" rows="3" style="margin-bottom:10px"></textarea>
          <div class="f-lab">目前状态</div><input v-model="cur.status" />
        </div>
        <div class="modal-f"><button class="btn-ghost grow" @click="cur = null">关闭</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.net-svg { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 6px; color: var(--text); display: flex; justify-content: center; }
.net-node { cursor: pointer; }
</style>
