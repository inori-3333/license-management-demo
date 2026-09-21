// 演示在当前应用中运行；仅业务数据切换为内存副本。
let active = false
export const isDemoSession = () => active
export const setDemoSession = (value: boolean) => {
  active = value
}
export type DemoArtifact = { name: string; blob: Blob; rows?: number }
export const artifactEvent = 'license-demo-artifact'
export function collectDemoArtifact(artifact: DemoArtifact) {
  window.dispatchEvent(new CustomEvent<DemoArtifact>(artifactEvent, { detail: artifact }))
}
