-- CreateIndex
-- Chat rows are replayed per room on every board load, filtered by roomId and
-- ordered by id. Postgres does not index foreign keys automatically, so this
-- path was a sequential scan. Composite so the ordering is served too.
CREATE INDEX "Chat_roomId_id_idx" ON "Chat"("roomId", "id");
