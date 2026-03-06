import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GamesService } from './games.service';
import { SOCKET_EVENTS, RoomState, RoomStatus, Role, GameType, RPSChoice } from '@repo/types';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GamesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly gamesService: GamesService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    
    // Check which room the client is currently in before leaving
    let currentRoomCode = '';
    for (const [code, r] of (this.gamesService as any).rooms.entries()) {
      if (r.players.some((p: any) => p.socketId === client.id)) {
        currentRoomCode = code;
        break;
      }
    }

    const result = this.gamesService.leaveRoom(client.id, false);
    if (result && 'code' in result && result.code === null) {
      // Room was deleted because the host left, notify everyone in that room
      if (currentRoomCode) {
         this.server.to(currentRoomCode).emit(SOCKET_EVENTS.ROOM_DELETED);
      }
      this.server.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
    } else if (result) {
      // Player left, room still exists
      this.server.to(result.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, result);
      this.server.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
    } else {
      // Room was deleted because everyone left
      this.server.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
    }
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(@ConnectedSocket() client: Socket) {
    let currentRoomCode = '';
    for (const [code, r] of (this.gamesService as any).rooms.entries()) {
      if (r.players.some((p: any) => p.socketId === client.id)) {
        currentRoomCode = code;
        break;
      }
    }

    const result = this.gamesService.leaveRoom(client.id, true);
    if (result && 'code' in result && result.code === null) {
      if (currentRoomCode) {
         this.server.to(currentRoomCode).emit(SOCKET_EVENTS.ROOM_DELETED);
      }
      this.server.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
    } else if (result) {
      this.server.to(result.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, result);
      this.server.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
    } else {
      this.server.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
    }

    if (currentRoomCode) {
      client.leave(currentRoomCode);
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.GET_AVAILABLE_ROOMS)
  handleGetAvailableRooms(@ConnectedSocket() client: Socket) {
    client.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
  }

  @SubscribeMessage('create_room')
  handleCreateRoom(
    @MessageBody() data: { name: string; gameType?: GameType },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.createRoom(client.id, data.gameType);
    const updatedRoom = this.gamesService.joinRoom(room.code, {
      id: client.id,
      name: data.name,
      socketId: client.id,
    });

    if (updatedRoom) {
      client.join(updatedRoom.code);
      client.emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, updatedRoom);
      this.server.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.JOIN_ROOM)
  handleJoinRoom(
    @MessageBody() data: { code: string; name: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.joinRoom(data.code.toUpperCase(), {
      id: client.id, // using socketId as temp ID
      name: data.name,
      socketId: client.id,
    });

    if (room) {
      client.join(room.code);
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
      this.server.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());

      const player = room.players.find(p => p.socketId === client.id);
      if (player?.role) {
        if (room.status === RoomStatus.WORD_SETTING) {
          if (player.role === Role.Host) {
            client.emit(SOCKET_EVENTS.ROLE_ASSIGNED, { role: player.role });
          }
        } else if (room.status !== RoomStatus.LOBBY) {
          client.emit(SOCKET_EVENTS.ROLE_ASSIGNED, { role: player.role });
          
          const secretWord = this.gamesService.getSecretWord(room.code);
          if (secretWord && (player.role === Role.Host || player.role === Role.Know)) {
            client.emit(SOCKET_EVENTS.WORD_SETTING_COMPLETED, { word: secretWord });
          }
        }
      }
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Room not found' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.START_GAME)
  handleStartGame(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const result = this.gamesService.assignRoles(data.code, client.id);
    
    if (result) {
      // Broadcast updated room state
      this.server.to(result.room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, result.room);
      this.server.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
      
      // ONLY dispatch the Host role upfront so they know they are the host to set the word
      const host = Object.entries(result.roles).find(([_, role]) => role === Role.Host);
      if (host) {
        this.server.to(host[0]).emit(SOCKET_EVENTS.ROLE_ASSIGNED, { role: Role.Host });
      }
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot start game. Need at least 4 players (1 Host + 3 Players).' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SET_WORD)
  handleSetWord(@MessageBody() data: { code: string; word: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.setWord(data.code, data.word, client.id);

    if (room) {
      // Send the word ONLY to the Insider and Game Host
      const insider = room.players.find(p => p.role === Role.Know);
      const gameHost = room.players.find(p => p.role === Role.Host);

      if (insider) this.server.to(insider.socketId).emit(SOCKET_EVENTS.WORD_SETTING_COMPLETED, { word: data.word });
      if (gameHost) this.server.to(gameHost.socketId).emit(SOCKET_EVENTS.WORD_SETTING_COMPLETED, { word: data.word });

      // Now that the word is set, reveal everyone's roles to them privately
      room.players.forEach((player) => {
        if (player.role && player.role !== Role.Host) {
          this.server.to(player.socketId).emit(SOCKET_EVENTS.ROLE_ASSIGNED, { role: player.role });
        }
      });

      // Tell everyone else the phase changed
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized to set word or invalid room state.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.STOP_TIMER)
  handleStopTimer(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.stopTimer(data.code, client.id);

    if (room) {
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized or invalid game state to stop timer.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.END_QUESTIONING)
  handleEndQuestioning(@MessageBody() data: { code: string; timeout?: boolean }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.endQuestioning(data.code, client.id, data.timeout);

    if (room) {
      // Transition to Voting phase for everyone
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized or invalid game state to end questioning.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SUBMIT_VOTE)
  handleSubmitVote(@MessageBody() data: { code: string; targetId: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.submitVote(data.code, client.id, data.targetId);

    if (room) {
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to submit vote.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.RESET_GAME)
  handleResetGame(@MessageBody() data: { code: string }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.resetGame(data.code, client.id);

    if (room) {
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
      this.server.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized to reset game or invalid state.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.UPDATE_CONFIG)
  handleUpdateConfig(@MessageBody() data: { code: string; config: Partial<RoomState['config']> }, @ConnectedSocket() client: Socket) {
    const room = this.gamesService.updateConfig(data.code, client.id, data.config);

    if (room) {
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized to update config or invalid state.' });
    }
  }

  // --- Tic-Tac-Toe Game Actions ---

  @SubscribeMessage(SOCKET_EVENTS.TTT_JOIN_SIDE)
  handleTTTJoinSide(
    @MessageBody() data: { code: string; side: 'X' | 'O' },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.tttJoinSide(data.code, client.id, data.side);
    if (room) {
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
      // If we transitioned to PLAYING, the available rooms list changed logic doesn't strictly need update
      // but safe to broadcast if lobby state changed.
      this.server.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized or slot already taken.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.TTT_MAKE_MOVE)
  handleTTTMakeMove(
    @MessageBody() data: { code: string; index: number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.tttMakeMove(data.code, client.id, data.index);
    if (room) {
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid move.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.TTT_RESET)
  handleTTTReset(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.tttReset(data.code, client.id);
    if (room) {
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
      this.server.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized to reset game.' });
    }
  }

  // --- RPS Actions ---

  @SubscribeMessage(SOCKET_EVENTS.RPS_NEXT_ROUND)
  handleRPSNextRound(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.rpsNextRound(data.code, client.id);
    if (room) {
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized or slot already taken.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.RPS_MAKE_CHOICE)
  handleRPSMakeChoice(
    @MessageBody() data: { code: string; choice: RPSChoice },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.rpsMakeChoice(data.code, client.id, data.choice);
    if (room) {
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid choice or not your turn.' });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.RPS_RESET)
  handleRPSReset(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.rpsReset(data.code, client.id);
    if (room) {
      this.server.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, room);
      this.server.emit(SOCKET_EVENTS.AVAILABLE_ROOMS_UPDATED, this.gamesService.getAvailableRooms());
    } else {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized to reset game.' });
    }
  }
}
