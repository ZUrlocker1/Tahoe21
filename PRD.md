# Tahoe21 Web PRD (Terse)

## 1. Product
Tahoe21 is a browser-based video blackjack game that keeps the Tahoe5 visual feel (retro casino table, large branded header, keyboard-first controls, compact status panel), but replaces poker mechanics with standard blackjack.

## 2. Goals
- Deliver a fast single-player blackjack loop for desktop and mobile web.
- Preserve Tahoe-style personality, look, and responsive layout.
- Keep code simple and deterministic enough for easy testing.

## 3. Non-Goals (MVP)
- No multiplayer.
- No real-money wagering.
- No account system, persistence, or backend.
- No side bets or advanced variants (e.g., surrender, insurance UI, split aces rulesets beyond MVP defaults).

## 4. Core Gameplay Rules (MVP Defaults)
- Deck model: 6-deck shoe, reshuffle at penetration threshold (e.g., ~75% consumed).
- Card values: 2-10 face value, J/Q/K = 10, Ace = 1 or 11.
- Blackjack: player two-card 21 pays 3:2.
- Dealer behavior: dealer stands on soft 17 (S17).
- Player actions: Hit, Stand, Double (on first two cards only), Split (one split max total; same-rank only; no resplit aces in MVP).
- Double after split: allowed.
- Split aces: one card drawn per ace, then hand auto-stands.
- Push: returns original bet.
- Bust: immediate hand loss.
- Insurance: not included in MVP.

## 5. Economy + Session Rules
- Starting bankroll: $90 (match Tahoe baseline feel).
- Bet step: $10; default bet $10; min $10; max constrained by bankroll and table limit.
- Round lifecycle:
  1. Place bet
  2. Initial deal (player/dealer)
  3. Player decisions per active hand
  4. Dealer resolves hand
  5. Payout and message
- If bankroll < minimum bet, trigger Tahoe-style bailout/loan flow consistent with Tahoe5 tone.

## 6. UX / UI Requirements
- Layout parity with Tahoe5 structure:
  - Top brand area with Tahoe21 logo and primary action button.
  - Central felt table area showing player and dealer cards.
  - Right-side rules/payout panel (replace poker paytable with blackjack rules/payouts).
  - Bottom status area for Bet, Balance, result text, and key hints.
- Controls:
  - Buttons: Deal, Hit, Stand, Double, Split, Bet +/-
  - Keyboard: Enter/Space = primary action, arrows for bet, H for help, S for sound, Esc reset
  - Touch-first targets for mobile portrait.
- Visual style:
  - Reuse Tahoe palette/typography treatment and existing card art style.
  - Preserve subtle motion/sfx cues for deal/win/loss.

## 7. Audio Direction
- Reuse Tahoe5-style sounds for:
  - Dealing cards
  - Bet up/down adjustments
  - Bailout/emergency-loan event
- Create more distinct blackjack outcome sounds than Tahoe5 for round results:
  - Loss/bust sound should be clearly different from win sounds.
  - Standard win and blackjack win should sound different from each other.
  - Blackjack or top-tier win should use a longer, more impressive "big win" cue than a standard win.
  - Push sound should be neutral/brief (not celebratory).
- Keep SFX short and arcade-like so rapid play stays responsive.
- Sound toggle behavior remains consistent with Tahoe5 (`Sound: On/Off` + keyboard shortcut).

## 8. Game State Model
- Phases: `PRE_DEAL`, `PLAYER_TURN`, `DEALER_TURN`, `ROUND_RESULT`.
- State includes:
  - `balance`, `bet`
  - `shoe`, `discard`, `dealerHand`
  - `playerHands[]`, `activeHandIndex`
  - `canDouble`, `canSplit`, `hasBlackjack`, `roundOutcome`
  - `soundOn`

## 9. Payout Rules
- Player blackjack (natural) wins 1.5x bet, unless dealer blackjack => push.
- Standard win pays 1:1.
- Push pays 0 (bet returned).
- Loss pays 0.

## 10. Accessibility + Quality Bar
- Full keyboard support for all actions.
- Clear action-disabled states (e.g., split unavailable).
- Readable contrast and responsive layout from 360px mobile width to desktop.
- Deterministic shuffle option (seed/dev mode) for testability.

## 11. Test Mode (Tahoe5-Style)
- Include a hidden dev/test toggle similar to Tahoe5 secret mode (keyboard shortcut, not visible in normal UI).
- Test mode allows forcing deterministic round setups to quickly validate edge cases:
  - Player blackjack
  - Dealer blackjack
  - Player bust
  - Push
  - Double-down win/loss
  - Split hand flow (including split aces behavior)
- Test mode bypasses normal shoe randomness only for the current forced scenario; returning to normal mode restores live shuffled play.
- Test mode must be clearly indicated in result/status text while active.
- Test mode is disabled by default per session but available in all builds via hidden shortcut.

## 12. Acceptance Criteria (MVP)
- Player can complete full blackjack rounds including blackjack, bust, push, double, and split paths.
- Payout math is correct across all MVP outcomes.
- No invalid action is executable in an incorrect phase.
- UI remains usable and legible on mobile portrait and desktop.
- Help/About dialogs reflect blackjack rules (not poker text).
- Audio mapping is correct: Tahoe5-style deal/bet/bailout sounds reused; win/loss outcome sounds are clearly differentiated.
