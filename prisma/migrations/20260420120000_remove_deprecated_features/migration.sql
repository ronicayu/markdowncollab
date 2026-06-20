-- Back up data before destructive drops. Backup tables are named _backup_*
-- and retained for manual recovery. They are NOT in the Prisma schema.
CREATE TABLE IF NOT EXISTS "_backup_Reminder" AS SELECT * FROM "Reminder";
CREATE TABLE IF NOT EXISTS "_backup_Snippet" AS SELECT * FROM "Snippet";
CREATE TABLE IF NOT EXISTS "_backup_CustomCommand" AS SELECT * FROM "CustomCommand";
CREATE TABLE IF NOT EXISTS "_backup_Rating" AS SELECT * FROM "Rating";
CREATE TABLE IF NOT EXISTS "_backup_DocumentReaction" AS SELECT * FROM "DocumentReaction";
CREATE TABLE IF NOT EXISTS "_backup_Macro" AS SELECT * FROM "Macro";
CREATE TABLE IF NOT EXISTS "_backup_DocumentPin" AS SELECT * FROM "DocumentPin";
CREATE TABLE IF NOT EXISTS "_backup_Document_deprecated_columns" AS
  SELECT "id", "lockedBy", "lockedAt", "fontFamily" FROM "Document"
  WHERE "lockedBy" IS NOT NULL OR "lockedAt" IS NOT NULL OR "fontFamily" IS NOT NULL;

-- DropIndex
DROP INDEX "CustomCommand_ownerId_idx";

-- DropIndex
DROP INDEX "DocumentPin_documentId_userId_key";

-- DropIndex
DROP INDEX "DocumentPin_userId_pinnedAt_idx";

-- DropIndex
DROP INDEX "DocumentReaction_documentId_userId_emoji_key";

-- DropIndex
DROP INDEX "DocumentReaction_documentId_idx";

-- DropIndex
DROP INDEX "Macro_ownerId_name_key";

-- DropIndex
DROP INDEX "Macro_documentId_idx";

-- DropIndex
DROP INDEX "Macro_ownerId_idx";

-- DropIndex
DROP INDEX "Rating_documentId_userId_key";

-- DropIndex
DROP INDEX "Rating_documentId_idx";

-- DropIndex
DROP INDEX "Reminder_userId_dismissed_remindAt_idx";

-- DropIndex
DROP INDEX "Snippet_ownerId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CustomCommand";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DocumentPin";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DocumentReaction";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Macro";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Rating";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Reminder";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Snippet";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "ownerId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "templateId" TEXT,
    "folderId" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "forkedFrom" TEXT,
    "password" TEXT,
    "coverImage" TEXT,
    "maxVersions" INTEGER NOT NULL DEFAULT 50,
    "publishAt" DATETIME,
    "expiresAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Document" ("approvedAt", "approvedBy", "coverImage", "createdAt", "deletedAt", "expiresAt", "folderId", "forkedFrom", "id", "maxVersions", "ownerId", "password", "publishAt", "status", "templateId", "title", "updatedAt", "viewCount", "visibility") SELECT "approvedAt", "approvedBy", "coverImage", "createdAt", "deletedAt", "expiresAt", "folderId", "forkedFrom", "id", "maxVersions", "ownerId", "password", "publishAt", "status", "templateId", "title", "updatedAt", "viewCount", "visibility" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

