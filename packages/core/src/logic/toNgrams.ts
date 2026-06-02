export function toNgrams(text: string, sizes: number[] = [2, 3]): string[] {
  const out = new Set<string>()
  for (const n of sizes) {
    if (n <= 0) continue
    for (let i = 0; i + n <= text.length; i++) {
      out.add(text.slice(i, i + n))
    }
  }
  return [...out]
}
