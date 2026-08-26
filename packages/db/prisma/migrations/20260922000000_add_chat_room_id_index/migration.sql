-- CreateIndex
-- Board loads filter Chat by roomId and order by id; this was a seq scan.
CREATE INDEX "Chat_roomId_id_idx" ON "Chat"("roomId", "id");
