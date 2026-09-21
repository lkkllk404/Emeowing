<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { CodecError, FORMAT_HEADER, decodeText, encodeText, utf8ByteLength } from './lib/codec'

type Mode = 'encode' | 'decode'

interface ConversionStats {
  utf8Bytes: number
  bodySymbols: number
  totalSymbols: number
}

const mode = ref<Mode>('encode')
const input = ref('')
const output = ref('')
const errorMessage = ref('')
const statusMessage = ref('')
const copyMessage = ref('')
const stats = ref<ConversionStats | null>(null)

let copyMessageTimer: ReturnType<typeof setTimeout> | undefined

const isEncoding = computed(() => mode.value === 'encode')
const inputLabel = computed(() => (isEncoding.value ? '原始文本' : '喵文'))
const outputLabel = computed(() => (isEncoding.value ? '喵文结果' : '还原文本'))
const inputPlaceholder = computed(() =>
  isEncoding.value
    ? '在这里输入中英文、Emoji 或任意 UTF-8 文本…'
    : `粘贴以“${FORMAT_HEADER}”开头的喵文…`,
)
const outputPlaceholder = computed(() =>
  isEncoding.value ? '编码结果会出现在这里' : '解码结果会出现在这里',
)
const inputCharacterCount = computed(() => Array.from(input.value).length)
const canConvert = computed(() =>
  isEncoding.value ? input.value.length > 0 : input.value.trim().length > 0,
)
const canClear = computed(
  () => input.value.length > 0 || output.value.length > 0 || errorMessage.value.length > 0,
)

function clearCopyMessage() {
  copyMessage.value = ''

  if (copyMessageTimer !== undefined) {
    clearTimeout(copyMessageTimer)
    copyMessageTimer = undefined
  }
}

function clearResult() {
  output.value = ''
  errorMessage.value = ''
  statusMessage.value = ''
  stats.value = null
  clearCopyMessage()
}

watch(input, clearResult)
watch(mode, clearResult)

function setMode(nextMode: Mode) {
  mode.value = nextMode
}

function convert() {
  if (!canConvert.value) return

  clearResult()

  try {
    if (isEncoding.value) {
      const utf8Bytes = utf8ByteLength(input.value)
      output.value = encodeText(input.value)
      stats.value = {
        utf8Bytes,
        bodySymbols: utf8Bytes * 4,
        totalSymbols: utf8Bytes * 4 + 2,
      }
      statusMessage.value = '编码完成，结果已加上“喵咪”v1 格式头。'
      return
    }

    output.value = decodeText(input.value)
    const totalSymbols = Array.from(input.value.trim()).length
    stats.value = {
      utf8Bytes: utf8ByteLength(output.value),
      bodySymbols: totalSymbols - 2,
      totalSymbols,
    }
    statusMessage.value = output.value.length > 0 ? '解码完成。' : '解码完成，正文内容为空。'
  } catch (error) {
    output.value = ''
    stats.value = null
    errorMessage.value =
      error instanceof CodecError ? error.message : '转换时发生了意外错误，请重试。'
  }
}

async function copyOutput() {
  if (output.value.length === 0) return

  clearCopyMessage()

  try {
    if (!navigator.clipboard) throw new Error('Clipboard API is unavailable')
    await navigator.clipboard.writeText(output.value)
    copyMessage.value = '已复制到剪贴板'
  } catch {
    copyMessage.value = '复制失败，请手动选择结果复制'
  }

  copyMessageTimer = setTimeout(() => {
    copyMessage.value = ''
    copyMessageTimer = undefined
  }, 2400)
}

function clearAll() {
  input.value = ''
  clearResult()
}

onBeforeUnmount(clearCopyMessage)
</script>

<template>
  <main class="page-shell">
    <header class="hero">
      <div class="brand-mark" aria-hidden="true">
        <span class="brand-mark__ear brand-mark__ear--left"></span>
        <span class="brand-mark__ear brand-mark__ear--right"></span>
        <span class="brand-mark__face">喵</span>
      </div>

      <div class="hero__copy">
        <p class="eyebrow">UTF-8 · BASE 4</p>
        <h1>Emeowing</h1>
        <p class="hero__lead">把文字变成喵言喵语，也能一字不差地变回来。</p>
      </div>

      <div class="privacy-badge">
        <span aria-hidden="true"></span>
        仅在本地浏览器转换
      </div>
    </header>

    <section class="converter-card" aria-labelledby="converter-title">
      <div class="converter-toolbar">
        <div>
          <p class="section-kicker">转换器</p>
          <h2 id="converter-title">选择一个方向</h2>
        </div>

        <div class="mode-switch" role="group" aria-label="转换方向">
          <button
            type="button"
            :class="{ active: mode === 'encode' }"
            :aria-pressed="mode === 'encode'"
            data-testid="encode-mode"
            @click="setMode('encode')"
          >
            编码
          </button>
          <button
            type="button"
            :class="{ active: mode === 'decode' }"
            :aria-pressed="mode === 'decode'"
            data-testid="decode-mode"
            @click="setMode('decode')"
          >
            解码
          </button>
        </div>
      </div>

      <div class="text-panels">
        <section class="text-panel">
          <div class="text-panel__heading">
            <label for="codec-input">{{ inputLabel }}</label>
            <span>{{ inputCharacterCount }} 个字符</span>
          </div>
          <textarea
            id="codec-input"
            v-model="input"
            data-testid="codec-input"
            :placeholder="inputPlaceholder"
            spellcheck="false"
            autocomplete="off"
          ></textarea>
        </section>

        <div class="direction-mark" aria-hidden="true">
          <span>→</span>
        </div>

        <section class="text-panel text-panel--output">
          <div class="text-panel__heading">
            <label for="codec-output">{{ outputLabel }}</label>
            <span v-if="output">{{ Array.from(output).length }} 个字符</span>
            <span v-else>只读</span>
          </div>
          <textarea
            id="codec-output"
            :value="output"
            data-testid="codec-output"
            :placeholder="outputPlaceholder"
            readonly
            spellcheck="false"
          ></textarea>
        </section>
      </div>

      <div class="feedback-area" aria-live="polite" aria-atomic="true">
        <p v-if="errorMessage" class="feedback feedback--error" role="alert" data-testid="error">
          <span aria-hidden="true">!</span>
          {{ errorMessage }}
        </p>
        <p v-else-if="statusMessage" class="feedback feedback--success" data-testid="status">
          <span aria-hidden="true">✓</span>
          {{ statusMessage }}
        </p>
      </div>

      <div class="converter-footer">
        <div class="actions">
          <button
            type="button"
            class="button button--primary"
            :disabled="!canConvert"
            data-testid="convert-button"
            @click="convert"
          >
            {{ isEncoding ? '开始编码' : '开始解码' }}
          </button>
          <button
            type="button"
            class="button button--secondary"
            :disabled="!output"
            data-testid="copy-button"
            @click="copyOutput"
          >
            复制结果
          </button>
          <button
            type="button"
            class="button button--ghost"
            :disabled="!canClear"
            data-testid="clear-button"
            @click="clearAll"
          >
            清空
          </button>
        </div>

        <p class="copy-message" role="status" data-testid="copy-status">{{ copyMessage }}</p>
      </div>

      <dl v-if="stats" class="stats" data-testid="stats">
        <div>
          <dt>UTF-8 字节</dt>
          <dd>{{ stats.utf8Bytes }}</dd>
        </div>
        <div>
          <dt>正文符号</dt>
          <dd>{{ stats.bodySymbols }}</dd>
        </div>
        <div>
          <dt>含格式头</dt>
          <dd>{{ stats.totalSymbols }}</dd>
        </div>
      </dl>
    </section>

    <footer class="page-footer">
      <span aria-hidden="true">ฅ^•ﻌ•^ฅ</span>
      <p>没有上传，没有追踪，只有喵。</p>
    </footer>
  </main>
</template>
