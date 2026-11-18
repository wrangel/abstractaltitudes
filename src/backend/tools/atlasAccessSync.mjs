// src/backend/tools/atlasAccessSync.mjs

// Command-line entry for atlasAccess.mjs. scripts/atlas-ip-sync.sh runs it
// hourly on the NAS, inside the backend container (host network, so it sees
// the NAS's public IP):
//
//   docker exec --env-file env.atlas abstractaltitudes-backend-1 \
//     node src/backend/tools/atlasAccessSync.mjs
//
// Needs ATLAS_PROJECT_ID, ATLAS_CLIENT_ID, ATLAS_CLIENT_SECRET (an Atlas
// service account with "Project Network Access Manager" on this project only).
// Prints one line; exits non-zero on any failure, so Task Scheduler emails.

import { syncAccessList } from "./atlasAccess.mjs";

try {
  const summary = await syncAccessList({
    fetch,
    projectId: process.env.ATLAS_PROJECT_ID,
    clientId: process.env.ATLAS_CLIENT_ID,
    clientSecret: process.env.ATLAS_CLIENT_SECRET,
    // Optional: the comment marking the managed entry, if not "Home (NAS + Mac)".
    comment: process.env.ATLAS_MANAGED_COMMENT || undefined,
  });
  console.log(summary);
} catch (error) {
  console.error(`Atlas access list sync failed: ${error.message}`);
  process.exitCode = 1;
}
