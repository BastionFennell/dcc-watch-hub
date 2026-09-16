/** First letter of a name, skipping a leading article so "The Hoarder" yields "H". */
export function initialOf(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words.length > 1 && /^(the|a|an)$/i.test(words[0]) ? words[1] : words[0];
  return (first ?? '').charAt(0).toUpperCase();
}
