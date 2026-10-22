-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('personal', 'business');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('ORG_ADMIN', 'ORG_MEMBER', 'DRIVER');

-- CreateEnum
CREATE TYPE "ParkingStatus" AS ENUM ('active', 'ended');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('pending', 'active', 'revoked');

-- CreateEnum
CREATE TYPE "ShareStatus" AS ENUM ('pending', 'active', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'pending_payment', 'past_due', 'canceled');

-- CreateEnum
CREATE TYPE "MapVersionStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('corridor', 'elevator', 'stairs', 'ramp', 'entrance', 'exit', 'parking_spot', 'landmark');

-- CreateEnum
CREATE TYPE "EdgeType" AS ENUM ('walk', 'elevator', 'stairs', 'ramp');

-- CreateEnum
CREATE TYPE "NavigationMode" AS ENUM ('basic', 'indoor', 'sensor');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL DEFAULT 'USER',
    "account_type" "AccountType" NOT NULL DEFAULT 'personal',
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" UUID NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es',
    "timezone" TEXT NOT NULL DEFAULT 'America/Guatemala',
    "currency" TEXT NOT NULL DEFAULT 'GTQ',
    "phone" TEXT,
    "location_prefs" JSONB NOT NULL DEFAULT '{}',
    "onboarding_done" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "organization_id" UUID,
    "alias" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "color" TEXT,
    "plate" TEXT,
    "photo_key" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "maintenance_status" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_members" (
    "vehicle_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "permissions" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_members_pkey" PRIMARY KEY ("vehicle_id","user_id")
);

-- CreateTable
CREATE TABLE "parking_sessions" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "status" "ParkingStatus" NOT NULL DEFAULT 'active',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracy_meters" DOUBLE PRECISION,
    "address" TEXT,
    "building_id" UUID,
    "level_id" UUID,
    "level_label" TEXT,
    "zone" TEXT,
    "row" TEXT,
    "spot" TEXT,
    "parking_place_id" UUID,
    "entrance" TEXT,
    "reference_point" TEXT,
    "reference_type" TEXT,
    "ticket_number" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parking_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parking_media" (
    "id" UUID NOT NULL,
    "parking_session_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'photo',
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parking_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_events" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy_meters" DOUBLE PRECISION,
    "speed_mps" DOUBLE PRECISION,
    "heading_degrees" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'gps',
    "captured_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_last_locations" (
    "vehicle_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy_meters" DOUBLE PRECISION,
    "speed_mps" DOUBLE PRECISION,
    "heading_degrees" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_last_locations_pkey" PRIMARY KEY ("vehicle_id")
);

-- CreateTable
CREATE TABLE "tracking_devices" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "organization_id" UUID,
    "vehicle_id" UUID,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'pending',
    "last_seen_at" TIMESTAMP(3),
    "battery_percent" INTEGER,
    "signal" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracking_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_credentials" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "device_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_provider_configs" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "provider" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "secret_ref" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_shares" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "grantee_email" TEXT NOT NULL,
    "grantee_user_id" UUID,
    "permissions" TEXT[],
    "status" "ShareStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "share_id" UUID,
    "organization_id" UUID,
    "org_role" "OrgRole",
    "invited_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_monthly" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GTQ',
    "limits" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "organization_id" UUID,
    "plan_code" TEXT NOT NULL,
    "pending_plan_code" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "provider" TEXT,
    "provider_ref" TEXT,
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "subscription_id" UUID,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "organization_id" UUID,
    "metric" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "OrgRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("organization_id","user_id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "full_name" TEXT NOT NULL,
    "license_number" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_assignments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geofences" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "center_lat" DOUBLE PRECISION NOT NULL,
    "center_lng" DOUBLE PRECISION NOT NULL,
    "radius_meters" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geofences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geofence_events" (
    "id" UUID NOT NULL,
    "geofence_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geofence_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "published_version" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "building_levels" (
    "id" UUID NOT NULL,
    "building_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,

    CONSTRAINT "building_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indoor_map_versions" (
    "id" UUID NOT NULL,
    "building_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "MapVersionStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "created_by_id" UUID,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indoor_map_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indoor_zones" (
    "id" UUID NOT NULL,
    "map_version_id" UUID NOT NULL,
    "level_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'general',
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "polygon" JSONB,

    CONSTRAINT "indoor_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "navigation_nodes" (
    "id" UUID NOT NULL,
    "map_version_id" UUID NOT NULL,
    "level_id" UUID NOT NULL,
    "zone_id" UUID,
    "key" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "type" "NodeType" NOT NULL,
    "label" TEXT,

    CONSTRAINT "navigation_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "navigation_edges" (
    "id" UUID NOT NULL,
    "map_version_id" UUID NOT NULL,
    "from_node_id" UUID NOT NULL,
    "to_node_id" UUID NOT NULL,
    "distance_meters" DOUBLE PRECISION NOT NULL,
    "type" "EdgeType" NOT NULL DEFAULT 'walk',
    "accessible" BOOLEAN NOT NULL DEFAULT true,
    "bidirectional" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'open',

    CONSTRAINT "navigation_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parking_places" (
    "id" UUID NOT NULL,
    "level_id" UUID NOT NULL,
    "node_id" UUID,
    "code" TEXT NOT NULL,
    "row" TEXT,
    "zone" TEXT,

    CONSTRAINT "parking_places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indoor_landmarks" (
    "id" UUID NOT NULL,
    "level_id" UUID NOT NULL,
    "node_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "photo_key" TEXT,

    CONSTRAINT "indoor_landmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parking_entry_points" (
    "id" UUID NOT NULL,
    "building_id" UUID NOT NULL,
    "level_id" UUID NOT NULL,
    "node_id" UUID,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "parking_entry_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedestrian_navigation_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parking_session_id" UUID NOT NULL,
    "mode" "NavigationMode" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "map_version_id" UUID,
    "target_node_id" UUID,
    "current_node_id" UUID,
    "current_level_id" UUID,
    "position_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "pedestrian_navigation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedestrian_position_estimates" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "level_id" UUID,
    "node_id" UUID,
    "steps" INTEGER,
    "estimated_distance_meters" DOUBLE PRECISION,
    "heading_degrees" DOUBLE PRECISION,
    "turn_estimate" TEXT,
    "floor_estimate" TEXT,
    "pressure_hpa" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL,
    "uncertainty_meters" DOUBLE PRECISION,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedestrian_position_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "organization_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "vehicles_owner_id_idx" ON "vehicles"("owner_id");

-- CreateIndex
CREATE INDEX "vehicles_organization_id_idx" ON "vehicles"("organization_id");

-- CreateIndex
CREATE INDEX "parking_sessions_vehicle_id_status_idx" ON "parking_sessions"("vehicle_id", "status");

-- CreateIndex
CREATE INDEX "location_events_vehicle_id_captured_at_idx" ON "location_events"("vehicle_id", "captured_at");

-- CreateIndex
CREATE UNIQUE INDEX "location_events_device_id_captured_at_key" ON "location_events"("device_id", "captured_at");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_devices_owner_id_serial_key" ON "tracking_devices"("owner_id", "serial");

-- CreateIndex
CREATE UNIQUE INDEX "device_credentials_token_prefix_key" ON "device_credentials"("token_prefix");

-- CreateIndex
CREATE INDEX "location_shares_grantee_user_id_status_idx" ON "location_shares"("grantee_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_organization_id_key" ON "subscriptions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_provider_event_id_key" ON "billing_events"("provider", "event_id");

-- CreateIndex
CREATE INDEX "usage_records_metric_recorded_at_idx" ON "usage_records"("metric", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "drivers_organization_id_idx" ON "drivers"("organization_id");

-- CreateIndex
CREATE INDEX "vehicle_assignments_organization_id_idx" ON "vehicle_assignments"("organization_id");

-- CreateIndex
CREATE INDEX "geofences_organization_id_idx" ON "geofences"("organization_id");

-- CreateIndex
CREATE INDEX "geofence_events_geofence_id_vehicle_id_occurred_at_idx" ON "geofence_events"("geofence_id", "vehicle_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "building_levels_building_id_code_key" ON "building_levels"("building_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "indoor_map_versions_building_id_version_key" ON "indoor_map_versions"("building_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "navigation_nodes_map_version_id_key_key" ON "navigation_nodes"("map_version_id", "key");

-- CreateIndex
CREATE INDEX "navigation_edges_map_version_id_idx" ON "navigation_edges"("map_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "parking_places_level_id_code_key" ON "parking_places"("level_id", "code");

-- CreateIndex
CREATE INDEX "pedestrian_position_estimates_session_id_captured_at_idx" ON "pedestrian_position_estimates"("session_id", "captured_at");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_created_at_idx" ON "audit_events"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_user_id_created_at_idx" ON "audit_events"("actor_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_members" ADD CONSTRAINT "vehicle_members_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_members" ADD CONSTRAINT "vehicle_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "building_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_parking_place_id_fkey" FOREIGN KEY ("parking_place_id") REFERENCES "parking_places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_media" ADD CONSTRAINT "parking_media_parking_session_id_fkey" FOREIGN KEY ("parking_session_id") REFERENCES "parking_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_events" ADD CONSTRAINT "location_events_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_events" ADD CONSTRAINT "location_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "tracking_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_last_locations" ADD CONSTRAINT "vehicle_last_locations_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_devices" ADD CONSTRAINT "tracking_devices_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_devices" ADD CONSTRAINT "tracking_devices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_devices" ADD CONSTRAINT "tracking_devices_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_credentials" ADD CONSTRAINT "device_credentials_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "tracking_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_shares" ADD CONSTRAINT "location_shares_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "location_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_code_fkey" FOREIGN KEY ("plan_code") REFERENCES "plans"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofence_events" ADD CONSTRAINT "geofence_events_geofence_id_fkey" FOREIGN KEY ("geofence_id") REFERENCES "geofences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofence_events" ADD CONSTRAINT "geofence_events_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "building_levels" ADD CONSTRAINT "building_levels_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indoor_map_versions" ADD CONSTRAINT "indoor_map_versions_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indoor_zones" ADD CONSTRAINT "indoor_zones_map_version_id_fkey" FOREIGN KEY ("map_version_id") REFERENCES "indoor_map_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indoor_zones" ADD CONSTRAINT "indoor_zones_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "building_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_nodes" ADD CONSTRAINT "navigation_nodes_map_version_id_fkey" FOREIGN KEY ("map_version_id") REFERENCES "indoor_map_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_nodes" ADD CONSTRAINT "navigation_nodes_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "building_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_nodes" ADD CONSTRAINT "navigation_nodes_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "indoor_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_edges" ADD CONSTRAINT "navigation_edges_map_version_id_fkey" FOREIGN KEY ("map_version_id") REFERENCES "indoor_map_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_edges" ADD CONSTRAINT "navigation_edges_from_node_id_fkey" FOREIGN KEY ("from_node_id") REFERENCES "navigation_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_edges" ADD CONSTRAINT "navigation_edges_to_node_id_fkey" FOREIGN KEY ("to_node_id") REFERENCES "navigation_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_places" ADD CONSTRAINT "parking_places_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "building_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_places" ADD CONSTRAINT "parking_places_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "navigation_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indoor_landmarks" ADD CONSTRAINT "indoor_landmarks_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "building_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indoor_landmarks" ADD CONSTRAINT "indoor_landmarks_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "navigation_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_entry_points" ADD CONSTRAINT "parking_entry_points_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_entry_points" ADD CONSTRAINT "parking_entry_points_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "building_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_entry_points" ADD CONSTRAINT "parking_entry_points_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "navigation_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedestrian_navigation_sessions" ADD CONSTRAINT "pedestrian_navigation_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedestrian_navigation_sessions" ADD CONSTRAINT "pedestrian_navigation_sessions_parking_session_id_fkey" FOREIGN KEY ("parking_session_id") REFERENCES "parking_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedestrian_position_estimates" ADD CONSTRAINT "pedestrian_position_estimates_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "pedestrian_navigation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
