import { expect, test } from "vitest";
import generateColorPalette from "../../src/lib/colorPaletteGenerator";

test("Color Palette Generator produces consistent palettes", () => {
    const keys = Array.from({ length: 16 }, (_, i) => i.toString());
    const paletteA = generateColorPalette(keys);
    const paletteB = generateColorPalette(keys);
    
    expect(paletteA).toEqual(paletteB);
});