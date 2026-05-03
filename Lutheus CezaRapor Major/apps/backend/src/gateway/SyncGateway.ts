/**
 * AMAÇ: İstemcilere (Web/Discord Bot) gerçek zamanlı state akışını iletmek.
 * MANTIK: NestJS WebSocketGateway, Object Level Auth kontrolü yapar. Sadece yetkili kanallara veri pushlar.
 */
import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
    cors: { origin: process.env.ALLOWED_ORIGINS?.split(',') || [] },
    namespace: '/v1/sync'
})
export class SyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    constructor(private readonly jwtService: JwtService) { }

    async handleConnection(client: Socket) {
        try {
            const token = client.handshake.auth.token;
            if (!token) throw new Error('MISSING_TOKEN');

            const payload = this.jwtService.verify(token);
            // Sadece yetkili olan kullanıcı kendi UUID odasına (Room) dahil olur. Tenant Isolation.
            client.join(`user_room_${payload.userId}`);

            // Admin veya Auditor ise global stream odasına al
            if (['admin', 'auditor'].includes(payload.role)) {
                client.join('global_audit_stream');
            }

            console.log(`[SyncGateway] Client connected: ${client.id} (User: ${payload.userId})`);
        } catch (error) {
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket) {
        console.log(`[SyncGateway] Client disconnected: ${client.id}`);
    }

    // Backend servisleri içinden çağrılacak event emitter
    public broadcastScanComplete(targetUserId: string, resultData: unknown) {
        // Taramayı başlatan kullanıcıya (Room) private gönder
        this.server.to(`user_room_${targetUserId}`).emit('SCAN_COMPLETED', resultData);
    }

    public broadcastGlobalAlert(alertPayload: unknown) {
        // Tüm adminlere global alert geç
        this.server.to('global_audit_stream').emit('CRITICAL_ALERT', alertPayload);
    }
}
