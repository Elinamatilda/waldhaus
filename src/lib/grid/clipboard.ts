/** TSV only: preserve empty cells; discard one spreadsheet terminal line ending. */
export function parseClipboardGrid(text: string): string[][] {
  return text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map(row => row.split('\t'));
}

/** Deliberately reject mixed separators and malformed thousands grouping. */
export function normalizePastedNumber(value: string): number | null {
  let text = value.trim();
  if (!text) return null;
  text = text.replace(/^€\s*|\s*€$/g, '').trim().replace(/[\u00a0\u202f]/g, ' ');
  if (!/^-?(?:\d+|\d{1,3}(?: \d{3})+)(?:[.,]\d+)?$/.test(text)) throw new Error('INVALID_NUMBER');
  const number = Number(text.replace(/ /g, '').replace(',', '.'));
  if (!Number.isFinite(number)) throw new Error('INVALID_NUMBER');
  return number;
}

export type ClipboardCell<T> = { row: number; column: number; value: T };
export type ClipboardResult<T> =
  | { ok: true; cells: ClipboardCell<T>[]; ignored: number }
  | { ok: false; row: number; column: number; sourceRow: number; sourceColumn: number };

/** Validate the whole source, including overflow, before returning any writes. */
export function validateClipboardMatrix<T>(matrix: string[][], options: {
  startRow: number; startColumn: number; rows: number; columns: number;
  parse: (text: string, row: number, column: number) => T;
}): ClipboardResult<T> {
  const cells: ClipboardCell<T>[] = [];
  let ignored = 0;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      const row = options.startRow + r;
      const column = options.startColumn + c;
      let value: T;
      try { value = options.parse(matrix[r][c], row, column); }
      catch { return { ok: false, row, column, sourceRow: r, sourceColumn: c }; }
      if (row < 0 || row >= options.rows || column < 0 || column >= options.columns) ignored++;
      else cells.push({ row, column, value });
    }
  }
  return { ok: true, cells, ignored };
}

export function applyClipboardMatrix<T>(matrix: T[][], cells: ClipboardCell<T>[]): T[][] {
  const result = matrix.map(row => [...row]);
  for (const cell of cells) result[cell.row][cell.column] = cell.value;
  return result;
}
