-- CreateEnum
CREATE TYPE "match_format" AS ENUM ('doubles', 'singles');

-- CreateEnum
CREATE TYPE "match_status" AS ENUM ('open', 'confirmed', 'in_progress', 'finished', 'cancelled');

-- CreateEnum
CREATE TYPE "player_status" AS ENUM ('pending', 'confirmed', 'rejected', 'removed');

-- CreateEnum
CREATE TYPE "team_side" AS ENUM ('team_a', 'team_b');

-- CreateEnum
CREATE TYPE "user_level" AS ENUM ('1ra', '2da', '3ra', '4ta', '5ta', '6ta', '7ma+');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('player', 'admin');

-- CreateEnum
CREATE TYPE "winner_team" AS ENUM ('team_a', 'team_b', 'draw');

-- CreateTable
CREATE TABLE "match_players" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "match_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "team" "team_side" NOT NULL DEFAULT 'team_a',
    "status" "player_status" NOT NULL DEFAULT 'pending',
    "joined_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "match_id" UUID NOT NULL,
    "registered_by" UUID NOT NULL,
    "score_team_a" VARCHAR(20) NOT NULL,
    "score_team_b" VARCHAR(20) NOT NULL,
    "winner" "winner_team" NOT NULL,
    "registered_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizer_id" UUID NOT NULL,
    "club" VARCHAR(200) NOT NULL,
    "format" "match_format" NOT NULL DEFAULT 'doubles',
    "status" "match_status" NOT NULL DEFAULT 'open',
    "match_date" DATE NOT NULL,
    "match_time" TIME(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mmr_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "mmr_before" INTEGER NOT NULL,
    "mmr_after" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL DEFAULT (mmr_after - mmr_before),
    "calculated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mmr_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token" VARCHAR(512) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rut" INTEGER NOT NULL,
    "dv_rut" CHAR(1) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "photo_url" VARCHAR(500),
    "level" "user_level" NOT NULL DEFAULT '3ra',
    "zone" VARCHAR(100) NOT NULL,
    "mmr" INTEGER NOT NULL DEFAULT 1000,
    "role" "user_role" NOT NULL DEFAULT 'player',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_match_players_match" ON "match_players"("match_id");

-- CreateIndex
CREATE INDEX "idx_match_players_status" ON "match_players"("status");

-- CreateIndex
CREATE INDEX "idx_match_players_user" ON "match_players"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_match_player" ON "match_players"("match_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_results_match_id_key" ON "match_results"("match_id");

-- CreateIndex
CREATE INDEX "idx_match_results_match" ON "match_results"("match_id");

-- CreateIndex
CREATE INDEX "idx_matches_date" ON "matches"("match_date");

-- CreateIndex
CREATE INDEX "idx_matches_organizer" ON "matches"("organizer_id");

-- CreateIndex
CREATE INDEX "idx_matches_status" ON "matches"("status");

-- CreateIndex
CREATE INDEX "idx_mmr_history_match" ON "mmr_history"("match_id");

-- CreateIndex
CREATE INDEX "idx_mmr_history_user" ON "mmr_history"("user_id", "calculated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_mmr_per_match_user" ON "mmr_history"("user_id", "match_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_exp" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "idx_users_active" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "idx_users_level" ON "users"("level");

-- CreateIndex
CREATE INDEX "idx_users_mmr" ON "users"("mmr" DESC);

-- CreateIndex
CREATE INDEX "idx_users_rut" ON "users"("rut");

-- CreateIndex
CREATE INDEX "idx_users_zone" ON "users"("zone");

-- CreateIndex
CREATE UNIQUE INDEX "uq_rut" ON "users"("rut", "dv_rut");

-- AddForeignKey
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_registered_by_fkey" FOREIGN KEY ("registered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mmr_history" ADD CONSTRAINT "mmr_history_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mmr_history" ADD CONSTRAINT "mmr_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
