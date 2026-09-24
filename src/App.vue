<script setup>
import { S, nav, toast, applyTheme, applyBeautifyJS, getChar, openPage } from './core/store'
import { startProactiveLoop } from './core/engine'
import { timeInfo } from './core/util'
import { ref, computed, onMounted, watch } from 'vue'
import ThemeBar from './pages/ThemeBar.vue'
import Phone from './pages/Phone.vue'
import ChatList from './pages/ChatList.vue'
import ChatDetail from './pages/ChatDetail.vue'
import GroupChat from './pages/GroupChat.vue'
import Contacts from './pages/Contacts.vue'
import Profile from './pages/Profile.vue'
import Mine from './pages/Mine.vue'
import Moments from './pages/Moments.vue'
import Settings from './pages/Settings.vue'
import WorldBook from './pages/WorldBook.vue'
import Snoop from './pages/Snoop.vue'
import MapApp from './pages/MapApp.vue'
import Offline from './pages/Offline.vue'
import Roleplay from './pages/Roleplay.vue'
import Dream from './pages/Dream.vue'
import Couple from './pages/Couple.vue'
import Pet from './pages/Pet.vue'
import House from './pages/House.vue'
import RedLine from './pages/RedLine.vue'
import Fanfic from './pages/Fanfic.vue'
import Forum from './pages/Forum.vue'
import Music from './pages/Music.vue'
import Shop from './pages/Shop.vue'
import Games from './pages/Games.vue'
import Treehole from './pages/Treehole.vue'
import BabyTree from './pages/BabyTree.vue'
import Live from './pages/Live.vue'

const PAGES = { ChatDetail, GroupChat, Contacts, Profile, Mine, Moments, WorldBook, Snoop, MapApp, Offline, Roleplay, Dream, Couple, Pet, House, RedLine, Fanfic, Forum, Music, Shop, Games, Treehole, BabyTree, Live }

const clock = ref(timeInfo())
setInterval(() => clock.value = timeInfo(), 10000)

const roots = { phone: Phone, chat: ChatList, worldbook: WorldBook, settings: Settings }
const rootComp = computed(() => roots[nav.tab] || Phone)

const topNotify = computed(() => S.notify.find(n => !n.read))
const notiChar = computed(() => topNotify.value ? getChar(topNotify.value.charId) : null)

onMounted(() => {
  applyTheme(); applyBeautifyJS(); startProactiveLoop()
  watch(() => S.theme, applyTheme, { deep: true })
  watch(() => S.fonts, applyTheme, { deep: true })
  watch(() => S.beautify.css + S.beautify.enabled, applyBeautifyJS)
})

function tabIcon(t) {
  return { phone: '⌂', chat: '💬', worldbook: '📖', settings: '⚙' }[t]
}
function tabName(t) {
  return { phone: '桌面', chat: '聊天', worldbook: '世界书', settings: '设置' }[t]
}
function openNoti() {
  if (topNotify.value) {
    S.notify.forEach(n => n.read = true)
    if (topNotify.value.charId) openPage('ChatDetail', { charId: topNotify.value.charId })
  }
}
</script>

<template>
  <div class="phone" :class="{ deco: S.theme.anim.deco }">
    <!-- 状态栏 -->
    <div class="statusbar" :style="{ opacity: S.settings.statusbarOpacity }">
      <div class="sb-l">
        <div class="sb-time">{{ clock.clock }}</div>
        <div class="sb-date">{{ clock.date }} {{ clock.week }}</div>
      </div>
      <div class="sb-c" v-if="S.settings.customText">{{ S.settings.customText }}</div>
      <div class="sb-r">
        <svg class="icon16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" stroke-linecap="round"/></svg>
        <svg class="icon16" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="7" width="17" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="9" width="11" height="6" rx="1"/><path d="M21 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <span style="font-size:10px">100</span>
      </div>
    </div>

    <!-- 页面区域 -->
    <div class="pages">
      <transition :name="S.theme.anim.page === 'none' ? '' : 'page-anim'">
        <component :is="rootComp" :key="'root-' + nav.tab" class="root-page" />
      </transition>
      <transition-group name="page-anim">
        <div v-for="(p, i) in nav.stack" :key="p.key" class="stack-page" :style="{ zIndex: 10 + i }">
          <component :is="PAGES[p.name]" v-bind="p.props" />
        </div>
      </transition-group>
    </div>

    <!-- 底部导航（仅根页面显示） -->
    <div class="bottom-nav" v-if="nav.stack.length === 0" :class="S.theme.barStyle">
      <div v-for="t in ['phone', 'chat', 'worldbook', 'settings']" :key="t" class="bn-tab" :class="{ on: nav.tab === t }" @click="nav.tab = t">
        <div class="bn-ind" v-if="nav.tab === t"></div>
        <span class="bn-ico">{{ tabIcon(t) }}</span>
        <span class="bn-txt">{{ tabName(t) }}</span>
      </div>
    </div>

    <!-- 通知横幅 -->
    <transition name="slide-down">
      <div v-if="topNotify && nav.stack.length === 0" class="notify-banner" @click="openNoti">
        <div class="avatar" style="width:34px;height:34px">
          <img v-if="notiChar?.avatar" :src="notiChar.avatar" />
          <span v-else class="ph">{{ (notiChar?.name || '?')[0] }}</span>
        </div>
        <div class="grow" style="min-width:0">
          <div style="font-size:13px;font-weight:600">{{ notiChar?.name || '通知' }}</div>
          <div class="line1" style="font-size:12px;color:var(--sub)">{{ topNotify.text }}</div>
        </div>
        <span class="muted">{{ new Date(topNotify.time).getHours() + ':' + String(new Date(topNotify.time).getMinutes()).padStart(2, '0') }}</span>
      </div>
    </transition>

    <!-- 装扮快捷栏 -->
    <ThemeBar />

    <div v-if="toast.show" class="toast">{{ toast.text }}</div>
  </div>
</template>

<style scoped>
.statusbar {
  height: var(--bar-h); position: absolute; top: 0; left: 0; right: 0; z-index: 50;
  display: flex; align-items: center; padding: 0 20px; gap: 8px;
  background: var(--bg);
}
.sb-l { display: flex; flex-direction: column; justify-content: center; }
.sb-time { font-size: 24px; font-weight: 700; letter-spacing: 1px; line-height: 1; }
.sb-date { font-size: 11px; color: var(--sub); margin-top: 2px; }
.sb-c { flex: 1; text-align: center; font-size: 12px; color: var(--sub); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.sb-r { margin-left: auto; display: flex; align-items: center; gap: 5px; color: var(--text); }
.pages { position: absolute; top: var(--bar-h); bottom: 0; left: 0; right: 0; overflow: hidden; }
.root-page, .stack-page { position: absolute; inset: 0; }
.bottom-nav {
  position: absolute; bottom: 0; left: 0; right: 0; z-index: 40;
  height: 78px; display: flex; padding-bottom: 14px;
  background: var(--card); border-top: 1px solid var(--border);
}
.bottom-nav.glass { background: color-mix(in srgb, var(--card) calc(var(--bar-opacity) * 100%), transparent); backdrop-filter: blur(16px); border-top: none; }
.bottom-nav.plain { background: var(--card); }
.bottom-nav.transparent { background: transparent; backdrop-filter: none; }
.bottom-nav.raise1 { box-shadow: 0 -2px 8px rgba(0,0,0,.25); }
.bottom-nav.raise2 { box-shadow: 0 -6px 20px rgba(0,0,0,.45); border-radius: 20px 20px 0 0; }
.bn-tab { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; cursor: pointer; position: relative; color: var(--sub); filter: grayscale(.6); }
.bn-tab.on { color: var(--text); filter: none; }
.bn-ind { position: absolute; top: 0; width: 24px; height: 3px; border-radius: 2px; background: var(--accent); }
.bn-ico { font-size: 22px; line-height: 1; }
.bn-txt { font-size: 11px; }
.notify-banner {
  position: absolute; top: calc(var(--bar-h) + 8px); left: 10px; right: 10px; z-index: 200;
  background: rgba(30,30,30,.92); backdrop-filter: blur(12px); color: #fff;
  border-radius: 16px; padding: 10px 14px; display: flex; align-items: center; gap: 10px;
  box-shadow: 0 8px 30px rgba(0,0,0,.5); cursor: pointer;
}
.page-anim-enter-active, .page-anim-leave-active { transition: all .2s; }
.page-anim-enter-from { opacity: 0; transform: translateX(30px); }
.page-anim-leave-to { opacity: 0; }
.slide-down-enter-active, .slide-down-leave-active { transition: all .3s; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-20px); }
</style>
