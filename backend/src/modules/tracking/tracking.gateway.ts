import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';
import { AccessService } from '../../common/access.service';
import { AuthGuard } from '../../common/auth.guard';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Native WebSocket endpoint `/tracking?vehicleId=<uuid>&token=<accessToken>`.
 * The socket is authenticated and authorized (view_location) on connect; it then receives
 * `{ "event": "location", "data": LastLocation }` messages for that vehicle only.
 */
@WebSocketGateway({ path: '/tracking' })
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private log = new Logger(TrackingGateway.name);
  // ponytail: in-memory fan-out, single instance only; use Redis pub/sub when running >1 replica.
  private rooms = new Map<string, Set<WebSocket>>();
  constructor(private auth: AuthGuard, private access: AccessService) {}

  async handleConnection(client: WebSocket, req: IncomingMessage) {
    const url = new URL(req.url ?? '', 'http://localhost');
    const vehicleId = url.searchParams.get('vehicleId') ?? '';
    const token = url.searchParams.get('token') ?? '';
    try {
      if (!UUID.test(vehicleId)) throw new Error('bad vehicleId');
      const user = await this.auth.verify(`Bearer ${token}`);
      const perms = await this.access.vehiclePermissions(user.id, vehicleId);
      if (!perms.has('view_location')) throw new Error('forbidden');
    } catch {
      client.close(4401, 'unauthorized');
      return;
    }
    (this.rooms.get(vehicleId) ?? this.rooms.set(vehicleId, new Set()).get(vehicleId)!).add(client);
    (client as WebSocket & { vehicleId?: string }).vehicleId = vehicleId;
  }

  handleDisconnect(client: WebSocket & { vehicleId?: string }) {
    if (!client.vehicleId) return;
    const room = this.rooms.get(client.vehicleId);
    room?.delete(client);
    if (room && !room.size) this.rooms.delete(client.vehicleId);
  }

  emitLocation(vehicleId: string, payload: unknown) {
    const msg = JSON.stringify({ event: 'location', data: payload });
    this.rooms.get(vehicleId)?.forEach((c) => c.readyState === 1 && c.send(msg));
  }

  onModuleDestroy() {
    this.rooms.forEach((r) => r.forEach((c) => c.close()));
  }
}
