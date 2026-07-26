// Hand IGC files from the landing page into a freshly-created room. Files can't ride the
// router (they aren't serialisable), so the landing stashes them here, navigates to the new
// room, and Room takes them on mount → the upload panel opens pre-filled. One-shot.
let pending: File[] = [];

export function setPendingFiles(files: File[]): void {
  pending = files;
}

// Return the stashed files and clear them (so a later plain visit doesn't re-trigger upload).
export function takePendingFiles(): File[] {
  const p = pending;
  pending = [];
  return p;
}
