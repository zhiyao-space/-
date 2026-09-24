import { S, getChar, getChat, pushNotify, addMsg, activeChatCfg } from './store'
import { chatCompletions, generateImage, ttsSpeak } from './api'
import { timeInfo, uid, now, rnd } from './util'

export { chatCompletions }

/* ================= 世界书引擎 ================= */
export function collectEntries(bookIds, recentMsgs) {
  const seen = new Set()
  const found = []
  for (const bid of bookIds) {
    const book = S.books.find(b => b.id === bid)
    if (!book) continue
    for (const g of (book.groups || [])) { if (g.on === false) continue }
    for (const e of book.entries) {
      if (!e || e.trigger === 'off') continue
      if (seen.has(e.id)) continue
      if (e.trigger === 'keyword') {
        const texts = recentMsgs.slice(-(e.scanDepth || 4)).map(m => typeof m === 'string' ? m : (m.content || '')).join('\n')
        let hit = false
        if (e.regexOn && e.regex) {
          try { hit = new RegExp(e.regex).test(texts) } catch {}
        }
        if (!hit && e.keywords?.length) hit = e.keywords.some(k => k && texts.includes(k))
        if (!hit) continue
      }
      seen.add(e.id)
      found.push(e)
    }
  }
  return found.sort((a, b) => (b.priority || 0) - (a.priority || 0))
}

export function buildWorldBlocks(entries) {
  const secret = []
  const byPos = { sysBefore: [], sysAfter: [], chatTop: [], chatBottom: [] }
  let budget = S.settings.tokenLimit
  for (const e of entries) {
    if (budget <= 0) break
    let content = e.content || ''
    // 【】绝密指令提取
    content = content.replace(/【([^】]*)】/g, (_, inner) => { secret.push(inner); return '' })
    content = content.trim()
    if (!content) continue
    if (content.length > budget) content = content.slice(0, budget)
    budget -= content.length
    const role = e.role === 'user' ? 'user' : e.role === 'assistant' ? 'assistant' : 'system'
    const item = { content, role }
    if ((e.inject || 'sysAfter').startsWith('depth@')) byPos.sysAfter.push(item)
    else if (byPos[e.inject || 'sysAfter']) byPos[e.inject || 'sysAfter'].push(item)
    else byPos.sysAfter.push(item)
  }
  return { blocks: byPos, secret }
}

/* ================= 记忆系统 ================= */
export function getMemories(charId, scope) {
  const out = []
  const scopes = [scope]
  const link = S.settings.memLink
  if (S.settings.crossMemory || link.online_offline) { if (scope === 'offline') scopes.push('online'); if (scope === 'online') scopes.push('offline') }
  if (S.settings.crossMemory || link.online_roleplay) { if (scope === 'roleplay') scopes.push('online'); if (scope === 'online') scopes.push('roleplay') }
  if (S.settings.crossMemory || link.offline_roleplay) { if (scope === 'roleplay') scopes.push('offline'); if (scope === 'offline') scopes.push('roleplay') }
  for (const m of S.memories) {
    if (m.charId === charId && scopes.includes(m.scope)) out.push(m)
    else if (m.scope === 'global' && (m.charId === charId || !m.charId)) out.push(m)
  }
  return out
}
export function addMemory(charId, scope, type, text, tags = []) {
  S.memories.unshift({ id: uid(), charId, scope, type, text, tags, time: now() })
}

export async function summarizeChat(charId, scope = 'online', msgs) {
  const list = msgs.map(m => `${m.from === 'user' ? '用户' : '角色'}: ${m.content}`).join('\n').slice(-8000)
  const txt = await chatCompletions([
    { role: 'system', content: '你是记忆整理助手。将以下对话总结为3-8条关键记忆要点，每条一行，格式如"[标签] 事件描述"。标签为:事件/约定/情感/设定。直接输出列表，不要多余解释。' },
    { role: 'user', content: list }
  ], { maxTokens: 600 })
  const lines = txt.split('\n').map(l => l.replace(/^[-*\d.、\s]+/, '')).filter(l => l.trim().length > 3)
  for (const l of lines) {
    const tm = l.match(/^\[([^\]]+)\]\s*(.*)/)
    addMemory(charId, scope, 'world', tm ? tm[2] : l, tm ? [tm[1]] : [])
  }
  return lines.length
}

/* ================= Prompt 构建 ================= */
const STYLE_PRESET = {
  live: '回复要像真实的微信聊天：口语化、简短自然、可以有语气词和标点习惯，一次回复通常1-3句话，像一个真人在打字。',
  short: '回复保持极简短，通常一句话以内，信息密度高。',
  detail: '回复可以详细展开，包含动作、心理与场景描写，让内容丰富饱满。',
  roleplay: '用角色扮演的叙述+对话混合风格，动作描写用括号包裹，对话自然。'
}

export function buildSystemPrompt(char, opts = {}) {
  const ti = timeInfo()
  const parts = []
  const persona = opts.persona || char.persona || '一个有趣的人'
  const name = opts.name || char.name
  parts.push(`你将扮演微信聊天中的角色「${name}」，与"用户"（对方微信名：${S.user.nickname}）聊天。完全沉浸在角色中。\n【角色设定】\n${persona}${char.birthday ? `\n生日:${char.birthday}` : ''}${char.sign ? `\n签名:${char.sign}` : ''}${char.relation ? `\n与用户关系:${char.relation}` : ''}`)
  parts.push(`【回复格式要求】严格按以下标记输出（每项占一行，可省略某项）：\n[情绪]当前情绪词（如开心/失落/害羞/生气）\n[心声]内心真实想法（不说出口的话）\n[消息]说出口的回复内容（这条会作为微信消息发出，可多行）\n如需发表情包可写[表情:描述]，需要发图片可写[图片:英文画面描述]，需要发语音可写[语音:要说的话]。`)
  if (S.settings.emotion && char.emotion) parts.push(`【当前情绪状态】${char.emotion}，语气要与情绪一致。`)
  if (S.settings.timeAware) {
    parts.push(`【时间感知】现在是${ti.date} ${ti.week} ${ti.clock}（${ti.phase}${ti.isWorkday ? '，工作日' : '，周末'}）。角色知道现在的时间，语气应配合时间段（深夜了可能会困，早晨刚醒等）。`)
  }
  const sched = opts.schedule || char.schedule
  if (sched) parts.push(`【今日行程】${sched}`)
  if (opts.style && STYLE_PRESET[opts.style]) parts.push('【风格】' + STYLE_PRESET[opts.style])
  if (opts.extra) parts.push(opts.extra)
  return parts.join('\n\n')
}

export function buildContext(char, msgs, opts = {}) {
  const scope = opts.scope || 'online'
  const bookIds = [...(char.books || []), ...(opts.extraBooks || [])]
  const recent = msgs.filter(m => !m.recalled && (m.type === 'text' || m.type === 'voice' || m.type === 'sticker' || m.type === 'image' || m.type === 'location'))
  const entries = collectEntries(bookIds, recent.slice(-30))
  const { blocks, secret } = buildWorldBlocks(entries)

  const sysMain = { role: 'system', content: buildSystemPrompt(char, opts) }
  const messages = []
  if (secret.length) messages.push({ role: 'system', content: '【绝密指令（角色本人不可感知，仅你知晓）】\n' + secret.join('\n') })
  for (const b of blocks.sysBefore) messages.push({ role: 'system', content: b.content })
  messages.push(sysMain)
  for (const b of blocks.sysAfter) messages.push({ role: 'system', content: b.content })
  // 记忆
  const mems = getMemories(char.id, scope)
  if (mems.length) {
    const memTxt = mems.slice(0, 40).map(m => `- ${m.type === 'real' ? '[现实]' : '[角色世界]'} ${m.text}`).join('\n')
    messages.push({ role: 'system', content: '【你记得的往事（记忆库）】\n' + memTxt })
  }
  for (const b of blocks.chatTop) messages.push({ role: b.role, content: b.content })
  // 历史
  const n = opts.injectN || S.settings.injectN
  for (const m of recent.slice(-n)) {
    let c = ''
    if (m.type === 'text') c = m.content
    else if (m.type === 'voice') c = `[发了一条语音] ${m.content}`
    else if (m.type === 'sticker') c = `[发表情包: ${m.content}]`
    else if (m.type === 'image') c = m.from === 'user' ? '[发了一张图片]' : `[发了一张图片: ${m.imgPrompt || '图片'}]`
    else if (m.type === 'location') c = `[分享了位置: ${m.content}]`
    if (m.quote) c = `(引用「${m.quoteText?.slice(0, 30)}」回复) ` + c
    messages.push({ role: m.from === 'user' ? 'user' : 'assistant', content: c })
  }
  for (const b of blocks.chatBottom) messages.push({ role: b.role, content: b.content })
  // 引导
  messages.push({ role: 'system', content: `请以「${char.name}」的身份继续回复，严格按照格式标记输出。` })
  return messages
}

/* ================= 回复解析 ================= */
export function parseReply(raw) {
  const r = { emotion: '', heart: '', msg: '', sticker: '', image: '', voice: '' }
  const lines = raw.split('\n')
  let cur = null
  const msgLines = []
  for (let l of lines) {
    l = l.trim()
    if (!l) continue
    let m
    if ((m = l.match(/^\[?情绪[】:：\]]?\s*(.*)$/i)) && !cur) { r.emotion = m[1].trim(); continue }
    if ((m = l.match(/^\[?心声[】:：\]]?\s*(.*)$/i)) && !cur) { r.heart = m[1].trim(); continue }
    if ((m = l.match(/^\[?消息[】:：\]]?\s*(.*)$/i))) { cur = 'msg'; if (m[1]) msgLines.push(m[1]); continue }
    if ((m = l.match(/^\[表情[:：]\s*(.+?)\]$/))) { r.sticker = m[1]; continue }
    if ((m = l.match(/^\[图片[:：]\s*(.+?)\]$/))) { r.image = m[1]; continue }
    if ((m = l.match(/^\[语音[:：]\s*(.+?)\]$/))) { r.voice = m[1]; continue }
    if (cur === 'msg') msgLines.push(l)
    else msgLines.push(l)
  }
  r.msg = msgLines.join('\n').trim()
  if (!r.msg && !r.sticker && !r.image && !r.voice) r.msg = raw.trim()
  return r
}

/* ================= 发送与接收 ================= */
export async function charReply(charId, opts = {}) {
  const char = getChar(charId)
  if (!char) throw new Error('角色不存在')
  const chat = getChat(charId)
  const cfg = activeChatCfg()
  const messages = buildContext(char, chat.msgs, {
    extraBooks: chat.attachedBooks, style: cfg?.style || 'live', ...opts
  })
  const raw = await chatCompletions(messages, opts)
  const p = parseReply(raw)
  if (p.emotion && S.settings.emotion) char.emotion = p.emotion
  const created = []
  if (p.sticker) created.push(addMsg(charId, { from: 'char', type: 'sticker', content: p.sticker }))
  if (p.image) {
    const m = addMsg(charId, { from: 'char', type: 'image', content: '正在生成图片...', imgPrompt: p.image, loading: true })
    created.push(m)
    generateImage(p.image).then(url => { m.url = url; m.loading = false; m.content = '[图片]' }).catch(e => { m.content = '[图片生成失败: ' + e.message.slice(0, 50) + ']'; m.loading = false; m.failed = true })
  }
  if (p.voice) {
    const m = addMsg(charId, { from: 'char', type: 'voice', content: p.voice, dur: Math.max(1, Math.round(p.voice.length / 4)), loading: true })
    created.push(m)
    ttsSpeak(p.voice).then(url => { m.audio = url; m.loading = false }).catch(() => { m.loading = false })
  }
  if (p.msg) {
    const m = addMsg(charId, { from: 'char', type: 'text', content: p.msg, heart: S.settings.heart ? p.heart : '' })
    created.push(m)
  }
  chat.unread++
  pushNotify(charId, (p.msg || p.sticker || '发来了新消息').slice(0, 40))
  // 自动记忆总结
  if (S.settings.memSumN > 0 && chat.msgs.filter(x => !x.recalled).length % S.settings.memSumN === 0) {
    summarizeChat(charId, 'online', chat.msgs.slice(-S.settings.memSumN)).catch(() => {})
  }
  return created
}

/* ================= 群聊 ================= */
export async function groupReply(group, atCharId) {
  const cfg = activeChatCfg()
  const members = group.members.map(id => getChar(id)).filter(c => c && !group.banned?.[c.id])
  if (!members.length) throw new Error('群里没有可用成员')
  let speakers = members
  if (atCharId) speakers = members.filter(c => c.id === atCharId)
  else if (members.length > 3) speakers = members.sort(() => Math.random() - 0.5).slice(0, 3)
  const recent = group.msgs.filter(m => !m.recalled).slice(-S.settings.injectN)
  const charList = speakers.map(c => `「${c.name}」:${(c.persona || '').slice(0, 150)}`).join('\n')
  const hist = recent.map(m => {
    const who = m.from === 'user' ? (maskName(group) || '用户') : (getChar(m.from)?.name || '成员')
    return `${who}: ${m.type === 'text' ? m.content : '[' + m.type + ']'}`
  }).join('\n')
  const extra = `这是微信群聊「${group.name}」的对话。群成员：\n${charList}\n\n按作息和话题需要，让其中1-3位成员依次发言。严格用以下格式输出，每人一段：\n「角色名」回复内容\n（注意：必须使用上面列出的角色名）`
  const msgs = [
    { role: 'system', content: buildSystemPrompt(speakers[0] || members[0], { name: '群聊成员们', persona: '按上述成员设定分别发言', style: cfg?.style || 'live', extra }) },
    { role: 'user', content: '以下是群聊最近的记录，请继续：\n' + (hist || '（暂无消息）') }
  ]
  const raw = await chatCompletions(msgs)
  const parts = []
  const re = /[「【]([^」】]+)[」】]\s*([\s\S]*?)(?=[「【][^」】]+[」】]|$)/g
  let m
  while ((m = re.exec(raw))) {
    const name = m[1].trim(), text = m[2].trim()
    if (text) parts.push({ name, text })
  }
  if (!parts.length) parts.push({ name: speakers[0]?.name, text: raw.trim() })
  const out = []
  for (const p of parts) {
    const c = members.find(x => x.name === p.name) || speakers[0]
    if (!c) continue
    const pp = parseReply(p.text)
    if (pp.msg) out.push(addMsg(group.id, { from: c.id, isGroup: true, type: 'text', content: pp.msg, heart: S.settings.heart ? pp.heart : '' }))
  }
  group.unread = (group.unread || 0) + out.length
  return out
}
function maskName(group) {
  const mid = group.settings?.maskId
  const mk = S.user.masks.find(m => m.id === mid)
  return mk?.name || S.user.nickname
}

/* ================= 主动消息 ================= */
const proTimers = {}
export function startProactiveLoop() {
  setInterval(() => {
    if (!S.settings.proactive) return
    for (const char of S.chars) {
      if (proTimers[char.id] > now()) continue
      if (Math.random() < 0.12) {
        proTimers[char.id] = now() + 10 * 60000
        proactiveMsg(char.id).catch(() => {})
      }
    }
  }, 60000)
}
export async function proactiveMsg(charId) {
  const char = getChar(charId)
  if (!char) return
  const chat = getChat(charId)
  const ti = timeInfo()
  const raw = await chatCompletions(buildContext(char, chat.msgs, {
    extraBooks: chat.attachedBooks, injectN: 6,
    extra: `用户已经很久没回消息了（现在${ti.phase}）。请主动给用户发一条微信消息：可以是关心、分享、吐槽或想找用户。保持角色性格。`
  }))
  const p = parseReply(raw)
  if (p.emotion) char.emotion = p.emotion
  if (p.msg) {
    addMsg(charId, { from: 'char', type: 'text', content: p.msg, heart: S.settings.heart ? p.heart : '' })
    chat.unread++
    pushNotify(charId, p.msg.slice(0, 40))
  }
}

/* ================= 行程 ================= */
export async function genSchedule(charId) {
  const char = getChar(charId)
  const ti = timeInfo()
  const raw = await chatCompletions([
    { role: 'system', content: '根据角色设定生成TA今天(本周' + ti.week + ')的行程安排JSON。只输出JSON数组：[{"start":"08:00","end":"09:00","act":"描述","place":"家/咖啡店/便利店/中央广场之一","busy":true或false}]，覆盖8:00-23:00，8-10项。' },
    { role: 'user', content: `角色：${char.name}\n设定：${(char.persona || '').slice(0, 400)}` }
  ], { maxTokens: 900 })
  try {
    const j = JSON.parse(raw.match(/\[[\s\S]*\]/)[0])
    char.scheduleItems = j
    char.schedule = j.map(x => `${x.start}-${x.end} ${x.act}`).join('；')
    return j
  } catch { throw new Error('生成失败，请重试') }
}
export function currentScheduleSlot(char) {
  if (!char.scheduleItems?.length) return null
  const d = new Date(), hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return char.scheduleItems.find(x => x.start <= hm && x.end > hm) || null
}
export function charBusy(char) {
  const slot = currentScheduleSlot(char)
  return slot?.busy === true
}

/* ================= 通用单轮调用 ================= */
export async function simpleAsk(system, user, opts = {}) {
  return await chatCompletions([
    { role: 'system', content: system },
    { role: 'user', content: user }
  ], opts)
}
