export interface FormationSlot {
  slotId: string;
  roleLabel: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

/**
 * Parses a 7v7 formation string (e.g., "3-2-1") and returns relative coordinates.
 * GK is always fixed at (50, 88).
 * Outfield rows occupy Y space from 15% to 70%.
 */
export function parse7v7Formation(formationStr: string): FormationSlot[] {
  const slots: FormationSlot[] = [];

  // 1. Fixed Goalkeeper
  slots.push({
    slotId: 'gk',
    roleLabel: 'GK',
    x: 50,
    y: 88,
  });

  // 2. Parse outfield rows
  // Example "3-2-1" -> [3, 2, 1]
  const rows = formationStr.split('-').map(Number);
  const rowCount = rows.length;

  // Vertical spacing
  const minY = 15;
  const maxY = 70;
  const rowSpacing = rowCount > 1 ? (maxY - minY) / (rowCount - 1) : 0;

  // Process rows from bottom (defense) to top (attack)
  // rows[0] is defense, rows[last] is attack
  // But on pitch, attack is at top (minY), defense is at bottom (maxY)
  rows.forEach((playerCount, rowIndex) => {
    // Determine Y coordinate for this row
    // If rowIndex = 0 (defense), y = maxY
    // If rowIndex = last (attack), y = minY
    const y = maxY - rowIndex * rowSpacing;

    // Horizontal spacing
    const minX = 10;
    const maxX = 90;
    const xSpacing = playerCount > 1 ? (maxX - minX) / (playerCount - 1) : 0;
    const startX = playerCount > 1 ? minX : 50;

    for (let i = 0; i < playerCount; i++) {
      const x = startX + i * xSpacing;
      
      // Determine label based on row and position
      let label = 'POS';
      if (rowIndex === 0) {
        if (playerCount === 1) label = 'CB';
        else if (i === 0) label = 'LB';
        else if (i === playerCount - 1) label = 'RB';
        else label = 'CB';
      } else if (rowIndex === rowCount - 1) {
        label = 'ST';
      } else {
        label = 'MID';
      }

      slots.push({
        slotId: `row-${rowIndex}-slot-${i}`,
        roleLabel: label,
        x,
        y,
      });
    }
  });

  return slots;
}
