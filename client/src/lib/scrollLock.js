// One shared lock on page scrolling. Several things lock it (the game frame,
// dialogs), and they can open and close in any order, so a plain save-and-
// restore of body.style.overflow can leave the page stuck on "hidden".
// This counts the locks and puts the original value back only when the last
// one is released.
let locks = 0;
let saved = "";

export function lockScroll() {
  if (locks === 0) {
    saved = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  locks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks -= 1;
    if (locks === 0) document.body.style.overflow = saved;
  };
}
