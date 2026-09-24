import { S, activeChatCfg, activeImageCfg, showToast } from './store'

async function post(url, key, body, signal) {
  const res = await fetch(url, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { const j = await res.json(); msg = j.error?.message || j.message || JSON.stringify(j).slice(0, 200) } catch { try { msg = (await res.text()).slice(0, 200) } catch {} }
    throw new Error(msg)
  }
  return res.json()
}

/* ============ 聊天 ============ */
export async function chatCompletions(messages, opts = {}) {
  const cfg = activeChatCfg()
  if (!cfg || !cfg.baseUrl || !cfg.key) throw new Error('未配置聊天API，请到 设置 → API 配置 添加')
  const url = cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const body = {
    model: cfg.model || undefined,
    messages,
    temperature: opts.temperature ?? 0.8,
    max_tokens: opts.maxTokens ?? 2000,
    stream: false
  }
  if (cfg.extraParams) { try { Object.assign(body, JSON.parse(cfg.extraParams)) } catch {} }
  const j = await post(url, cfg.key, body, opts.signal)
  const txt = j.choices?.[0]?.message?.content ?? ''
  if (!txt) throw new Error('API返回为空')
  return txt
}

export async function testChat() {
  const r = await chatCompletions([{ role: 'user', content: '你好，请回复"连接成功"四个字' }], { maxTokens: 20 })
  return r.trim().slice(0, 50)
}

/* ============ 生图 ============ */
export async function generateImage(prompt, opts = {}) {
  const cfg = activeImageCfg()
  if (!cfg || !cfg.baseUrl || !cfg.key) throw new Error('未配置生图API，请到 设置 → API 配置 添加')
  const base = cfg.baseUrl.replace(/\/+$/, '')
  const size = opts.size || cfg.size || '512x512'
  const steps = opts.steps || cfg.steps || 25
  const cfgScale = opts.cfg ?? cfg.cfg ?? 7
  // 优先 OpenAI 兼容 images/generations
  try {
    const j = await post(base + '/images/generations', cfg.key, {
      model: cfg.model || undefined, prompt, n: 1, size, response_format: 'b64_json',
      ...(cfg.model && /novelai|sd|sdxl|stable/i.test(cfg.model) ? { steps, cfg_scale: cfgScale } : {})
    }, opts.signal)
    const d = j.data?.[0]
    if (d?.b64_json) return 'data:image/png;base64,' + d.b64_json
    if (d?.url) return d.url
    throw new Error('返回无图片数据')
  } catch (e) {
    // 回退 NovelAI 兼容
    if (/novelai/i.test(cfg.model || '')) {
      const [w, h] = size.split('x').map(Number)
      const r = await fetch(base + '/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.key}` },
        body: JSON.stringify({ input: prompt, model: cfg.model, action: 'generate', width: w, height: h, steps, scale: cfgScale })
      })
      if (!r.ok) throw e
      const blob = await r.blob()
      return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob) })
    }
    throw e
  }
}

export async function testImage() {
  return await generateImage('a simple black and white minimalist circle icon, white background', { size: '256x256' })
}

/* ============ STT ============ */
export async function sttTranscribe(audioBlob) {
  const { stt } = S.apiCfg
  if (!stt.key) throw new Error('未配置语音识别API')
  const fd = new FormData()
  fd.append('file', audioBlob, 'voice.webm')
  fd.append('model', stt.model || 'whisper-1')
  const res = await fetch((activeChatCfg()?.baseUrl || '').replace(/\/+$/, '') + '/audio/transcriptions', {
    method: 'POST', headers: { 'Authorization': `Bearer ${stt.key}` }, body: fd
  })
  if (!res.ok) throw new Error(`STT失败 HTTP ${res.status}`)
  const j = await res.json()
  return j.text || ''
}

/* ============ TTS ============ */
export async function ttsSpeak(text) {
  const { tts } = S.apiCfg
  if (!tts.key) return null
  const base = (activeChatCfg()?.baseUrl || '').replace(/\/+$/, '')
  const res = await fetch(base + '/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tts.key}` },
    body: JSON.stringify({ model: 'tts-1', input: text, voice: tts.voice || 'alloy', speed: tts.speed || 1 })
  })
  if (!res.ok) throw new Error(`TTS失败 HTTP ${res.status}`)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

let curAudio = null
export function playUrl(url) {
  if (curAudio) { curAudio.pause(); curAudio = null }
  curAudio = new Audio(url)
  curAudio.play().catch(() => {})
  return curAudio
}
export function playDataUrl(dataUrl) {
  const a = new Audio(dataUrl)
  a.play().catch(() => {})
  return a
}
