-- Every Chat row today is a board event; there is no chat UI yet.
-- The LIKE guard leaves anything unrecognised in Chat rather than moving it.

INSERT INTO "BoardEvent" ("roomId", "userId", "kind", "payload", "createdAt")
SELECT
    c."roomId",
    c."userId",
    CASE WHEN c."message" LIKE '%"erase"%' THEN 'shape_erase' ELSE 'shape_upsert' END,
    c."message",
    c."createdAt"
FROM "Chat" c
WHERE c."userId" IS NOT NULL
  AND (c."message" LIKE '%"shape"%' OR c."message" LIKE '%"erase"%')
ORDER BY c."id";

DELETE FROM "Chat"
WHERE "message" LIKE '%"shape"%' OR "message" LIKE '%"erase"%';
