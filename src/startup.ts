export {}

const screen = document.getElementById('startup-screen')!
const root = document.getElementById('root')!
const status = screen.querySelector<HTMLElement>('.startup-status')!
const retry = screen.querySelector<HTMLButtonElement>('.startup-retry')!
const startedAt = performance.now()
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

retry.addEventListener('click', () => window.location.reload())

function showFailure() {
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
                root.inert = false
                root.removeAttribute('aria-hidden')
                screen.remove()
              },
              reducedMotion.matches ? 0 : 360,
            )
          },
          reducedMotion.matches ? 0 : 220,
        )
      },
      reducedMotion.matches ? 0 : Math.max(0, 1400 - (performance.now() - startedAt)),
    )
  },
  { once: true },
)

void import('./main').catch(() => {
  window.clearTimeout(timeout)
  showFailure()
})
