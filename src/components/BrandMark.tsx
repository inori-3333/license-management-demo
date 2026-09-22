const brandSource = new URL('../assets/chd-brand-source.png', import.meta.url).href

export default function BrandMark() {
  return (
    <span className="brand-mark">
      <span className="brand-symbol">
        <img src={brandSource} alt="中国华电标识" width={416} height={464} />
      </span>
    </span>
  )
}
