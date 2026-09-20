import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, extname } from 'node:path'
const root = resolve('dist')
const prefix = '/license-management-demo/'
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown',
}
const server = createServer((request, response) => {
  const relative =
    decodeURI(new URL(request.url, 'http://localhost').pathname).slice(prefix.length) ||
    'index.html'
  try {
    response.setHeader('Content-Type', mime[extname(relative)] || 'application/octet-stream')
    response.end(readFileSync(resolve(root, relative)))
  } catch {
    response.statusCode = 404
    response.end('Not found')
  }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
try {
  const base = 'http://127.0.0.1:' + server.address().port + prefix
  const response = await fetch(base + '#/people')
  assert.equal(response.status, 200)
  const html = await response.text()
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1])
  assert.ok(refs.some((ref) => ref.endsWith('.js')))
  for (const ref of refs) assert.ok(ref.startsWith('./'), 'Expected relative asset: ' + ref)
  const files = [
    'index.html',
    'framework.md',
    ...readdirSync(resolve(root, 'assets')).map((name) => 'assets/' + name),
  ]
  for (const file of files) {
    const asset = await fetch(new URL(file, base))
    assert.equal(asset.status, 200, file)
    assert.ok((await asset.arrayBuffer()).byteLength > 0, file)
  }
  console.log(
    'PASS: ' +
      files.length +
      ' production files served under ' +
      prefix +
      '. Hash route request resolves to index.html.',
  )
} finally {
  await new Promise((done) => server.close(done))
}
