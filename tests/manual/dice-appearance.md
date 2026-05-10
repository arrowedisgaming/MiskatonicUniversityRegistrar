# Manual smoke: dice settings popover

Run after changing dice prefs, overlay, or header dice control.

1. Click the **dice** icon in the header (desktop) or open the gear menu → **Dice rolls & look** (mobile). The **Dice rolls** dialog should open.
2. Set **Roll style** to **No dice**, Save — header icon should show the “off” slash; rolls should skip the 3D overlay.
3. Open again, set **3D dice**, pick **Starfield**, Save — reload, open popover — **Starfield** should still be selected (`localStorage` key `dice-appearance-v1`).
4. Open with the keyboard (Tab to the dice icon, Enter): focus should land inside the dialog, Tab should cycle within Save/Cancel/radios, Escape returns focus to the dice icon.
5. **Cancel** discards unsaved edits (change a control, Cancel, reopen — prior saved values).
6. Confirm 3D rolls still render with `/assets/dice-three/textures/` loading.
