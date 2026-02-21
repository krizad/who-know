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
import { SOCKET_EVENTS, RoomState, Role } from '@repo/types';

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
    // Handle player disconnect logic here if needed
  }

  @SubscribeMessage('create_room')
  handleCreateRoom(
    @MessageBody() data: { name: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.gamesService.createRoom(client.id);
    const updatedRoom = this.gamesService.joinRoom(room.code, {
      id: client.id,
      name: data.name,
      socketId: client.id,
    });

    if (updatedRoom) {
      client.join(updatedRoom.code);
      client.emit(SOCKET_EVENTS.ROOM_STATE_UPDATED, updatedRoom);
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
}
