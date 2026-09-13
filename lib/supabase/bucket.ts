// lib/supabase/bucket.ts
//
// The one bucket everything on the site lives in. Its own dependency-free
// module because both halves of the upload story need it — storage.ts
// (server, service-role, now also imports sharp for image compression) and
// browser-storage.ts (client, anon key). Having the browser half import it
// from storage.ts used to be fine; once storage.ts pulled in sharp, that
// import dragged a Node-only native module into the client bundle and the
// build failed on `node:events`.
export const BUCKET = "scriptovernovel.music-artworks";
