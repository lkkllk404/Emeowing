export const FORMAT_MARKER = '喵'
export const FORMAT_VERSION = '咪'
export const FORMAT_HEADER = `${FORMAT_MARKER}${FORMAT_VERSION}`

export const MEOW_SYMBOLS = ['喵', '咪', '！', '～'] as const

export type MeowSymbol = (typeof MEOW_SYMBOLS)[number]

export type CodecErrorCode =
  | 'INVALID_UNICODE'
  | 'INVALID_HEADER'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_LENGTH'
  | 'INVALID_SYMBOL'
  | 'INVALID_UTF8'

export class CodecError extends Error {
  readonly code: CodecErrorCode
  readonly index: number | undefined

  constructor(code: CodecErrorCode, message: string, index?: number) {
    super(message)
    this.name = 'CodecError'
    this.code = code
    this.index = index
  }
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder('utf-8', {
  fatal: true,
  // A leading U+FEFF is text content here, not a transport-level BOM.
  ignoreBOM: true,
})

const bitsBySymbol = new Map<string, number>(MEOW_SYMBOLS.map((symbol, value) => [symbol, value]))

function findUnpairedSurrogate(text: string): number | undefined {
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index)

    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = text.charCodeAt(index + 1)

      if (nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff) {
        index += 1
        continue
      }

      return index
    }

    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return index
    }
  }

  return undefined
}

export function utf8ByteLength(text: string): number {
  return textEncoder.encode(text).length
}

export function encodeText(text: string): string {
  const invalidIndex = findUnpairedSurrogate(text)

  if (invalidIndex !== undefined) {
    throw new CodecError(
      'INVALID_UNICODE',
      `原文第 ${invalidIndex + 1} 个 UTF-16 码元是未配对的代理项，无法无损编码。`,
      invalidIndex,
    )
  }

  const bytes = textEncoder.encode(text)
  const encoded = new Array<string>(1 + bytes.length * 4)
  encoded[0] = FORMAT_HEADER

  let outputIndex = 1

  for (const byte of bytes) {
    encoded[outputIndex] = MEOW_SYMBOLS[(byte >> 6) & 0b11]!
    encoded[outputIndex + 1] = MEOW_SYMBOLS[(byte >> 4) & 0b11]!
    encoded[outputIndex + 2] = MEOW_SYMBOLS[(byte >> 2) & 0b11]!
    encoded[outputIndex + 3] = MEOW_SYMBOLS[byte & 0b11]!
    outputIndex += 4
  }

  return encoded.join('')
}

export function decodeText(encodedText: string): string {
  const encoded = encodedText.trim()
  const characters = Array.from(encoded)

  if (characters.length < 2 || characters[0] !== FORMAT_MARKER) {
    throw new CodecError('INVALID_HEADER', `喵文必须以格式头“${FORMAT_HEADER}”开头。`, 0)
  }

  if (characters[1] !== FORMAT_VERSION) {
    throw new CodecError(
      'UNSUPPORTED_VERSION',
      `暂不支持格式版本“${characters[1]}”，当前仅支持“${FORMAT_VERSION}”（v1）。`,
      1,
    )
  }

  const body = characters.slice(2)
  const values = new Uint8Array(body.length)

  for (let index = 0; index < body.length; index += 1) {
    const symbol = body[index]!
    const bits = bitsBySymbol.get(symbol)

    if (bits === undefined) {
      throw new CodecError(
        'INVALID_SYMBOL',
        `第 ${index + 3} 个符号“${symbol}”不属于喵文字符表。`,
        index + 2,
      )
    }

    values[index] = bits
  }

  if (body.length % 4 !== 0) {
    throw new CodecError(
      'INVALID_LENGTH',
      `格式头后的符号数必须是 4 的倍数，目前为 ${body.length}。`,
    )
  }

  const bytes = new Uint8Array(body.length / 4)

  for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
    const offset = byteIndex * 4
    bytes[byteIndex] =
      (values[offset]! << 6) |
      (values[offset + 1]! << 4) |
      (values[offset + 2]! << 2) |
      values[offset + 3]!
  }

  try {
    return textDecoder.decode(bytes)
  } catch {
    throw new CodecError('INVALID_UTF8', '喵文还原出的字节不是合法的 UTF-8 文本。')
  }
}
