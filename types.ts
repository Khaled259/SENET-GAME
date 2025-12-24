export enum Player {
  Light = 'Light',
  Dark = 'Dark',
}

export type Token = {
  id: string;
  owner: Player;
  position: number; // 1-30, or 0 if off board (won) - wait, "passed square 30"
};

export enum GamePhase {
  Determination = 'Determination', // Rolling to see who goes first
  Rolling = 'Rolling', // Player needs to roll sticks
  Moving = 'Moving', // Player needs to select a move
  WaterResolution = 'WaterResolution', // Player stuck in House of Waters needs to choose
  GameOver = 'GameOver',
}

export type Move = {
  tokenId: string;
  from: number;
  to: number;
  isSwap: boolean;
  isProtected?: boolean; // If move was blocked due to protection (for logs)
};

export type GameState = {
  tokens: Token[];
  currentPlayer: Player;
  phase: GamePhase;
  stickResult: number | null; // 0-4
  stickRollsHistory: boolean[]; // For visual representation of the 4 sticks
  moveHistory: string[];
  lastState?: string; // For Undo (serialized)
  extraTurn: boolean;
  message: string;
  waterTokenId: string | null; // ID of token stuck in House of Waters needing resolution
  winner: Player | null;
  setupTurnStep: number; // 0 = Determine dark, 1 = Dark moves 10->11, 2 = Light moves 9
};