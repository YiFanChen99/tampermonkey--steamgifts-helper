/**
 * A row from the Google Sheet, accessed by column letter.
 */
export interface SheetGame {
    /** Game name. May pack several aliases separated by `/`. */
    B: string;
    /** Update date, parseable by `new Date()`. Absent when never updated. */
    G?: string;
    /** How much the game is wanted. */
    K: string | number;
}

export interface SheetData {
    /** Fetch timestamp, in ms. */
    time: number;
    games: SheetGame[];
    labelMap: Record<string, unknown>;
}
