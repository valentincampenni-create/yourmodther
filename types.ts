
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'NONE';

export interface Position {
  x: number;
  y: number;
}

export interface Entity {
  pos: Position;
  dir: Direction;
  nextDir: Direction;
  speed: number;
  type: 'PLAYER' | 'POLICE';
  id: string;
}

export enum TileType {
  EMPTY = 0,
  WALL = 1,
  CASH = 2,
  TURBO = 3,
  SPAWN = 4
}

export interface GameState {
  score: number;
  lives: number;
  status: 'START' | 'PLAYING' | 'GAMEOVER' | 'WIN' | 'LEVEL_UP';
  level: number;
  cashRemaining: number;
  isVulnerable: boolean; // When player has Turbo
  vulnerableTimer: number;
}

export interface RadioMessage {
  text: string;
  sender: 'DJ_GEMINI' | 'POLICE_DISPATCH';
  id: number;
}
