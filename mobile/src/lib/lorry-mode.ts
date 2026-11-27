/**
 * Lorry-only mode (branch elavarasan/mobile-lorry-flow).
 *
 * People at the mill found the full app hard to follow, so this build shows only the work done
 * at the gate, one screen at a time (the "Lorry In & Out" mockup):
 *   - Lorry In   (app/(app)/lorry-in.tsx)   lorry → people → check → unloading timer → measure logs
 *   - Lorry Out  (app/(app)/lorry-out.tsx)  lorry → pieces → check → sent to the owner
 *   - Measure Logs (the open loads, then the calculator)
 *
 * Everything else — sawing, stock, approvals, reports, money, users, the More menu and the bottom
 * bar — is hidden, not removed: the screens are still in the app, nothing links to them. The owner
 * approves on the web. Set this to false to bring the whole app back.
 */
export const LORRY_FLOW_ONLY = true;
