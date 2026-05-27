const sampleRate = 8000
const durationSeconds = 0.45
const frequency = 1000

export function voicemailToneWav(): Uint8Array {
  const sampleCount = Math.floor(sampleRate * durationSeconds)
  const dataSize = sampleCount * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeAscii(view, 0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, "WAVE")
  writeAscii(view, 12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, "data")
  view.setUint32(40, dataSize, true)

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const t = sampleIndex / sampleRate
    const fadeIn = Math.min(1, sampleIndex / (sampleRate * 0.02))
    const fadeOut = Math.min(
      1,
      (sampleCount - sampleIndex) / (sampleRate * 0.04)
    )
    const envelope = Math.min(fadeIn, fadeOut)
    const amplitude = Math.sin(2 * Math.PI * frequency * t) * 0.35 * envelope
    view.setInt16(44 + sampleIndex * 2, Math.round(amplitude * 32767), true)
  }

  return new Uint8Array(buffer)
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}
