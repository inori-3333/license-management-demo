export {}

const screen = document.getElementById('startup-screen')!
const root = document.getElementById('root')!
const status = screen.querySelector<HTMLElement>('.startup-status')!
const retry = screen.querySelector<HTMLButtonElement>('.startup-retry')!
const startedAt = performance.now()
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const members = screen.querySelector<HTMLElement>('.startup-members')!
const names = [...members.querySelectorAll<HTMLElement>('.startup-member-row span')]
const highlightDuration = 180
const introDuration = names.length * highlightDuration
let activeName = 0

function highlightName() {
  names.forEach((name, index) => {
    name.classList.toggle('is-highlighted', !reducedMotion.matches && index === activeName)
  })
  if (!reducedMotion.matches && members.scrollWidth > members.clientWidth) {
    const name = names[activeName]
    members.scrollTo({ left: name.offsetLeft - (members.clientWidth - name.offsetWidth) / 2 })
  }
}

highlightName()
const highlightTimer = window.setInterval(() => {
  activeName = (activeName + 1) % names.length
  highlightName()
}, highlightDuration)

retry.addEventListener('click', () => window.location.reload())

function showFailure() {
  window.clearInterval(highlightTimer)
  screen.classList.add('is-error')
  status.textContent = '页面载入未完成，请重新载入'
  retry.hidden = false
  screen.querySelector('[role="progressbar"]')?.removeAttribute('role')
}

const timeout = window.setTimeout(showFailure, 20_000)
document.addEventListener(
  'app:ready',
  () => {
    window.clearTimeout(timeout)
    window.setTimeout(
      () => {
        screen.classList.remove('is-error')
        screen.classList.add('is-ready')
        retry.hidden = true
        status.textContent = '载入完成'
        screen.querySelector('[role="progressbar"]')?.setAttribute('aria-valuenow', '100')
        window.setTimeout(
          () => {
            screen.classList.add('is-leaving')
            window.setTimeout(
              () => {
                window.clearInterval(highlightTimer)
                const restoreFocus = screen.contains(document.activeElement)
                root.inert = false
                root.removeAttribute('aria-hidden')
                screen.remove()
                if (restoreFocus) root.querySelector<HTMLElement>('#main')?.focus()
              },
              reducedMotion.matches ? 0 : 360,
            )
          },
          reducedMotion.matches ? 0 : 220,
        )
      },
      reducedMotion.matches ? 0 : Math.max(0, introDuration - (performance.now() - startedAt)),
    )
  },
  { once: true },
)

void import('./main').catch(() => {
  window.clearTimeout(timeout)
  showFailure()
})
