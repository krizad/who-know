import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { RoomState, RoomStatus, Role, SOCKET_EVENTS, AvailableRoom, GameType } from '@repo/types';
import { toast } from 'react-hot-toast';

interface GameState {
  socket: Socket | null;
  connected: boolean;
  room: RoomState | null;
  myRole: Role | null;
  myName: string;
  socketId: string;
  secretWord: string | null;
  availableRooms: AvailableRoom[];
  connect: () => void;
  setName: (name: string) => void;
  createRoom: (gameType?: GameType) => void;
  joinRoom: (code: string) => void;
  startGame: () => void;
  setWord: (word: string) => void;
  endQuestioning: (timeout?: boolean) => void;
  stopTimer: () => void;
  submitVote: (targetId: string) => void;
  resetRoom: () => void;
  leaveRoom: () => void;
  updateConfig: (config: Partial<RoomState['config']>) => void;
  tttJoinSide: (side: "X" | "O") => void;
  tttMakeMove: (index: number) => void;
  tttReset: () => void;
  rpsMakeChoice: (choice: "ROCK" | "PAPER" | "SCISSORS") => void;
  rpsNextRound: () => void;
  rpsReset: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  socket: null,
  connected: false,
  room: null,
  myRole: null,
  myName: '',
  socketId: '',
  secretWord: null,
  availableRooms: [],

  setName: (name) => set({ myName: name }),

  connect: () => {
    if (get().socket) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const socket = io(apiUrl);

    socket.on('connect', () => {
      set({ connected: true, socket, socketId: socket.id });
      
      // Auto-reconnect if session exists
      const savedCode = localStorage.getItem('who-know-roomCode');
      const savedName = localStorage.getItem('who-know-name');
      if (savedCode && savedName) {
        set({ myName: savedName });
        socket.emit(SOCKET_EVENTS.JOIN_ROOM, { code: savedCode, name: savedName });
      }
      
      // Request active rooms lobby
      socket.emit(SOCKET_EVENTS.GET_AVAILABLE_ROOMS);
    });

    socket.on('disconnect', () => {
      set({ connected: false, socketId: '' });
    });

    socket.on(SOCKET_EVENTS.ROOM_STATE_UPDATED, (room: RoomState) => {
      if (room.status === RoomStatus.LOBBY) {
        set({ room, myRole: null, secretWord: null });
      } else {
        set({ room });
      }
      
      // Save session if we are in the room
      const currentName = get().myName;
      const isMe = room.players.find(p => p.socketId === socket.id || p.name === currentName);
      if (isMe) {
          localStorage.setItem('who-know-roomCode', room.code);
          localStorage.setItem('who-know-name', currentName);
      }
    });

    socket.on(SOCKET_EVENTS.ROLE_ASSIGNED, ({ role }: { role: Role }) => {
      set({ myRole: role });
    });

    socket.on(SOCKET_EVENTS.ROOM_DELETED, () => {
      localStorage.removeItem('who-know-roomCode');
      set({ room: null, myRole: null, secretWord: null });
      toast.error('The Room Host has left. Room has been closed.');
    });

    socket.on(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, (rooms: AvailableRoom[]) => {
      set({ availableRooms: rooms });
    });

    socket.on(SOCKET_EVENTS.WORD_SETTING_COMPLETED, ({ word }: { word: string }) => {
      set({ secretWord: word });
    });

    socket.on(SOCKET_EVENTS.ERROR, ({ message }: { message: string }) => {
      if (message === 'Room not found') {
        localStorage.removeItem('who-know-roomCode');
        set({ room: null });
      }
      toast.error(message);
    });
  },

  createRoom: (gameType: GameType = GameType.WHO_KNOW) => {
    const { socket, myName } = get();
    if (socket && myName) {
      socket.emit('create_room', { name: myName, gameType });
    } else if (!myName) {
      toast.error('Please enter your name first');
    }
  },

  joinRoom: (code: string) => {
    const { socket, myName } = get();
    if (socket && myName) {
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, { code, name: myName });
    } else if (!myName) {
      toast.error('Please enter your name first');
    }
  },

  startGame: () => {
    const { socket, room } = get();
    if (socket && room) {
      socket.emit(SOCKET_EVENTS.START_GAME, { code: room.code });
    }
  },

  setWord: (word: string) => {
    const { socket, room } = get();
    if (socket && room) {
      socket.emit(SOCKET_EVENTS.SET_WORD, { code: room.code, word });
    }
  },

  endQuestioning: (timeout: boolean = false) => {
    const { socket, room } = get();
    if (socket && room) {
      socket.emit(SOCKET_EVENTS.END_QUESTIONING, { code: room.code, timeout });
    }
  },

  stopTimer: () => {
    const { socket, room } = get();
    if (socket && room) {
      socket.emit(SOCKET_EVENTS.STOP_TIMER, { code: room.code });
    }
  },

  submitVote: (targetId: string) => {
    const { socket, room } = get();
    if (socket && room) {
      socket.emit(SOCKET_EVENTS.SUBMIT_VOTE, { code: room.code, targetId });
    }
  },

  resetRoom: () => {
    const { socket, room } = get();
    if (socket && room) {
      set({ myRole: null, secretWord: null });
      socket.emit(SOCKET_EVENTS.RESET_GAME, { code: room.code });
    }
  },

  leaveRoom: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('leave_room');
      localStorage.removeItem('who-know-roomCode');
      set({ room: null, myRole: null, secretWord: null });
    }
  },
  
  updateConfig: (config: Partial<RoomState['config']>) => {
    const { socket, room } = get();
    if (socket && room) {
      socket.emit(SOCKET_EVENTS.UPDATE_CONFIG, { code: room.code, config });
    }
  },

  tttJoinSide: (side: "X" | "O") => {
    const { socket, room } = get();
    if (socket && room) {
      socket.emit(SOCKET_EVENTS.TTT_JOIN_SIDE, { code: room.code, side });
    }
  },

  tttMakeMove: (index: number) => {
    const { socket, room } = get();
    if (socket && room) {
      socket.emit(SOCKET_EVENTS.TTT_MAKE_MOVE, { code: room.code, index });
    }
  },

  tttReset: () => {
    const { socket, room } = get();
    if (socket && room) {
      socket.emit(SOCKET_EVENTS.TTT_RESET, { code: room.code });
    }
  },

  rpsNextRound: () => {
    const { socket, room } = get();
    if (socket && room) {
      socket.emit(SOCKET_EVENTS.RPS_NEXT_ROUND, { code: room.code });
    }
  },

  rpsMakeChoice: (choice: "ROCK" | "PAPER" | "SCISSORS") => {
    const { socket, room } = get();
    if (socket && room) {
      socket.emit(SOCKET_EVENTS.RPS_MAKE_CHOICE, { code: room.code, choice });
    }
  },

  rpsReset: () => {
    const { socket, room } = get();
    if (socket && room) {
      socket.emit(SOCKET_EVENTS.RPS_RESET, { code: room.code });
    }
  }
}));
