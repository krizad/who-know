import { Injectable } from '@nestjs/common';
import { RoomState, RoomStatus, Role, UserState } from '@repo/types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GamesService {
  private rooms: Map<string, RoomState> = new Map();
  private readonly secretWords: Map<string, string> = new Map();

  createRoom(hostId: string): RoomState {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room: RoomState = {
      id: uuidv4(),
      code,
      status: RoomStatus.LOBBY,
      roomHostId: hostId,
      players: [],
      createdAt: new Date(),
      config: {
        hostSelection: 'ROUND_ROBIN',
        timerMin: 5
      }
    };
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

  getAvailableRooms(): { code: string; hostName: string; playerCount: number }[] {
    const availableRooms = [];
    for (const room of this.rooms.values()) {
      if (room.status === RoomStatus.LOBBY) {
        availableRooms.push({
          code: room.code,
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
}
