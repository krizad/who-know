export enum RoomStatus {
  LOBBY = "LOBBY",
  PLAYING = "PLAYING",
  WORD_SETTING = "WORD_SETTING",
  QUESTIONING = "QUESTIONING",
  VOTING = "VOTING",
  RESULT = "RESULT",
}

export enum GameType {
  WHO_KNOW = "WHO_KNOW",
  TIC_TAC_TOE = "TIC_TAC_TOE",
  RPS = "RPS",
}

export enum Role {
  Host = "Host",
  Know = "Know",
  Unknow = "Unknow",
}

export type WinningTeam = "INSIDER" | "COMMONERS" | "TIMEOUT";

// Socket Constants
export const SOCKET_EVENTS = {
  JOIN_ROOM: "join_room",
  ROOM_STATE_UPDATED: "room_state_updated",
  ROOM_DELETED: "room_deleted",
  START_GAME: "start_game",
  ROLE_ASSIGNED: "role_assigned",
  SET_WORD: "set_word",
  WORD_SETTING_COMPLETED: "word_setting_completed",
  END_QUESTIONING: "end_questioning",
  STOP_TIMER: "stop_timer",
  TIMER_UPDATE: "timer_update",
  SUBMIT_VOTE: "submit_vote",
  RESET_GAME: "reset_game",
  UPDATE_CONFIG: "update_config",
  GET_AVAILABLE_ROOMS: "get_available_rooms",
  AVAILABLE_ROOMS_UPDATED: "available_rooms_updated",
  ERROR: "error",
  // Tic-Tac-Toe specific events
  TTT_JOIN_SIDE: "ttt_join_side",
  TTT_MAKE_MOVE: "ttt_make_move",
  TTT_RESET: "ttt_reset",
  // RPS specific events
  RPS_NEXT_ROUND: "rps_next_round",
  RPS_MAKE_CHOICE: "rps_make_choice",
  RPS_RESET: "rps_reset",
} as const;

export type TicTacToeCell = "X" | "O" | null;

export interface TicTacToeState {
  board: TicTacToeCell[]; // Array of 9 cells
  playerXId?: string; // socketId of Player X
  playerOId?: string; // socketId of Player O
  currentTurn: "X" | "O";
  winner?: "X" | "O" | "DRAW";
  winningLine?: number[]; // indices of the winning line
}

export type RPSChoice = "ROCK" | "PAPER" | "SCISSORS";

export interface RPSState {
  activePlayers: string[]; // socketIds
  queue: string[]; // socketIds waiting their turn
  choices: Record<string, RPSChoice>; // socketId -> Choice
  scores: Record<string, number>; // socketId -> Wins
  roundWinner?: string | string[]; // Can be "DRAW", or a single P1 ID, or an array of winning IDs
  gameWinner?: string | string[]; // Overall winner(s) ID
}

export interface UserState {
  id: string;
  name: string;
  socketId: string;
  role?: Role;
  score: number;
  roomId: string;
  hasBeenHost?: boolean;
  connected?: boolean;
}

export interface RoomConfig {
  hostSelection: "ROUND_ROBIN" | "RANDOM" | "FIXED";
  timerMin: number;
  rpsBestOf?: number; // e.g., 1, 3, 5
  rpsMode?: "1V1_ROUND_ROBIN" | "ALL_AT_ONCE";
}

export interface RoomState {
  id: string;
  gameType: GameType;
  code: string;
  status: RoomStatus;
  roomHostId: string;
  players: UserState[];
  createdAt: Date;
  endTime?: number;
  votes?: Record<string, string>;
  winner?: WinningTeam;
  config: RoomConfig;
  ticTacToeState?: TicTacToeState;
  rpsState?: RPSState;
}

export interface AvailableRoom {
  code: string;
  gameType: GameType;
  hostName: string;
  playerCount: number;
}
