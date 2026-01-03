/*
 * Generates a color palette for a given set of keys. If we have more keys
 * than base colors, additional colors are generated using HSL.
*/

const BASE_COLORS = [
  "#2563EB", "#EF4444", "#16A34A", "#F59E0B", "#9333EA",
  "#0EA5E9", "#DB2777", "#14B8A6", "#F97316", "#6B7280"
];

function generateColorPalette(keys: string[]): Record<string, string> {
  return Object.fromEntries(
    keys.map((key, i) => [
      key,
      i < BASE_COLORS.length
        ? BASE_COLORS[i]
        : `hsl(${(i * 37) % 360}, 70%, 50%)`
    ])
  );
}

export default generateColorPalette;