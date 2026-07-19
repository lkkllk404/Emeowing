import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'

const clipboardWrite = vi.fn<(text: string) => Promise<void>>()

function textareaValue(wrapper: ReturnType<typeof mount>, selector: string) {
  return (wrapper.get(selector).element as HTMLTextAreaElement).value
}

describe('App', () => {
  beforeEach(() => {
    clipboardWrite.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    })
  })

  afterEach(() => {
    clipboardWrite.mockReset()
  })

  it('waits for an explicit click before encoding', async () => {
    const wrapper = mount(App)
    const input = wrapper.get('[data-testid="codec-input"]')
    const convertButton = wrapper.get('[data-testid="convert-button"]')

    expect(convertButton.attributes('disabled')).toBeDefined()
    await input.setValue('A')

    expect(textareaValue(wrapper, '[data-testid="codec-output"]')).toBe('')
    expect(convertButton.attributes('disabled')).toBeUndefined()

    await convertButton.trigger('click')

    expect(textareaValue(wrapper, '[data-testid="codec-output"]')).toBe('喵咪咪喵喵咪')
    expect(wrapper.get('[data-testid="status"]').text()).toContain('编码完成')
    expect(wrapper.get('[data-testid="stats"]').text()).toContain('UTF-8 字节1')
    expect(wrapper.get('[data-testid="stats"]').text()).toContain('含格式头6')
  })

  it('switches to decoding and restores the source text', async () => {
    const wrapper = mount(App)

    await wrapper.get('[data-testid="decode-mode"]').trigger('click')
    expect(wrapper.get('[data-testid="convert-button"]').text()).toBe('开始解码')

    await wrapper.get('[data-testid="codec-input"]').setValue('喵咪～！咪喵！～！喵！！～咪')
    await wrapper.get('[data-testid="convert-button"]').trigger('click')

    expect(textareaValue(wrapper, '[data-testid="codec-output"]')).toBe('中')
    expect(wrapper.get('[data-testid="status"]').text()).toContain('解码完成')
  })

  it('clears stale results when the input or direction changes', async () => {
    const wrapper = mount(App)
    const input = wrapper.get('[data-testid="codec-input"]')

    await input.setValue('A')
    await wrapper.get('[data-testid="convert-button"]').trigger('click')
    expect(textareaValue(wrapper, '[data-testid="codec-output"]')).not.toBe('')

    await input.setValue('B')
    expect(textareaValue(wrapper, '[data-testid="codec-output"]')).toBe('')
    expect(wrapper.find('[data-testid="stats"]').exists()).toBe(false)

    await wrapper.get('[data-testid="convert-button"]').trigger('click')
    await wrapper.get('[data-testid="decode-mode"]').trigger('click')
    expect(textareaValue(wrapper, '[data-testid="codec-output"]')).toBe('')
  })

  it('shows codec validation errors without leaving an old output', async () => {
    const wrapper = mount(App)

    await wrapper.get('[data-testid="decode-mode"]').trigger('click')
    await wrapper.get('[data-testid="codec-input"]').setValue('喵咪喵!喵喵')
    await wrapper.get('[data-testid="convert-button"]').trigger('click')

    expect(wrapper.get('[data-testid="error"]').text()).toContain('不属于喵文字符表')
    expect(textareaValue(wrapper, '[data-testid="codec-output"]')).toBe('')
  })

  it('copies a successful result and reports success', async () => {
    const wrapper = mount(App)

    await wrapper.get('[data-testid="codec-input"]').setValue('A')
    await wrapper.get('[data-testid="convert-button"]').trigger('click')
    await wrapper.get('[data-testid="copy-button"]').trigger('click')
    await flushPromises()

    expect(clipboardWrite).toHaveBeenCalledWith('喵咪咪喵喵咪')
    expect(wrapper.get('[data-testid="copy-status"]').text()).toBe('已复制到剪贴板')
  })

  it('clears input, output, and feedback', async () => {
    const wrapper = mount(App)

    await wrapper.get('[data-testid="codec-input"]').setValue('A')
    await wrapper.get('[data-testid="convert-button"]').trigger('click')
    await wrapper.get('[data-testid="clear-button"]').trigger('click')

    expect(textareaValue(wrapper, '[data-testid="codec-input"]')).toBe('')
    expect(textareaValue(wrapper, '[data-testid="codec-output"]')).toBe('')
    expect(wrapper.find('[data-testid="status"]').exists()).toBe(false)
  })
})
