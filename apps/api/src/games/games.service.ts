import { Injectable } from '@nestjs/common';
import { RoomState, RoomStatus, Role, UserState } from '@repo/types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GamesService {
  private rooms: Map<string, RoomState> = new Map();

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
        timerMin: 3
      }
    };
    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code: string, user: Omit<UserState, 'score' | 'roomId' | 'role'>): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const existingPlayer = room.players.find(p => p.socketId === user.socketId);
    if (!existingPlayer) {
      room.players.push({
        ...user,
        score: 0,
        roomId: room.id,
      });
    }

    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code);
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
    const timeMs = (room.config.timerMin || 3) * 60 * 1000;
    room.endTime = Date.now() + timeMs;
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

    // Check if everyone (except the Host) has voted
    const playingCount = room.players.filter(p => p.role !== Role.Host).length;
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
      p.role = null;
    });

    this.rooms.set(code, room);
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
}
