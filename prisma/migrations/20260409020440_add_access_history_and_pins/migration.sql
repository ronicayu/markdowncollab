-- CreateTable
CREATE TABLE "DocumentShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "shareToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentShare_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "snapshot" BLOB NOT NULL,
    "title" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdByName" TEXT,
    "type" TEXT NOT NULL DEFAULT 'auto',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentStar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280'
);

-- CreateTable
CREATE TABLE "DocumentTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CustomTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentTitle" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorId" TEXT,
    "message" TEXT NOT NULL,
    "snippet" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "events" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "remindAt" DATETIME NOT NULL,
    "message" TEXT NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Snippet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CustomCommand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DocumentReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Macro" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "documentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "digestFrequency" TEXT NOT NULL DEFAULT 'none',
    "keyboardOverrides" TEXT
);

-- CreateTable
CREATE TABLE "DocumentPin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pinnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DocumentSearchIndex" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "plainText" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

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
    "lockedBy" TEXT,
    "lockedAt" DATETIME,
    "forkedFrom" TEXT,
    "password" TEXT,
    "coverImage" TEXT,
    "fontFamily" TEXT,
    "maxVersions" INTEGER NOT NULL DEFAULT 50,
    "publishAt" DATETIME,
    "expiresAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Document" ("createdAt", "id", "title", "updatedAt") SELECT "createdAt", "id", "title", "updatedAt" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "DocumentShare_shareToken_key" ON "DocumentShare"("shareToken");

-- CreateIndex
CREATE INDEX "DocumentShare_shareToken_idx" ON "DocumentShare"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentShare_documentId_userId_key" ON "DocumentShare"("documentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentShare_documentId_email_key" ON "DocumentShare"("documentId", "email");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_createdAt_idx" ON "DocumentVersion"("documentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentStar_documentId_userId_key" ON "DocumentStar"("documentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "DocumentTag_documentId_idx" ON "DocumentTag"("documentId");

-- CreateIndex
CREATE INDEX "DocumentTag_tagId_idx" ON "DocumentTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTag_documentId_tagId_key" ON "DocumentTag"("documentId", "tagId");

-- CreateIndex
CREATE INDEX "Folder_ownerId_parentId_idx" ON "Folder"("ownerId", "parentId");

-- CreateIndex
CREATE INDEX "CustomTemplate_ownerId_idx" ON "CustomTemplate"("ownerId");

-- CreateIndex
CREATE INDEX "ActivityLog_documentId_createdAt_idx" ON "ActivityLog"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Webhook_ownerId_idx" ON "Webhook"("ownerId");

-- CreateIndex
CREATE INDEX "Reminder_userId_dismissed_remindAt_idx" ON "Reminder"("userId", "dismissed", "remindAt");

-- CreateIndex
CREATE INDEX "Snippet_ownerId_idx" ON "Snippet"("ownerId");

-- CreateIndex
CREATE INDEX "CustomCommand_ownerId_idx" ON "CustomCommand"("ownerId");

-- CreateIndex
CREATE INDEX "Rating_documentId_idx" ON "Rating"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_documentId_userId_key" ON "Rating"("documentId", "userId");

-- CreateIndex
CREATE INDEX "DocumentReaction_documentId_idx" ON "DocumentReaction"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentReaction_documentId_userId_emoji_key" ON "DocumentReaction"("documentId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "Macro_ownerId_idx" ON "Macro"("ownerId");

-- CreateIndex
CREATE INDEX "Macro_documentId_idx" ON "Macro"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Macro_ownerId_name_key" ON "Macro"("ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "DocumentPin_userId_pinnedAt_idx" ON "DocumentPin"("userId", "pinnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPin_documentId_userId_key" ON "DocumentPin"("documentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSearchIndex_documentId_key" ON "DocumentSearchIndex"("documentId");

-- CreateIndex
CREATE INDEX "DocumentSearchIndex_documentId_idx" ON "DocumentSearchIndex"("documentId");
