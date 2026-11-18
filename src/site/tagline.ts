/**
 * A tagline of several sentences is set one sentence to a row, and at display
 * size the rows drop their closing full stops: "Came for the movie" over
 * "Stayed for the show". A single sentence is left exactly as written. The
 * string itself stays whole in `show.json`, where the page title and the
 * description read it as a sentence.
 */
export function taglineRows(tagline: string): string[] {
  const rows = tagline.split(/(?<=[.!?])\s+/).filter((row) => row !== '');
  return rows.length > 1 ? rows.map((row) => row.replace(/\.$/, '')) : rows;
}
