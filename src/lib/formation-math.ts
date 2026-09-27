export interface FormationSlot {
  id: string;
  label: string;
  x: number; // percentage
  y: number; // percentage
}

/**
 * Generates relative coordinates for a 7v7 formation.
 * Format: "3-2-1", "2-3-1", etc.
 */
export function getFormationCoordinates(formationStr: string): FormationSlot[] {
  const slots: FormationSlot[] = [];

  // GK is always fixed at bottom
  slots.push({ id: 'gk', label: 'G', x: 50, y: 85 });

  const rows = formationStr.split('-').map(Number);
  const rowCount = rows.length;

  // Pitch Y-axis partition: 15% (top) to 65% (mid-def)
  const minY = 15;
  const maxY = 65;
  const yStep = rowCount > 1 ? (maxY - minY) / (rowCount - 1) : 0;

  // Iterate rows from front (attack) to back (defense)
  // Input: "3-2-1" -> [3, 2, 1] means 1 attacker, 2 mid, 3 def
  // We process them to display: row[0] is top (attack), row[last] is bottom (defense)
  // So we reverse for processing: [1, 2, 3]
  const processedRows = [...rows].reverse(); 

  processedRows.forEach((playersInRow, rowIndex) => {
    const y = minY + rowIndex * yStep;
    const xStep = playersInRow > 1 ? 80 / (playersInRow - 1) : 0;
    const xStart = playersInRow > 1 ? 10 : 50;

    for (let i = 0; i < playersInRow; i++) {
      const x = xStart + i * xStep;
      let label = 'POS';
      
      if (rowIndex === 0) label = 'ATT';
      else if (rowIndex === rowCount - 1) {
        if (playersInRow === 1) label = 'DC';
        else if (i === 0) label = 'DG';
        else if (i === playersInRow - 1) label = 'DD';
        else label = 'DC';
      } else {
        label = 'MIL';
      }

      slots.push({
        id: `slot-${rowIndex}-${i}`,
        label,
        x,
        y
      });
    }
  });

  return slots;
}
