import { Injectable } from '@nestjs/common';
import { RoomState, RoomStatus, Role, UserState, GameType, TicTacToeCell, RPSChoice } from '@repo/types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GamesService {
  private rooms: Map<string, RoomState> = new Map();
  private readonly secretWords: Map<string, string> = new Map();

  createRoom(hostId: string, gameType: GameType = GameType.WHO_KNOW): RoomState {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room: RoomState = {
      id: uuidv4(),
      gameType,
      code,
      status: RoomStatus.LOBBY,
      roomHostId: hostId,
      players: [],
      createdAt: new Date(),
      config: {
        hostSelection: 'ROUND_ROBIN',
        timerMin: 5,
        rpsBestOf: 3,
        rpsMode: '1V1_ROUND_ROBIN'
      }
    };

    if (gameType === GameType.TIC_TAC_TOE) {
      room.ticTacToeState = {
        board: Array(9).fill(null),
        currentTurn: "X"
      };
    } else if (gameType === GameType.RPS) {
      room.rpsState = {
        activePlayers: [],
        queue: [],
        choices: {},
        scores: {},
      };
    }

    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code: string, user: Omit<UserState, 'score' | 'roomId' | 'role'>): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    // First check if the user is reconnecting (by checking name since they don't have accounts)
    const existingPlayer = room.players.find(p => p.name === user.name);
    
    if (existingPlayer) {
      // User is reconnecting - update their socket ID
      const oldSocketId = existingPlayer.socketId;
      existingPlayer.socketId = user.socketId;
      existingPlayer.connected = true;
      
      // If they were the host, we must update the roomHostId
      if (room.roomHostId === oldSocketId) {
        room.roomHostId = user.socketId;
      }
      
      // If there are votes pointing to the old socket ID, we need to update those too
      if (room.votes) {
        // Update votes CAST BY this player
        if (room.votes[oldSocketId]) {
          room.votes[user.socketId] = room.votes[oldSocketId];
          delete room.votes[oldSocketId];
        }
        
        // Update votes pointing TO this player
        Object.entries(room.votes).forEach(([voterId, targetId]) => {
          if (targetId === oldSocketId) {
            room.votes![voterId] = user.socketId;
          }
        });
      }
    } else {
      room.players.push({
        ...user,
        score: 0,
        roomId: room.id,
        connected: true,
      });
    }

    this.rooms.set(code, room);
    return room;
  }

  leaveRoom(clientId: string, explicitLeave: boolean = false): RoomState | null | { code: null } {
    for (const [code, room] of this.rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.socketId === clientId);
      if (playerIndex !== -1) {
        // If the Room Host leaves explicitly or in lobby, destroy the entire room
        if (room.roomHostId === clientId) {
          if (explicitLeave || room.status === RoomStatus.LOBBY) {
            this.rooms.delete(code);
            this.secretWords.delete(code);
            return { code: null }; // special return to indicate the room was deleted entirely
          }
        }

        if (explicitLeave || room.status === RoomStatus.LOBBY) {
          room.players.splice(playerIndex, 1);
        } else {
          room.players[playerIndex].connected = false;
        }
        
        const activePlayers = room.players.filter(p => p.connected !== false).length;
        if (activePlayers === 0) {
          this.rooms.delete(code);
          this.secretWords.delete(code);
          return null;
        }

        this.rooms.set(code, room);
        return room;
      }
    }
    return null;
  }

  getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code);
  }

  getAvailableRooms(): { code: string; gameType: GameType; hostName: string; playerCount: number }[] {
    const availableRooms = [];
    for (const room of this.rooms.values()) {
      if (room.status === RoomStatus.LOBBY) {
        availableRooms.push({
          code: room.code,
          gameType: room.gameType,
          hostName: room.players.find(p => p.socketId === room.roomHostId)?.name || 'Unknown',
          playerCount: room.players.length
        });
      }
    }
    return availableRooms;
  }

  assignRoles(code: string, requesterId: string): { room: RoomState, roles: Record<string, Role> } | null {
    const room = this.rooms.get(code);
    if (!room || room.players.length < 4) return null; // Need at least 4 players (1 Host + 3 Players)
    if (room.roomHostId !== requesterId) return null; // Only Room Host can start

    // Handling RPS auto-start logic
    if (room.gameType === GameType.RPS) {
      if (!room.rpsState) return null;
      
      room.status = RoomStatus.PLAYING;
      
      const allPlayerIds = room.players.map(p => p.socketId);
      
      if (room.config.rpsMode === "ALL_AT_ONCE") {
        room.rpsState.activePlayers = [...allPlayerIds];
        room.rpsState.queue = [];
      } else {
        // 1V1 config
        room.rpsState.activePlayers = allPlayerIds.slice(0, 2);
        room.rpsState.queue = allPlayerIds.slice(2);
      }
      
      room.rpsState.choices = {};
      room.rpsState.scores = {};
      allPlayerIds.forEach(id => room.rpsState!.scores[id] = 0);
      room.rpsState.gameWinner = undefined;
      room.rpsState.roundWinner = undefined;

      this.rooms.set(code, room);
      return { room, roles: {} }; // RPS doesn't use these specific hidden roles
    }

    room.status = RoomStatus.WORD_SETTING;
    
    // Assign Host based on config
    let hostPlayer: UserState;
    
    if (room.config.hostSelection === 'FIXED') {
      // Fixed: The room creator is always the host
      hostPlayer = room.players.find(p => p.socketId === room.roomHostId) || room.players[0];
    } else if (room.config.hostSelection === 'RANDOM') {
      // Random: Completely random selection
      const hostIndex = Math.floor(Math.random() * room.players.length);
      hostPlayer = room.players[hostIndex];
    } else {
      // Default / Round Robin
      let eligibleHosts = room.players.filter(p => !p.hasBeenHost);
      // If everyone has been a host, reset the flags for a new cycle
      if (eligibleHosts.length === 0) {
        room.players.forEach(p => p.hasBeenHost = false);
        eligibleHosts = room.players;
      }
      const hostIndex = Math.floor(Math.random() * eligibleHosts.length);
      hostPlayer = eligibleHosts[hostIndex];
    }
    
    // Mark as has been host
    hostPlayer.hasBeenHost = true;
    
    // Now pick the Know from the remaining players
    const remainingPlayers = room.players.filter(p => p.socketId !== hostPlayer.socketId);
    const knowIndex = Math.floor(Math.random() * remainingPlayers.length);
    const knowPlayer = remainingPlayers[knowIndex];
    
    // Assign roles
    const roles: Record<string, Role> = {};
    room.players.forEach(p => {
      let role = Role.Unknow;
      if (p.socketId === hostPlayer.socketId) role = Role.Host;
      else if (p.socketId === knowPlayer.socketId) role = Role.Know;
      
      p.role = role;
      roles[p.socketId] = role;
    });

    this.rooms.set(code, room);
    return { room, roles };
  }

  setWord(code: string, word: string, requesterId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room || room.status !== RoomStatus.WORD_SETTING) return null;

    const player = room.players.find(p => p.socketId === requesterId);
    if (!player || player.role !== Role.Host) return null;

    room.status = RoomStatus.QUESTIONING;
    // Set timer based on config
    const timeMs = (room.config.timerMin || 5) * 60 * 1000;
    room.endTime = Date.now() + timeMs;
    this.rooms.set(code, room);
    this.secretWords.set(code, word);

    return room;
  }

  stopTimer(code: string, requesterId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room || room.status !== RoomStatus.QUESTIONING) return null;

    const player = room.players.find(p => p.socketId === requesterId);
    if (!player || player.role !== Role.Host) return null;

    room.endTime = undefined;
    this.rooms.set(code, room);
    return room;
  }

  endQuestioning(code: string, requesterId: string, timeout: boolean = false): RoomState | null {
    const room = this.rooms.get(code);
    if (!room || room.status !== RoomStatus.QUESTIONING) return null;

    const player = room.players.find(p => p.socketId === requesterId);
    // Only the Host can end the questioning manually
    if (!player || player.role !== Role.Host) return null;

    if (timeout) {
      room.status = RoomStatus.RESULT;
      room.winner = 'TIMEOUT';
      room.endTime = undefined;
    } else {
      room.status = RoomStatus.VOTING;
      room.endTime = undefined; // clear timer
      room.votes = {}; // initialize voting map
    }

    this.rooms.set(code, room);

    return room;
  }

  submitVote(code: string, voterId: string, targetId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room || room.status !== RoomStatus.VOTING) return null;

    // ensure votes object exists
    if (!room.votes) room.votes = {};
    
    // Register vote
    room.votes[voterId] = targetId;

    // Check if everyone (except the Host and disconnected players) has voted
    const playingCount = room.players.filter(p => p.role !== Role.Host && p.connected !== false).length;
    const votesCast = Object.keys(room.votes).length;

    if (votesCast >= playingCount) {
      room.status = RoomStatus.RESULT;

      // Calculate scores
      const voteCounts = Object.values(room.votes).reduce((acc, votedForId) => {
        acc[votedForId] = (acc[votedForId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      let maxVotes = 0;
      let suspectedIds: string[] = [];

      Object.entries(voteCounts).forEach(([id, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          suspectedIds = [id];
        } else if (count === maxVotes) {
          suspectedIds.push(id);
        }
      });

      const insider = room.players.find(p => p.role === Role.Know);
      const isInsiderCaught = insider && suspectedIds.includes(insider.socketId);

      if (isInsiderCaught) {
        room.winner = 'COMMONERS';
        // Commoners and Host win: +1 point each
        room.players.forEach(p => {
          if (p.role !== Role.Know) p.score += 1;
        });
      } else {
        room.winner = 'INSIDER';
        // Insider wins: +2 points
        if (insider) insider.score += 2;
      }
    }

    this.rooms.set(code, room);
    return room;
  }

  resetGame(code: string, requesterId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room || room.status !== RoomStatus.RESULT) return null;

    if (room.roomHostId !== requesterId) return null;

    // reset room state
    room.status = RoomStatus.LOBBY;
    room.votes = undefined;
    room.endTime = undefined;
    room.winner = undefined;
    
    // clear all player scores/roles for next round
    room.players.forEach(p => {
      p.role = null as unknown as Role;
    });

    this.rooms.set(code, room);
    this.secretWords.delete(code);
    return room;
  }

  updateConfig(code: string, requesterId: string, config: Partial<RoomState['config']>): RoomState | null {
    const room = this.rooms.get(code);
    if (!room || room.status !== RoomStatus.LOBBY) return null;

    if (room.roomHostId !== requesterId) return null; // Only Room Host can update config
    
    room.config = { ...room.config, ...config };
    this.rooms.set(code, room);
    return room;
  }

  getSecretWord(code: string): string | undefined {
    return this.secretWords.get(code);
  }

  // --- Tic-Tac-Toe Logic ---

  tttJoinSide(code: string, clientId: string, side: "X" | "O"): RoomState | null {
    const room = this.rooms.get(code);
    if (!room || room.gameType !== GameType.TIC_TAC_TOE || room.status !== RoomStatus.LOBBY) return null;

    if (!room.ticTacToeState) return null;

    // Check if player is already in a slot, remove them
    if (room.ticTacToeState.playerXId === clientId) room.ticTacToeState.playerXId = undefined;
    if (room.ticTacToeState.playerOId === clientId) room.ticTacToeState.playerOId = undefined;

    // Check if slot is available
    if (side === "X" && !room.ticTacToeState.playerXId) {
      room.ticTacToeState.playerXId = clientId;
    } else if (side === "O" && !room.ticTacToeState.playerOId) {
      room.ticTacToeState.playerOId = clientId;
    }

    // If both slots are filled, transition to playing
    if (room.ticTacToeState.playerXId && room.ticTacToeState.playerOId) {
      room.status = RoomStatus.PLAYING;
    }

    this.rooms.set(code, room);
    return room;
  }

  private tttCheckWin(board: TicTacToeCell[]): { winner: "X" | "O" | null, line?: number[] } {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
      [0, 4, 8], [2, 4, 6] // diagonals
    ];

    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a] as "X" | "O", line: lines[i] };
      }
    }
    return { winner: null };
  }

  tttMakeMove(code: string, clientId: string, index: number): RoomState | null {
    const room = this.rooms.get(code);
    if (!room || room.gameType !== GameType.TIC_TAC_TOE || room.status !== RoomStatus.PLAYING) return null;

    const ttt = room.ticTacToeState;
    if (!ttt || ttt.winner) return null; // Game already over

    // Identify which side the client is
    const mySide = ttt.playerXId === clientId ? "X" : ttt.playerOId === clientId ? "O" : null;
    
    // Only players in the game can move, and only on their turn
    if (!mySide || ttt.currentTurn !== mySide) return null;

    // Check if cell is empty
    if (ttt.board[index] !== null) return null;

    // Make move
    ttt.board[index] = mySide;

    // Check win condition
    const { winner, line } = this.tttCheckWin(ttt.board);
    if (winner) {
      ttt.winner = winner;
      ttt.winningLine = line;
      room.status = RoomStatus.RESULT;
      
      // Update scores
      const winnerPlayerId = winner === "X" ? ttt.playerXId : ttt.playerOId;
      const winnerPlayer = room.players.find(p => p.socketId === winnerPlayerId);
      if (winnerPlayer) winnerPlayer.score += 1;

    } else if (!ttt.board.includes(null)) {
      // Draw condition
      ttt.winner = "DRAW";
      room.status = RoomStatus.RESULT;
    } else {
      // Switch turns
      ttt.currentTurn = ttt.currentTurn === "X" ? "O" : "X";
    }

    this.rooms.set(code, room);
    return room;
  }

  tttReset(code: string, clientId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room || room.gameType !== GameType.TIC_TAC_TOE || room.status !== RoomStatus.RESULT) return null;

    // Only allow players who are playing or the room host to reset
    if (room.roomHostId !== clientId && room.ticTacToeState?.playerXId !== clientId && room.ticTacToeState?.playerOId !== clientId) {
      return null;
    }

    // Reset state but keep players
    const willStartImmediately = !!(room.ticTacToeState?.playerXId && room.ticTacToeState?.playerOId);
    room.status = willStartImmediately ? RoomStatus.PLAYING : RoomStatus.LOBBY;

    const previousWinner = room.ticTacToeState?.winner;
    
    room.ticTacToeState = {
      board: Array(9).fill(null),
      playerXId: room.ticTacToeState?.playerXId,
      playerOId: room.ticTacToeState?.playerOId,
      currentTurn: previousWinner === "X" ? "O" : "X" // Loser goes first, default X
    };

    if (previousWinner === "DRAW") {
      room.ticTacToeState.currentTurn = "X";
    }

    this.rooms.set(code, room);
    return room;
  }

  // --- RPS Logic ---

  rpsMakeChoice(code: string, clientId: string, choice: RPSChoice): RoomState | null {
    const room = this.rooms.get(code);
    if (!room || room.gameType !== GameType.RPS || room.status !== RoomStatus.PLAYING) return null;

    const rps = room.rpsState;
    if (!rps || rps.gameWinner) return null;

    if (!rps.activePlayers.includes(clientId)) return null; // Only active players can choose

    // Record choice
    rps.choices[clientId] = choice;

    // Check if everyone active has chosen
    const allChosen = rps.activePlayers.every(id => !!rps.choices[id]);

    if (allChosen) {
      if (room.config.rpsMode === "ALL_AT_ONCE") {
        this.resolveAllAtOnceRound(room);
      } else {
        this.resolve1v1Round(room);
      }
      
      // Check for Game Winner based on BestOf
      const bestOf = room.config.rpsBestOf || 3;
      const targetScore = Math.floor(bestOf / 2) + 1;
      
      const gameWinners = Object.entries(rps.scores)
        .filter(([_, score]) => score >= targetScore)
        .map(([id, _]) => id);
        
      if (gameWinners.length > 0) {
        rps.gameWinner = gameWinners.length === 1 ? gameWinners[0] : gameWinners;
      }
      
      room.status = RoomStatus.RESULT;
    }

    this.rooms.set(code, room);
    return room;
  }

  private resolve1v1Round(room: RoomState) {
    const rps = room.rpsState!;
    const [p1, p2] = rps.activePlayers;
    const c1 = rps.choices[p1];
    const c2 = rps.choices[p2];

    if (c1 === c2) {
      rps.roundWinner = "DRAW";
    } else if (
      (c1 === "ROCK" && c2 === "SCISSORS") ||
      (c1 === "PAPER" && c2 === "ROCK") ||
      (c1 === "SCISSORS" && c2 === "PAPER")
    ) {
      rps.roundWinner = p1;
      rps.scores[p1] = (rps.scores[p1] || 0) + 1;
      
      // Rotate loser to back of queue
      if (rps.queue.length > 0) {
        rps.queue.push(p2);
        rps.activePlayers[1] = rps.queue.shift()!;
      }
    } else {
      rps.roundWinner = p2;
      rps.scores[p2] = (rps.scores[p2] || 0) + 1;
      
      // Rotate loser to back of queue
      if (rps.queue.length > 0) {
        rps.queue.push(p1);
        rps.activePlayers[0] = rps.queue.shift()!;
      }
    }
  }

  private resolveAllAtOnceRound(room: RoomState) {
    const rps = room.rpsState!;
    const choicesList = Object.values(rps.choices);
    
    const hasRock = choicesList.includes("ROCK");
    const hasPaper = choicesList.includes("PAPER");
    const hasScissors = choicesList.includes("SCISSORS");
    
    // Draw if all 3 are played, or only 1 type is played
    if ((hasRock && hasPaper && hasScissors) || 
        (!hasRock && !hasPaper) || 
        (!hasRock && !hasScissors) || 
        (!hasPaper && !hasScissors)) {
      rps.roundWinner = "DRAW";
      return;
    }
    
    // Determine the winning symbol
    let winningSymbol: RPSChoice;
    if (hasRock && hasScissors) winningSymbol = "ROCK";
    else if (hasScissors && hasPaper) winningSymbol = "SCISSORS";
    else winningSymbol = "PAPER"; // hasRock && hasPaper
    
    // Award points
    const winners: string[] = [];
    Object.entries(rps.choices).forEach(([id, choice]) => {
      if (choice === winningSymbol) {
        winners.push(id);
        rps.scores[id] = (rps.scores[id] || 0) + 1;
      }
    });
    
    rps.roundWinner = winners;
  }

  rpsNextRound(code: string, clientId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room || room.gameType !== GameType.RPS || room.status !== RoomStatus.RESULT) return null;
    if (!room.rpsState) return null;
    
    // Host or an active player can click next
    if (room.roomHostId !== clientId && !room.rpsState.activePlayers.includes(clientId)) {
      return null;
    }

    if (room.rpsState.gameWinner) {
      return this.rpsReset(code, clientId);
    }

    room.rpsState.choices = {};
    room.status = RoomStatus.PLAYING;
    this.rooms.set(code, room);
    return room;
  }

  rpsReset(code: string, clientId: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room || room.gameType !== GameType.RPS || room.status !== RoomStatus.RESULT) return null;

    // Only allow players who are in the room or host to reset
    if (room.roomHostId !== clientId && !room.players.some(p => p.socketId === clientId)) {
      return null;
    }

    room.status = RoomStatus.LOBBY;
    room.rpsState = {
      activePlayers: [],
      queue: [],
      choices: {},
      scores: {}
    };

    // wipe global scores for standard presentation
    room.players.forEach(p => p.score = 0);

    this.rooms.set(code, room);
    return room;
  }
}
