<script setup>
import { S, applyTheme, showToast, THEMES, persist } from '../core/store'
import { pickFile, readAsDataURL, compressImage } from '../core/util'
import { ref } from 'vue'

const panel = ref(null) // 'wall' 'color' 'icon' 'text'
function toggle(p) { panel.value = panel.value === p ? null : p }

async function setWallpaper() {
  const f = await pickFile('image/*')
  if (!f) return
  S.theme.desktopBg = await readAsDataURL(f)
  applyTheme()
}
function clearColor() {
  S.theme.custom = { bg: '', card: '', text: '', sub: '', border: '', accent: '' }
  applyTheme()
}
function resetTheme() {
  S.theme.preset = 'bw'
  clearColor()
  S.theme.bubble = { style: 'round', avatarShape: 'circle', opacity: 100, chatBg: '', chatBgOpacity: 100, chatBgBlur: 0 }
  S.theme.icon = { size: 'm', radius: 14 }
  S.theme.desktopBg = ''
  S.theme.barStyle = 'glass'
  showToast('已重置主题')
}
async function importIcons() {
  const files = await pickFile('image/*', true)
  if (!files?.length) return
  const ids = Object.keys(S.phone.icons).length
  for (let i = 0; i < files.length; i++) {
    const url = await compressImage(files[i], 128)
    S.phone.icons['icon' + (ids + i)] = url
  }
  showToast('已导入' + files.length + '张图标素材')
}
</script>

<template>
  <div class="themebar" style="z-index:9999">
    <button class="tb-cir" :class="{ on: panel === 'wall' }" @click="toggle('wall')" title="壁纸">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M3 15l5-5 4 4 3-3 6 6"/><circle cx="9" cy="8" r="1.5"/></svg>
    </button>
    <button class="tb-cir" :class="{ on: panel === 'color' }" @click="toggle('color')" title="配色">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l7 5"/></svg>
    </button>
    <button class="tb-cir" :class="{ on: panel === 'icon' }" @click="toggle('icon')" title="图标">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>
    </button>
    <button class="tb-cir" :class="{ on: panel === 'text' }" @click="toggle('text')" title="文案">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 6h14M12 6v13M9 19h6"/></svg>
    </button>
    <button class="tb-cir" @click="resetTheme" title="重置">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10a8 8 0 0 1 14-4M20 14a8 8 0 0 1-14 4M18 2v4h-4M6 22v-4h4"/></svg>
    </button>
  </div>

  <transition name="fade">
    <div v-if="panel" class="sheet-mask" @click.self="panel = null">
      <div class="sheet">
        <div class="sheet-t">装扮 · {{ { wall: '壁纸', color: '配色', icon: '图标', text: '文案' }[panel] }}</div>
        <div class="sheet-b">
          <!-- 壁纸 -->
          <template v-if="panel === 'wall'">
            <button class="btn-main" @click="setWallpaper">上传桌面壁纸</button>
            <div class="row mt12">
              <button class="btn-ghost grow" @click="S.theme.desktopBg = ''; applyTheme()">恢复纯色</button>
            </div>
            <div class="slider-row mt12"><span class="muted">不透明</span><input type="range" min="20" max="100" v-model="S.theme.desktopBgOpacity" /><span class="muted">模糊</span><input type="range" min="0" max="20" v-model="S.theme.desktopBgBlur" /></div>
          </template>
          <!-- 配色 -->
          <template v-else-if="panel === 'color'">
            <div class="chips">
              <span v-for="(t, k) in THEMES" :key="k" class="chip" :class="{ on: S.theme.preset === k }" @click="S.theme.preset = k; applyTheme()">{{ t.name }}</span>
            </div>
            <div class="mt12">
              <div v-for="c in ['bg', 'card', 'text', 'sub', 'border', 'accent']" :key="c" class="row" style="margin-bottom:8px">
                <span class="muted" style="width:64px">{{ { bg: '背景色', card: '卡片色', text: '主文字', sub: '次文字', border: '边框色', accent: '强调色' }[c] }}</span>
                <input type="color" :value="S.theme.custom[c] || THEMES[S.theme.preset][c]" @input="S.theme.custom[c] = $event.target.value; applyTheme()" style="width:48px;height:32px;padding:2px" />
                <span class="muted grow">{{ S.theme.custom[c] || '跟随预设' }}</span>
              </div>
              <button class="btn-ghost" @click="clearColor">清除自定义颜色</button>
            </div>
          </template>
          <!-- 图标 -->
          <template v-else-if="panel === 'icon'">
            <div class="slider-row"><span class="muted">圆角</span><input type="range" min="0" max="29" v-model="S.theme.icon.radius" @change="applyTheme" /><span class="muted">{{ S.theme.icon.radius }}px</span></div>
            <div class="f-lab mt8">图标尺寸</div>
            <div class="chips"><span class="chip" :class="{ on: S.theme.icon.size === 's' }" @click="S.theme.icon.size = 's'">小</span><span class="chip" :class="{ on: S.theme.icon.size === 'm' }" @click="S.theme.icon.size = 'm'">中</span><span class="chip" :class="{ on: S.theme.icon.size === 'l' }" @click="S.theme.icon.size = 'l'">大</span></div>
            <button class="btn-main mt12" @click="importIcons">批量导入图标素材</button>
            <div class="hint-txt" v-if="Object.keys(S.phone.icons).length">已导入 {{ Object.keys(S.phone.icons).length }} 张素材，可在编辑桌面时使用</div>
          </template>
          <!-- 文案 -->
          <template v-else-if="panel === 'text'">
            <div class="f-lab">状态栏自定义文案</div>
            <input v-model="S.settings.customText" placeholder="显示在状态栏中间的一句话" />
            <div class="f-lab mt12">输入框占位符（聊天页）</div>
            <input v-model="S.settings.inputPlaceholder" placeholder="说点什么..." />
          </template>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.themebar {
  position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); z-index: 9999;
  height: 56px; padding: 0 18px; display: flex; align-items: center; gap: 22px;
  background: rgba(17,17,17,.85); backdrop-filter: blur(12px);
  border-radius: 56px; border: 1px solid rgba(255,255,255,.1);
  box-shadow: 0 6px 24px rgba(0,0,0,.5);
}
.tb-cir { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; opacity: .75; cursor: pointer; }
.tb-cir.on, .tb-cir:hover { opacity: 1; background: rgba(255,255,255,.14); }
.tb-cir svg { width: 20px; height: 20px; }
</style>
