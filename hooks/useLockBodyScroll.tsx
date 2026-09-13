import { useEffect } from "react";

// Module-level so nested/overlapping locks (e.g. a game preview modal
// handing off to a game session mid-exit-animation) share one counter
// instead of each guessing the body's "original" overflow independently —
// whichever lock captured the value while another lock was still active
// would otherwise restore the page into a permanently non-scrollable state.
let lockCount = 0;
let originalOverflow = "";

export function useLockBodyScroll(isLocked: boolean) {
    useEffect(() => {
        if (!isLocked) return;

        if (lockCount === 0) {
            originalOverflow = document.body.style.overflow;
        }
        lockCount++;
        document.body.style.overflow = "hidden";

        return () => {
            lockCount--;
            if (lockCount === 0) {
                document.body.style.overflow = originalOverflow;
            }
        };
    }, [isLocked]);
}
