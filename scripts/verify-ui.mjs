import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const root = new URL('../', import.meta.url)
const tokens = JSON.parse(readFileSync(new URL('DESIGN.md', root), 'utf8').split('---')[1])
const generated = readFileSync(new URL('src/tokens.css', root), 'utf8')
for (const [key, value] of Object.entries(tokens.colors))
  assert.ok(generated.includes('--' + key + ': ' + value + ';'), 'token drift: ' + key)
for (const [key, value] of Object.entries(tokens.typography))
  if (value.fontSize)
    assert.ok(
      generated.includes('--text-' + key + ': ' + value.fontSize + ';'),
      'typography drift: ' + key,
    )
function luminance(hex) {
  const [r, g, b] = hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return r * 0.2126 + g * 0.7152 + b * 0.0722
}
for (const [foreground, background] of [
  ['text', 'surface'],
  ['muted', 'background'],
  ['primary', 'blue-soft'],
  ['surface', 'primary'],
  ['success', 'success-soft'],
  ['warning', 'warning-soft'],
  ['danger', 'danger-soft'],
  ...['text', 'muted', 'cyan', 'blue', 'violet', 'amber', 'coral', 'mint'].map((tone) => [
    'flow-' + tone,
    'flow-surface',
  ]),
]) {
  const a = luminance(tokens.colors[foreground]),
    b = luminance(tokens.colors[background]),
    contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  assert.ok(
    contrast >= 4.5,
    foreground + '/' + background + ' contrast ' + contrast.toFixed(2) + ' < 4.5',
  )
  console.log('PASS contrast', foreground + '/' + background, contrast.toFixed(2))
}
console.log(
  'PASS: DESIGN.md token mapping and text contrast. Real browser evidence: docs/验收记录.md',
)
