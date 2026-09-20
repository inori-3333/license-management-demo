import { readFileSync, writeFileSync } from 'node:fs'
const text = readFileSync(new URL('../DESIGN.md', import.meta.url), 'utf8')
const tokens = JSON.parse(text.split('---')[1])
const declarations = [
  ...Object.entries(tokens.colors).map(([k, v]) => '  --' + k + ': ' + v + ';'),
  ...Object.entries(tokens.rounded).map(([k, v]) => '  --radius-' + k + ': ' + v + ';'),
  '  --font-body: ' + tokens.typography.body.fontFamily + ';',
  ...Object.entries(tokens.typography)
    .filter(([, value]) => value.fontSize)
    .map(([key, value]) => '  --text-' + key + ': ' + value.fontSize + ';'),
]
writeFileSync(
  new URL('../src/tokens.css', import.meta.url),
  '/* Generated from DESIGN.md by npm run tokens. */\n:root {\n' +
    declarations.join('\n') +
    '\n}\n',
)
