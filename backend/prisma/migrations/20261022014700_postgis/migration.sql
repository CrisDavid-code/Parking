-- PostGIS: spatial columns derived from lat/lng so Prisma keeps plain Float fields
-- (NULL lat/lng -> NULL point) while spatial queries (nearby buildings, geofence checks) use GIST indexes.
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE "parking_sessions" ADD COLUMN "geog" geography(Point, 4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED;
CREATE INDEX "parking_sessions_geog_idx" ON "parking_sessions" USING GIST ("geog");

ALTER TABLE "location_events" ADD COLUMN "geog" geography(Point, 4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED;
CREATE INDEX "location_events_geog_idx" ON "location_events" USING GIST ("geog");

ALTER TABLE "buildings" ADD COLUMN "geog" geography(Point, 4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED;
CREATE INDEX "buildings_geog_idx" ON "buildings" USING GIST ("geog");

ALTER TABLE "geofences" ADD COLUMN "geog" geography(Point, 4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography) STORED;
CREATE INDEX "geofences_geog_idx" ON "geofences" USING GIST ("geog");

-- Integrity constraints Prisma can't express
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_lat_chk" CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
ALTER TABLE "parking_sessions" ADD CONSTRAINT "parking_sessions_lng_chk" CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
ALTER TABLE "location_events" ADD CONSTRAINT "location_events_lat_chk" CHECK (latitude BETWEEN -90 AND 90);
ALTER TABLE "location_events" ADD CONSTRAINT "location_events_lng_chk" CHECK (longitude BETWEEN -180 AND 180);
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_radius_chk" CHECK (radius_meters > 0 AND radius_meters <= 100000);
ALTER TABLE "navigation_edges" ADD CONSTRAINT "navigation_edges_distance_chk" CHECK (distance_meters >= 0);
ALTER TABLE "navigation_edges" ADD CONSTRAINT "navigation_edges_not_self_chk" CHECK (from_node_id <> to_node_id);
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_owner_chk" CHECK ((user_id IS NULL) <> (organization_id IS NULL));
-- One active parking session per vehicle
CREATE UNIQUE INDEX "parking_sessions_one_active_per_vehicle" ON "parking_sessions" ("vehicle_id") WHERE status = 'active';
