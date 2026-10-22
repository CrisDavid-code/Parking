import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AccessModule } from './common/access.service';
import { AuthGuard } from './common/auth.guard';
import { PrismaModule } from './common/prisma.service';
import { config } from './config';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BuildingsModule } from './modules/buildings/buildings.module';
import { DevicesModule } from './modules/devices/devices.module';
import { FilesModule } from './modules/files/files.module';
import { GeofencesModule } from './modules/geofences/geofences.module';
import { HealthModule } from './modules/health/health.module';
import { IndoorMapsModule } from './modules/indoor-maps/indoor-maps.module';
import { LocationsModule } from './modules/locations/locations.module';
import { NavigationModule } from './modules/navigation/navigation.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ParkingModule } from './modules/parking/parking.module';
import { SensorsModule } from './modules/sensors/sensors.module';
import { SharingModule } from './modules/sharing/sharing.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { UsersModule } from './modules/users/users.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password', 'req.body.refreshToken'],
        transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120) }],
      skipIf: () => process.env.THROTTLE_DISABLED === 'true',
    }),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const c = config();
        return { secret: c.jwtSecret, signOptions: { expiresIn: c.accessTtlSeconds } };
      },
    }),
    PrismaModule,
    AccessModule,
    AuditModule,
    FilesModule,
    NotificationsModule,
    SubscriptionsModule,
    AuthModule,
    UsersModule,
    VehiclesModule,
    ParkingModule,
    LocationsModule,
    DevicesModule,
    GeofencesModule,
    TrackingModule,
    SharingModule,
    OrganizationsModule,
    BuildingsModule,
    IndoorMapsModule,
    SensorsModule,
    NavigationModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
