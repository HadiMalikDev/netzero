-- Default workspace + solo admin (password: netzero). Replace via AUTH_* / db:seed later.
INSERT INTO "workspace" ("id", "name")
VALUES ('ws_default', 'NetZero Workspace')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "app_user" ("id", "workspace_id", "email", "name", "password_hash")
VALUES (
	'user_solo',
	'ws_default',
	'admin@netzero.local',
	'Admin',
	'c662e1006da4a354be1e1583d1036224:b1944bb0403e585d8cefbde7c23931ecc28b33433ce962348a7dd9ed63f5b1c7406fdb8675fe4be972a8d4479ff7daad8af7fd07e514eb519fe8804baa8d5ffc'
)
ON CONFLICT ("id") DO NOTHING;
