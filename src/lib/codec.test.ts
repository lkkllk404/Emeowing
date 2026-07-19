import { describe, expect, it } from 'vitest'
import {
  CodecError,
  FORMAT_HEADER,
  decodeText,
  encodeText,
  utf8ByteLength,
  type CodecErrorCode,
} from './codec'

function expectCodecError(action: () => unknown, code: CodecErrorCode, index?: number) {
  try {
    action()
    throw new Error('Expected a CodecError to be thrown')
  } catch (error) {
    expect(error).toBeInstanceOf(CodecError)
    expect((error as CodecError).code).toBe(code)

    if (index !== undefined) {
      expect((error as CodecError).index).toBe(index)
    }
  }
}

describe('encodeText', () => {
  it('encodes exact ASCII and Chinese vectors', () => {
    expect(encodeText('A')).toBe('喵咪咪喵喵咪')
    expect(encodeText('中')).toBe('喵咪～！咪喵！～！喵！！～咪')
  })

  it('encodes an empty string as the v1 header', () => {
    expect(encodeText('')).toBe(FORMAT_HEADER)
  })

  it('always emits the header followed by four symbols per UTF-8 byte', () => {
    const source = 'Hello，世界🐱\n'
    const encoded = encodeText(source)

    expect(encoded.startsWith(FORMAT_HEADER)).toBe(true)
    expect(encoded).toMatch(/^[喵咪！～]+$/u)
    expect(Array.from(encoded)).toHaveLength(2 + utf8ByteLength(source) * 4)
  })

  it('rejects unpaired UTF-16 surrogates instead of replacing them', () => {
    expectCodecError(() => encodeText('\ud800'), 'INVALID_UNICODE', 0)
    expectCodecError(() => encodeText(`ok\udc00`), 'INVALID_UNICODE', 2)
  })
})

describe('decodeText', () => {
  it('decodes exact vectors and the empty payload', () => {
    expect(decodeText('喵咪咪喵喵咪')).toBe('A')
    expect(decodeText('喵咪～！咪喵！～！喵！！～咪')).toBe('中')
    expect(decodeText(FORMAT_HEADER)).toBe('')
  })

  it('allows copy-and-paste whitespace only around the encoded text', () => {
    expect(decodeText(' \n喵咪咪喵喵咪\t')).toBe('A')
    expectCodecError(() => decodeText('喵咪咪\n喵喵咪'), 'INVALID_SYMBOL', 3)
  })

  it('preserves a leading U+FEFF as text content', () => {
    const source = '\ufeff开头'
    expect(decodeText(encodeText(source))).toBe(source)
  })

  it('round-trips UTF-8 boundary code points and mixed text', () => {
    const boundaries = '\u0000\u007f\u0080\u07ff\u0800\uffff\u{10000}\u{10ffff}'
    const mixed = 'Hello，世界🐱\n第二行 e\u0301'

    expect(decodeText(encodeText(boundaries))).toBe(boundaries)
    expect(decodeText(encodeText(mixed))).toBe(mixed)
  })

  it('rejects malformed headers and unknown versions', () => {
    expectCodecError(() => decodeText('咪咪'), 'INVALID_HEADER', 0)
    expectCodecError(() => decodeText('喵！'), 'UNSUPPORTED_VERSION', 1)
  })

  it('rejects invalid lengths and non-alphabet symbols', () => {
    expectCodecError(() => decodeText('喵咪喵'), 'INVALID_LENGTH')
    expectCodecError(() => decodeText('喵咪喵!喵喵'), 'INVALID_SYMBOL', 3)
    expectCodecError(() => decodeText('喵咪喵~喵喵'), 'INVALID_SYMBOL', 3)
  })

  it('rejects byte sequences that are not valid UTF-8', () => {
    // 10 00 00 00 = 0x80, which cannot begin a valid UTF-8 sequence.
    expectCodecError(() => decodeText('喵咪！喵喵喵'), 'INVALID_UTF8')
  })
})
