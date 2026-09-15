/**
 * Is this page inside a social app's in-app browser (Facebook, Messenger,
 * Instagram, …) rather than the phone's real browser?
 *
 * Those are WebViews with two gaps that matter to the museum and that no
 * page can work around:
 *
 *   - No WebXR (`navigator.xr` is undefined), so VR Mode's support check
 *     fails and the row would simply vanish from the View dropdown.
 *   - `<a download>` with a `blob:` URL is swallowed silently — the Share
 *     360° modal's Download button "works" (the click fires, the toast
 *     shows) but nothing lands in the camera roll. The Web Share API is
 *     usually missing there too, so there is no other way to hand the
 *     file over from inside the WebView.
 *
 * The only fix for both is the visitor's own "Open in browser" menu item,
 * so the UI's job is to say that rather than look broken. UA sniffing is
 * the only signal an in-app browser gives — the tokens below are the ones
 * Facebook (FBAN/FBAV on iOS, FB_IAB on Android), Messenger, Instagram,
 * and a few others put in their UA strings. A miss just means the normal
 * UI, which is the right failure.
 */
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|Line\/|MicroMessenger|Twitter|TikTok|Snapchat/i.test(ua);
}
