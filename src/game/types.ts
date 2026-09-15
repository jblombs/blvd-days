export type QuestId = 'blvd-cross' | 'bodega-run' | 'subway-stop';
export type QuestStatus = 'active' | 'completed';

export interface Quest {
  id: QuestId;
  title: string;
  hint: string;
  status: QuestStatus;
}

export type WeatherMode = 'sunny' | 'rainy';

export type GameState = 'title' | 'playing' | 'dialog' | 'won';

export interface GoalZone {
  id: string;
  questId?: QuestId;
  x: number;
  z: number;
  radius: number;
  label: string;
  dialog: string;
  completeMsg?: string;
}

/** Simple XZ AABB for buildings / solid props */
export interface Collider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
