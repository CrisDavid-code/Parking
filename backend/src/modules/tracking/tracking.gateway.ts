import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AccessService } from '../../common/access.service';
import { AuthGuard } from '../../common/auth.guard';

/**
 * Socket.IO namespace /tracking. Clients connect with `auth: { token: <accessToken> }`
 * and emit `subscribe` { vehicleId }. Access is checked per subscription.
 */
@WebSocketGateway({ namespace: '/tracking', cors: { origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:8080').split(','), credentials: true } })
export class TrackingGateway implements OnGatewayConnection {
  private log = new Logger(TrackingGateway.name);
  @WebSocketServer() server: Server;
  constructor(private auth: AuthGuard, private access: AccessService) {}

  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth as { token?: string })?.token;
      client.data.user = await this.auth.verify(token ? `Bearer ${token}` : undefined);
    } catch {
      client.emit('error', { message: 'unauthorized' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('subscribe')
  async subscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { vehicleId?: string }) {
    const userId = client.data.user?.id as string | undefined;
    const vehicleId = body?.vehicleId;
    if (!userId || !vehicleId || !/^[0-9a-f-]{36}$/i.test(vehicleId)) return { ok: false, error: 'bad_request' };
    const perms = await this.access.vehiclePermissions(userId, vehicleId);
    if (!perms.has('view_location')) return { ok: false, error: 'forbidden' };
    await client.join(`vehicle:${vehicleId}`);
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe')
  async unsubscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { vehicleId?: string }) {
    if (body?.vehicleId) await client.leave(`vehicle:${body.vehicleId}`);
    return { ok: true };
  }

  emitLocation(vehicleId: string, payload: unknown) {
    this.server?.to(`vehicle:${vehicleId}`).emit('location', payload);
  }
}
