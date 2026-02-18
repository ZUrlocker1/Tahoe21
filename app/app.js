"use strict";

const APP_VERSION = "0.8";
const MIN_BET = 10;
const BET_STEP = 10;
const START_BALANCE = 90;
const TABLE_MAX = 500;
const SHOE_DECKS = 6;
const DEALER_REVEAL_STEP_MS = 400;
const SPLIT_DEAL_STEP_MS = 620;
const KEY_HINT_TEXT = "Hit = Space, Stand = Enter, D = Double, T = Split, Esc = Reset.";
const HAND_TOTAL_PREFIX = "\u00A0\u00A0";

const PAYTABLE = [
  { name: "Blackjack", value: "3:2" },
  { name: "Regular Win", value: "1:1" },
  { name: "Push", value: "Bet back" },
  { name: "Dealer stands on soft 17.", value: "" },
];

const SUITS = ["C", "D", "H", "S"];
const SUIT_SYMBOL = { C: "♣", D: "♦", H: "♥", S: "♠" };
const RANK_TEXT = {
  1: "A",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
};

const COURT_IMAGE = {
  11: "./assets/jack.jpg?v=1.2.2",
  12: "./assets/queen.jpg?v=1.2.2",
  13: "./assets/king.jpg?v=1.2.2",
};

const TAUNTS = [
  "House credit approved. Try not to need another one.",
  "Emergency bankroll unlocked. Use it wisely.",
  "The pit boss is side-eyeing this run.",
  "Loan issued. Maybe stand more, hit less.",
  "Credit line reopened. No judgment. Some judgment.",
];

const TEST_SCENARIOS = [
  {
    name: "Split Aces",
    deck: ["AH", "9C", "AD", "7D", "9S", "8H", "KH"],
    note: "Split aces scenario where dealer should bust.",
  },
  {
    name: "Low Cards",
    deck: [
      "2H",
      "TC",
      "2D",
      "9S",
      "2C",
      "2S",
      "3C",
      "3D",
      "3H",
      "3S",
      "4C",
      "4D",
      "4H",
      "4S",
      "5C",
      "5D",
      "5H",
      "5S",
      "6C",
      "6D",
      "6H",
      "6S",
      "7C",
      "7D",
      "7H",
      "7S",
    ],
    note: "Low cards to test card fanning layout.",
  },
  {
    name: "Player Blackjack",
    deck: ["AS", "9C", "KH", "7D", "5S", "6H"],
    note: "Natural blackjack should pay 3:2.",
  },
  {
    name: "Split Eights",
    deck: ["8H", "9C", "8D", "7S", "TH", "9D", "KC"],
    note: "Split eights scenario where dealer should bust.",
  },
  {
    name: "Double Win",
    deck: ["5H", "TC", "6D", "6S", "TD", "8C"],
    note: "Double on 11 for a likely winning hand.",
  },
  {
    name: "Player Twenty Win",
    deck: ["TH", "6C", "QH", "9D", "8S", "2C"],
    note: "High total non-blackjack win path.",
  },
  {
    name: "Player Bust",
    deck: ["TH", "9C", "7S", "6D", "9H"],
    note: "Hit once on 17 to force bust path.",
  },
  {
    name: "Push",
    deck: ["TS", "9C", "7H", "8D", "2C", "3D"],
    note: "Stand on 17 for push vs dealer 17.",
  },
  {
    name: "Dealer Blackjack",
    deck: ["TH", "AC", "9S", "KD", "5C"],
    note: "Dealer natural should beat non-natural 21.",
  },
  {
    name: "Double Loss",
    deck: ["9H", "TS", "2D", "7C", "2S"],
    note: "Double path with losing result.",
  },
];

const state = {
  phase: "PRE_DEAL",
  soundOn: true,
  balance: START_BALANCE,
  bet: MIN_BET,
  shoe: [],
  shoePos: 0,
  cutCard: 0,
  dealerHand: [],
  dealerHoleHidden: true,
  playerHands: [],
  activeHandIndex: 0,
  testMode: false,
  testScenarioIndex: 0,
  testScenarioLabel: "",
  testScenarioNote: "",
  testRoundDeck: null,
  testRoundPos: 0,
  resultTone: "",
  resultMain: "Press Deal to start.",
  resultSub: KEY_HINT_TEXT,
  dealRevealPlayer: [false, false],
  dealRevealDealer: [false, false],
};

const el = {
  brandLogo: document.querySelector(".brand-logo"),
  dealerHand: document.getElementById("dealerHand"),
  dealerTotal: document.getElementById("dealerTotal"),
  playerHands: document.getElementById("playerHands"),
  playerTotal: document.getElementById("playerTotal"),
  paytableList: document.getElementById("paytableList"),
  betValue: document.getElementById("betValue"),
  balanceValue: document.getElementById("balanceValue"),
  resultLine: document.getElementById("resultLine"),
  subLine: document.getElementById("subLine"),
  dealDrawBtn: document.getElementById("dealDrawBtn"),
  betUpBtn: document.getElementById("betUpBtn"),
  betDownBtn: document.getElementById("betDownBtn"),
  hitBtn: document.getElementById("hitBtn"),
  standBtn: document.getElementById("standBtn"),
  doubleBtn: document.getElementById("doubleBtn"),
  splitBtn: document.getElementById("splitBtn"),
  aboutBtn: document.getElementById("aboutBtn"),
  helpBtn: document.getElementById("helpBtn"),
  soundBtn: document.getElementById("soundBtn"),
  aboutDialog: document.getElementById("aboutDialog"),
  helpDialog: document.getElementById("helpDialog"),
  versionTag: document.getElementById("versionTag"),
};

let audioContext;
let dealTimers = [];

function clearDealTimers() {
  for (const t of dealTimers) clearTimeout(t);
  dealTimers = [];
}

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function playTone(freq, duration, type = "triangle", volume = 0.05) {
  if (!state.soundOn) return;
  const ctx = ensureAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  setTimeout(() => osc.stop(), duration);
}

function playSlide(startFreq, endFreq, duration, type = "sawtooth", volume = 0.055) {
  if (!state.soundOn) return;
  const ctx = ensureAudioContext();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.linearRampToValueAtTime(endFreq, now + duration / 1000);
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration / 1000);
}

function playSequence(sequence, gap = 25) {
  if (!state.soundOn) return;
  let delay = 0;
  for (const note of sequence) {
    setTimeout(() => playTone(note.f, note.d, note.t || "triangle", note.v || 0.05), delay);
    delay += note.d + gap;
  }
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function playChord(freqs, duration = 120, type = "triangle", volume = 0.024) {
  if (!state.soundOn) return;
  for (const f of freqs) {
    playTone(f, duration, type, volume);
  }
}

function startupSound() {
  playSequence([
    { f: 262, d: 90 },
    { f: 330, d: 90 },
    { f: 392, d: 100 },
    { f: 523, d: 130 },
  ]);
}

function splitModeSound() {
  playSequence([
    { f: 392, d: 75, t: "triangle", v: 0.05 },
    { f: 523, d: 85, t: "triangle", v: 0.052 },
    { f: 659, d: 120, t: "triangle", v: 0.055 },
  ], 22);
}

function cardFlipSound() {
  if (!state.soundOn) return;
  playSlide(700, 600, 85, "sine", 0.018);
  setTimeout(() => playTone(640, 22, "sine", 0.014), 32);
}

function hiBeep() {
  playTone(262, 22, "triangle", 0.04);
}

function invalidBeep() {
  playTone(131, 55, "square", 0.045);
}

function lowBeep() {
  playTone(175, 70, "square", 0.04);
}

function emergencyLoanSound() {
  if (!state.soundOn) return;
  playSlide(420, 320, 180);
  setTimeout(() => playSlide(360, 250, 200), 140);
  setTimeout(() => playSlide(300, 180, 240), 310);
}

function pushSound() {
  const patterns = [
    [{ f: 392, d: 65, t: "sine", v: 0.032 }, { f: 392, d: 65, t: "sine", v: 0.032 }],
    [{ f: 440, d: 55, t: "sine", v: 0.03 }, { f: 392, d: 70, t: "sine", v: 0.03 }],
    [{ f: 349, d: 58, t: "triangle", v: 0.03 }, { f: 392, d: 58, t: "triangle", v: 0.03 }],
  ];
  playSequence(randomItem(patterns), 20);
}

function winningSound() {
  const variants = [
    [{ f: 523, d: 75 }, { f: 659, d: 75 }, { f: 784, d: 110 }, { f: 988, d: 140 }],
    [{ f: 494, d: 70 }, { f: 587, d: 75 }, { f: 740, d: 95 }, { f: 880, d: 145 }],
    [{ f: 523, d: 65 }, { f: 659, d: 70 }, { f: 523, d: 65 }, { f: 784, d: 150 }],
    [{ f: 587, d: 68 }, { f: 698, d: 72 }, { f: 880, d: 110 }, { f: 1047, d: 130 }],
  ];
  const selected = randomItem(variants);
  playSequence(selected, 18);
  setTimeout(() => playChord([selected[2].f, selected[3].f], 100, "sine", 0.017), 110);
}

function bigWinningSound() {
  const fanfares = [
    [
      { f: 523, d: 70, t: "triangle", v: 0.06 },
      { f: 659, d: 80, t: "triangle", v: 0.06 },
      { f: 784, d: 95, t: "triangle", v: 0.062 },
      { f: 988, d: 110, t: "triangle", v: 0.065 },
      { f: 1175, d: 140, t: "triangle", v: 0.07 },
      { f: 1318, d: 180, t: "triangle", v: 0.072 },
      { f: 1568, d: 280, t: "triangle", v: 0.076 },
    ],
    [
      { f: 494, d: 65, t: "square", v: 0.05 },
      { f: 587, d: 72, t: "triangle", v: 0.058 },
      { f: 740, d: 88, t: "triangle", v: 0.06 },
      { f: 988, d: 105, t: "triangle", v: 0.064 },
      { f: 1245, d: 140, t: "triangle", v: 0.07 },
      { f: 1480, d: 170, t: "triangle", v: 0.073 },
      { f: 1760, d: 300, t: "triangle", v: 0.078 },
    ],
    [
      { f: 523, d: 55, t: "triangle", v: 0.058 },
      { f: 659, d: 65, t: "triangle", v: 0.058 },
      { f: 784, d: 75, t: "triangle", v: 0.06 },
      { f: 659, d: 70, t: "triangle", v: 0.06 },
      { f: 988, d: 115, t: "triangle", v: 0.065 },
      { f: 1318, d: 165, t: "triangle", v: 0.072 },
      { f: 1568, d: 320, t: "triangle", v: 0.08 },
    ],
  ];
  const chosen = randomItem(fanfares);
  playSequence(chosen, 20);
  setTimeout(() => playChord([784, 988, 1318], 140, "sine", 0.017), 170);
  setTimeout(() => playSlide(900, 1300, 150, "triangle", 0.02), 360);
}

function losingHandSound() {
  const variants = [
    [
      { f: 392, d: 105, t: "sawtooth", v: 0.04 },
      { f: 330, d: 110, t: "sawtooth", v: 0.04 },
      { f: 247, d: 140, t: "square", v: 0.045 },
      { f: 185, d: 220, t: "square", v: 0.05 },
    ],
    [
      { f: 349, d: 95, t: "square", v: 0.04 },
      { f: 294, d: 110, t: "square", v: 0.044 },
      { f: 233, d: 120, t: "sawtooth", v: 0.047 },
      { f: 175, d: 240, t: "sawtooth", v: 0.05 },
    ],
    [
      { f: 392, d: 70, t: "triangle", v: 0.034 },
      { f: 311, d: 85, t: "square", v: 0.043 },
      { f: 262, d: 110, t: "square", v: 0.046 },
      { f: 196, d: 210, t: "sawtooth", v: 0.05 },
    ],
  ];
  playSequence(randomItem(variants), 17);
  setTimeout(() => playSlide(230, 160, 180, "square", 0.028), 210);
}

function formatCash(v) {
  return `$${v}`;
}

function formatSigned(v) {
  if (v > 0) return `+$${v}`;
  if (v < 0) return `-$${Math.abs(v)}`;
  return "$0";
}

function buildFreshShoe() {
  const shoe = [];
  for (let deckNum = 0; deckNum < SHOE_DECKS; deckNum += 1) {
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank += 1) {
        shoe.push({ rank, suit });
      }
    }
  }
  shuffleDeck(shoe);
  state.shoe = shoe;
  state.shoePos = 0;
  state.cutCard = Math.floor(shoe.length * 0.75);
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function parseCard(code) {
  const suit = code.slice(-1).toUpperCase();
  const rankCode = code.slice(0, -1).toUpperCase();
  const rankMap = { A: 1, J: 11, Q: 12, K: 13, T: 10 };
  const rank = rankMap[rankCode] || Number(rankCode);
  return { rank, suit };
}

function isCompactLayout() {
  return window.matchMedia("(max-width: 900px), (orientation: portrait)").matches;
}

function queueScenarioDeck() {
  const scenario = TEST_SCENARIOS[state.testScenarioIndex % TEST_SCENARIOS.length];
  state.testScenarioIndex += 1;
  state.testScenarioLabel = scenario.name;
  state.testScenarioNote = scenario.note;
  state.testRoundDeck = scenario.deck.map(parseCard);
  state.testRoundPos = 0;
}

function drawCard() {
  if (state.testRoundDeck && state.testRoundPos < state.testRoundDeck.length) {
    const card = state.testRoundDeck[state.testRoundPos];
    state.testRoundPos += 1;
    return card;
  }
  if (!state.shoe.length || state.shoePos >= state.shoe.length) {
    buildFreshShoe();
  }
  const card = state.shoe[state.shoePos];
  state.shoePos += 1;
  return card;
}

function needsReshuffleSoon() {
  return state.shoePos >= state.cutCard;
}

function handValue(cards) {
  let hard = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === 1) {
      aces += 1;
      hard += 1;
    } else if (card.rank >= 10) {
      hard += 10;
    } else {
      hard += card.rank;
    }
  }
  let best = hard;
  while (aces > 0 && best + 10 <= 21) {
    best += 10;
    aces -= 1;
  }
  const isSoft = best !== hard;
  const isBust = best > 21;
  const isBlackjack = cards.length === 2 && best === 21;
  return { hard, best, isSoft, isBust, isBlackjack };
}

function cardColorClass(card) {
  return card && (card.suit === "D" || card.suit === "H") ? " red" : "";
}

function pipPattern(rank) {
  const layouts = {
    1: [[3, 2]],
    2: [[1, 2], [5, 2]],
    3: [[1, 2], [3, 2], [5, 2]],
    4: [[1, 1], [1, 3], [5, 1], [5, 3]],
    5: [[1, 1], [1, 3], [3, 2], [5, 1], [5, 3]],
    6: [[1, 1], [1, 3], [3, 1], [3, 3], [5, 1], [5, 3]],
    7: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3], [5, 1], [5, 3]],
    8: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3], [4, 2], [5, 1], [5, 3]],
    9: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 2], [3, 3], [4, 2], [5, 1], [5, 3]],
    10: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3], [4, 1], [4, 3], [5, 1], [5, 3]],
  };
  return layouts[rank] || [[3, 2]];
}

function renderPipBody(card) {
  const pips = pipPattern(card.rank);
  const symbol = SUIT_SYMBOL[card.suit];
  const pipNodes = pips
    .map(([row, col]) => {
      const invertClass = row >= 4 ? " invert" : "";
      return `<span class="pip${invertClass}" style="grid-row:${row};grid-column:${col};">${symbol}</span>`;
    })
    .join("");
  return `<div class="pip-field">${pipNodes}</div>`;
}

function renderCourtBody(card) {
  const rank = RANK_TEXT[card.rank];
  const label = `${rank} of ${card.suit}`;
  const src = COURT_IMAGE[card.rank];
  return `<div class="court-wrap"><img class="court-img" src="${src}" alt="${label}" /></div>`;
}

function renderAceBody(card) {
  const logoSrc = card.suit === "S" || card.suit === "C" ? "./assets/tahoe-21-logo-bw.png" : "./assets/tahoe-21-logo.png";
  return `
    <div class="ace-art">
      <img class="ace-logo ace-logo-center" src="${logoSrc}" alt="" aria-hidden="true" />
    </div>
  `;
}

function renderCardInner(card) {
  if (!card) {
    return '<div class="card-back" aria-hidden="true"></div>';
  }
  const isFace = card.rank === 1 || card.rank >= 11;
  const isAce = card.rank === 1;
  const cornerTop = isFace
    ? `<div class="card-corner top"><span class="rank">${RANK_TEXT[card.rank]}</span><span class="suit">${SUIT_SYMBOL[card.suit]}</span></div>`
    : `<div class="card-corner top"><span class="rank">${RANK_TEXT[card.rank]}</span></div>`;
  const cornerBottom = isFace
    ? `<div class="card-corner bottom"><span class="rank">${RANK_TEXT[card.rank]}</span><span class="suit">${SUIT_SYMBOL[card.suit]}</span></div>`
    : `<div class="card-corner bottom"><span class="rank">${RANK_TEXT[card.rank]}</span></div>`;
  const center = isAce ? renderAceBody(card) : card.rank >= 11 ? renderCourtBody(card) : renderPipBody(card);
  return `${cornerTop}<div class="card-body">${center}</div>${cornerBottom}`;
}

function renderCardSlot(card, isHidden = false) {
  const slot = document.createElement("div");
  slot.className = `card-slot${isHidden ? "" : cardColorClass(card)}`;
  slot.innerHTML = isHidden ? renderCardInner(null) : renderCardInner(card);
  return slot;
}

function setResult(main, sub, toneClass = "") {
  state.resultMain = main;
  state.resultSub = sub;
  state.resultTone = toneClass;
  el.resultLine.textContent = main;
  el.resultLine.classList.remove("is-win", "is-loss", "is-neutral", "is-split");
  if (toneClass) el.resultLine.classList.add(toneClass);
  el.subLine.textContent = sub;
}

function createHand(cards = [], bet = state.bet, splitAces = false) {
  return {
    cards,
    bet,
    splitAces,
    doubled: false,
    pendingDouble: false,
    done: false,
    result: "",
  };
}

function currentHand() {
  return state.playerHands[state.activeHandIndex] || null;
}

function canHit() {
  const hand = currentHand();
  return state.phase === "PLAYER_TURN" && hand && !hand.done;
}

function canStand() {
  const hand = currentHand();
  return state.phase === "PLAYER_TURN" && hand && !hand.done && !hand.pendingDouble;
}

function canDouble() {
  const hand = currentHand();
  return (
    state.phase === "PLAYER_TURN" &&
    hand &&
    !hand.done &&
    hand.cards.length === 2 &&
    !hand.doubled &&
    !hand.pendingDouble &&
    state.balance >= hand.bet
  );
}

function canSplit() {
  const hand = currentHand();
  return (
    state.phase === "PLAYER_TURN" &&
    hand &&
    !hand.done &&
    state.playerHands.length === 1 &&
    hand.cards.length === 2 &&
    hand.cards[0].rank === hand.cards[1].rank &&
    !hand.pendingDouble &&
    state.balance >= hand.bet
  );
}

function turnHintText() {
  if (state.testMode) {
    if (state.testScenarioLabel === "Low Cards") {
      return "Test: Low cards to test card fanning layout.";
    }
    return `Test: ${state.testScenarioLabel}. ${state.testScenarioNote}`;
  }
  return KEY_HINT_TEXT;
}

function inHandHintText() {
  const isSecondSplitHand = state.playerHands.length > 1 && state.activeHandIndex === 1 && state.phase === "PLAYER_TURN";
  if (isCompactLayout()) {
    if (isSecondSplitHand) return "Hit, Stand or Double?";
    return canDouble() ? "Hit, Stand or Double?" : "Hit or Stand?";
  }
  if (isSecondSplitHand) return "Hit = Space, Stand = Enter, D = Double.";
  return canDouble() ? KEY_HINT_TEXT : "Hit = Space, Stand = Enter, Esc = Reset.";
}

function showTurnPrompt(defaultText = "Your move.") {
  if (canSplit()) {
    const splitText = isCompactLayout() ? "Split available: create two hands." : "Split available: create two hands (adds one matching bet).";
    setResult(splitText, inHandHintText(), "is-split");
  } else {
    setResult(defaultText, inHandHintText());
  }
}

function settleInitialBlackjack() {
  const hand = state.playerHands[0];
  const playerEval = handValue(hand.cards);
  const dealerEval = handValue(state.dealerHand);
  clearDealTimers();
  state.phase = "DEALER_TURN";
  setResult("Dealer check...", "Revealing cards.");
  renderAll();

  const resolveOutcome = () => {
    if (playerEval.isBlackjack && dealerEval.isBlackjack) {
      state.balance += hand.bet;
      pushSound();
      setResult("Push. Both have blackjack.", `Net ${formatSigned(0)}. Press Next Hand.`, "is-neutral");
    } else if (playerEval.isBlackjack) {
      const payout = Math.round(hand.bet * 2.5);
      const profit = payout - hand.bet;
      state.balance += payout;
      bigWinningSound();
      setResult(
        `Blackjack! You win ${formatCash(profit)}.`,
        `Paid 3:2. Net ${formatSigned(profit)}. Press Next Hand.`,
        "is-win"
      );
    } else {
      losingHandSound();
      setResult(
        "Dealer blackjack.",
        `You lose ${formatCash(hand.bet)}. Net ${formatSigned(-hand.bet)}. Press Next Hand.`,
        "is-loss"
      );
    }

    state.phase = "ROUND_RESULT";
    renderAll();
  };

  if (state.dealerHoleHidden) {
    const revealTimer = setTimeout(() => {
      state.dealerHoleHidden = false;
      cardFlipSound();
      renderAll();
      const postRevealTimer = setTimeout(resolveOutcome, DEALER_REVEAL_STEP_MS);
      dealTimers.push(postRevealTimer);
    }, DEALER_REVEAL_STEP_MS);
    dealTimers.push(revealTimer);
  } else {
    state.dealerHoleHidden = false;
    renderAll();
    const postRevealTimer = setTimeout(resolveOutcome, DEALER_REVEAL_STEP_MS);
    dealTimers.push(postRevealTimer);
  }
}

function completeInitialDeal() {
  const hand = state.playerHands[0];
  const playerEval = handValue(hand.cards);
  const dealerEval = handValue(state.dealerHand);

  if (playerEval.isBlackjack || dealerEval.isBlackjack) {
    settleInitialBlackjack();
  } else {
    state.phase = "PLAYER_TURN";
    showTurnPrompt("Your move.");
  }

  renderAll();
}

function startRound() {
  if (!(state.phase === "PRE_DEAL" || state.phase === "ROUND_RESULT")) return;
  clearDealTimers();

  if (state.balance < MIN_BET) {
    state.balance += 100;
    emergencyLoanSound();
    setResult("Emergency loan +$100.", TAUNTS[Math.floor(Math.random() * TAUNTS.length)], "is-loss");
  }

  if (state.bet > state.balance) {
    state.bet = Math.max(MIN_BET, Math.min(TABLE_MAX, state.balance - (state.balance % BET_STEP)));
  }

  if (state.balance < state.bet || state.bet < MIN_BET) {
    invalidBeep();
    return;
  }

  if (needsReshuffleSoon()) {
    buildFreshShoe();
  }

  if (state.testMode) {
    queueScenarioDeck();
  } else {
    state.testRoundDeck = null;
    state.testRoundPos = 0;
    state.testScenarioLabel = "";
    state.testScenarioNote = "";
  }

  const p1 = drawCard();
  const d1 = drawCard();
  const p2 = drawCard();
  const d2 = drawCard();

  state.balance -= state.bet;
  state.dealerHand = [d1, d2];
  state.playerHands = [createHand([p1, p2], state.bet, false)];
  state.activeHandIndex = 0;
  state.dealerHoleHidden = true;
  state.phase = "DEALING";
  state.dealRevealPlayer = [false, false];
  state.dealRevealDealer = [false, false];

  setResult("Dealing...", "Cards up.");
  renderAll();

  const steps = [
    { side: "player", index: 0 },
    { side: "dealer", index: 0 },
    { side: "player", index: 1 },
  ];
  const stepMs = 270;

  for (let i = 0; i < steps.length; i += 1) {
    const timer = setTimeout(() => {
      const step = steps[i];
      if (step.side === "player") {
        state.dealRevealPlayer[step.index] = true;
      } else {
        state.dealRevealDealer[step.index] = true;
      }
      cardFlipSound();
      renderAll();
    }, i * stepMs);
    dealTimers.push(timer);
  }

  const doneTimer = setTimeout(() => {
    completeInitialDeal();
  }, steps.length * stepMs + 20);
  dealTimers.push(doneTimer);
}

function advanceTurnOrResolve() {
  let next = -1;
  for (let i = state.activeHandIndex + 1; i < state.playerHands.length; i += 1) {
    if (!state.playerHands[i].done) {
      next = i;
      break;
    }
  }

  if (next >= 0) {
    state.activeHandIndex = next;
    if (state.playerHands.length > 1 && next === 1) {
      showTurnPrompt("Play the second hand.");
    } else {
      showTurnPrompt(`Play hand ${next + 1}.`);
    }
    renderAll();
    return;
  }

  resolveDealerAndRound();
}

function hit() {
  if (!canHit()) {
    invalidBeep();
    return;
  }
  const hand = currentHand();
  hand.cards.push(drawCard());
  cardFlipSound();
  const evalNow = handValue(hand.cards);
  if (hand.pendingDouble) {
    hand.pendingDouble = false;
    hand.done = true;
    hand.result = evalNow.isBust ? "BUST" : "STAND";
    if (evalNow.isBust) {
      setResult(`Hand ${state.activeHandIndex + 1} busts on double.`, "Dealer turn coming up.", "is-loss");
    } else {
      setResult(`Hand ${state.activeHandIndex + 1} receives final double card (${evalNow.best}).`, "Dealer turn coming up.");
    }
    advanceTurnOrResolve();
    return;
  }

  if (evalNow.isBust) {
    hand.done = true;
    hand.result = "BUST";
    setResult(`Hand ${state.activeHandIndex + 1} busts.`, "Dealer turn coming up.", "is-loss");
    advanceTurnOrResolve();
  } else {
    setResult(`Hand ${state.activeHandIndex + 1}: ${evalNow.best}.`, inHandHintText());
    renderAll();
  }
}

function stand() {
  if (!canStand()) {
    invalidBeep();
    return;
  }
  const hand = currentHand();
  hand.done = true;
  hand.result = "STAND";
  setResult(`Hand ${state.activeHandIndex + 1} stands.`, "Dealer turn coming up.");
  advanceTurnOrResolve();
}

function doubleDown() {
  if (!canDouble()) {
    invalidBeep();
    return;
  }
  const hand = currentHand();
  state.balance -= hand.bet;
  hand.bet *= 2;
  hand.doubled = true;
  hand.pendingDouble = true;
  setResult(`Bet doubled to ${formatCash(hand.bet)}.`, "Hit to take one final card.");
  renderAll();
}

function split() {
  if (!canSplit()) {
    invalidBeep();
    return;
  }

  clearDealTimers();

  const hand = currentHand();
  const first = hand.cards[0];
  const second = hand.cards[1];
  const splitAces = first.rank === 1;

  state.balance -= hand.bet;

  const handA = createHand([first], hand.bet, splitAces);
  const handB = createHand([second], hand.bet, splitAces);

  state.playerHands = [handA, handB];
  state.activeHandIndex = 0;
  state.phase = "SPLIT_DEALING";

  splitModeSound();
  setResult("Split in progress...", "Dealing split cards.", "is-split");
  renderAll();

  const revealFirstTimer = setTimeout(() => {
    handA.cards.push(drawCard());
    cardFlipSound();
    renderAll();
  }, SPLIT_DEAL_STEP_MS);
  dealTimers.push(revealFirstTimer);

  const revealSecondTimer = setTimeout(() => {
    handB.cards.push(drawCard());
    cardFlipSound();

    if (splitAces) {
      handA.done = true;
      handA.result = "STAND";
      handB.done = true;
      handB.result = "STAND";
      setResult("Split aces: one card each, auto-stand.", "Dealer turn coming up.");
      renderAll();
      const dealerTimer = setTimeout(() => {
        resolveDealerAndRound();
      }, Math.floor(SPLIT_DEAL_STEP_MS * 0.7));
      dealTimers.push(dealerTimer);
      return;
    }

    state.phase = "PLAYER_TURN";
    showTurnPrompt("Split complete. Play first hand.");
    renderAll();
  }, SPLIT_DEAL_STEP_MS * 2);
  dealTimers.push(revealSecondTimer);
}

function resolveDealerAndRound() {
  state.phase = "DEALER_TURN";
  clearDealTimers();
  setResult("Dealer turn...", "Revealing cards.");
  renderAll();

  const continueDealerReveal = () => {
    const dealerEval = handValue(state.dealerHand);
    const forceBustDraw =
      state.testMode &&
      ["Split Aces", "Player Blackjack", "Split Eights", "Low Cards", "Double Win"].includes(state.testScenarioLabel) &&
      !dealerEval.isBust &&
      (dealerEval.best === 17 || dealerEval.best === 18);

    if (dealerEval.best < 17 || forceBustDraw) {
      const drawTimer = setTimeout(() => {
        if (forceBustDraw && dealerEval.best >= 17) {
          state.dealerHand.push({ rank: 13, suit: "S" });
        } else {
          state.dealerHand.push(drawCard());
        }
        cardFlipSound();
        renderAll();
        continueDealerReveal();
      }, DEALER_REVEAL_STEP_MS);
      dealTimers.push(drawTimer);
      return;
    }

    finalizeDealerRound(dealerEval);
  };

  if (state.dealerHoleHidden) {
    const revealTimer = setTimeout(() => {
      state.dealerHoleHidden = false;
      cardFlipSound();
      renderAll();
      continueDealerReveal();
    }, DEALER_REVEAL_STEP_MS);
    dealTimers.push(revealTimer);
  } else {
    continueDealerReveal();
  }
}

function finalizeDealerRound(dealerEval) {

  let net = 0;
  let wins = 0;
  let pushes = 0;
  let losses = 0;
  let bigWin = false;

  for (const hand of state.playerHands) {
    const playerEval = handValue(hand.cards);
    let payout = 0;

    if (playerEval.isBust) {
      hand.result = "LOSE";
      losses += 1;
      net -= hand.bet;
    } else if (dealerEval.isBust) {
      payout = hand.bet * 2;
      hand.result = "WIN";
      wins += 1;
      net += hand.bet;
      if (playerEval.best >= 20 || hand.doubled) bigWin = true;
    } else if (playerEval.best > dealerEval.best) {
      payout = hand.bet * 2;
      hand.result = "WIN";
      wins += 1;
      net += hand.bet;
      if (playerEval.best >= 20 || hand.doubled) bigWin = true;
    } else if (playerEval.best === dealerEval.best) {
      payout = hand.bet;
      hand.result = "PUSH";
      pushes += 1;
    } else {
      hand.result = "LOSE";
      losses += 1;
      net -= hand.bet;
    }

    state.balance += payout;
  }

  if (net > 0) {
    if (bigWin || net >= state.bet * 2) {
      bigWinningSound();
    } else {
      winningSound();
    }
  } else if (net < 0) {
    losingHandSound();
  } else {
    pushSound();
  }

  let main = "Results:";
  if (wins > 0 && losses === 0 && pushes === 0) {
    main = "Results: You win!";
  } else if (losses > 0 && wins === 0 && pushes === 0) {
    main = "Results: You lose!";
  } else if (pushes > 0 && wins === 0 && losses === 0) {
    main = "Results: Push.";
  } else if (wins > 0 && losses > 0) {
    main = "Results: Mixed outcome.";
  } else if (wins > 0 && pushes > 0) {
    main = "Results: Win with push.";
  } else if (losses > 0 && pushes > 0) {
    main = "Results: Loss with push.";
  }
  let sub = `Net ${formatSigned(net)}. Press Next Hand.`;
  let tone = net > 0 ? "is-win" : net < 0 ? "is-loss" : "is-neutral";

  if (state.balance < MIN_BET) {
    state.balance += 100;
    emergencyLoanSound();
    main = "Emergency loan +$100.";
    sub = TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
    tone = "is-loss";
  }

  if (state.testMode) {
    sub += ` Test: ${state.testScenarioLabel}.`;
  }

  state.phase = "ROUND_RESULT";
  setResult(main, sub, tone);
  renderAll();
}

function toggleSound() {
  state.soundOn = !state.soundOn;
  renderStatus();
  if (state.soundOn) startupSound();
}

function openHelp() {
  if (!el.helpDialog.open) el.helpDialog.showModal();
}

function openAbout() {
  if (!el.aboutDialog.open) el.aboutDialog.showModal();
}

function resetSession() {
  clearDealTimers();
  state.phase = "PRE_DEAL";
  state.balance = START_BALANCE;
  state.bet = MIN_BET;
  state.dealerHand = [];
  state.playerHands = [];
  state.activeHandIndex = 0;
  state.dealerHoleHidden = true;
  state.testMode = false;
  state.testScenarioLabel = "";
  state.testScenarioNote = "";
  state.testRoundDeck = null;
  state.testRoundPos = 0;
  state.dealRevealPlayer = [false, false];
  state.dealRevealDealer = [false, false];
  setResult("Session reset.", KEY_HINT_TEXT);
  renderAll();
}

function adjustBet(delta) {
  if (!(state.phase === "PRE_DEAL" || state.phase === "ROUND_RESULT")) {
    invalidBeep();
    return;
  }

  const next = state.bet + delta;
  const maxBet = Math.min(TABLE_MAX, state.balance);
  if (delta > 0) {
    if (next <= maxBet) {
      state.bet = next;
      hiBeep();
    } else {
      invalidBeep();
    }
  } else if (delta < 0) {
    if (next >= MIN_BET) {
      state.bet = next;
      hiBeep();
    } else {
      invalidBeep();
    }
  }

  renderStatus();
}

function toggleTestMode() {
  if (!(state.phase === "PRE_DEAL" || state.phase === "ROUND_RESULT")) {
    invalidBeep();
    return;
  }

  state.testMode = !state.testMode;
  if (state.testMode) {
    state.testScenarioIndex = 0;
    state.testScenarioLabel = TEST_SCENARIOS[state.testScenarioIndex % TEST_SCENARIOS.length].name;
    state.testScenarioNote = TEST_SCENARIOS[state.testScenarioIndex % TEST_SCENARIOS.length].note;
    hiBeep();
    setResult("Secet test mode on", `First scenario: ${state.testScenarioLabel}. Press N for Next scenario.`, "is-loss");
  } else {
    lowBeep();
    state.testScenarioLabel = "";
    state.testScenarioNote = "";
    state.testRoundDeck = null;
    state.testRoundPos = 0;
    const compactOffText = state.phase === "ROUND_RESULT" ? "Press Next Hand." : "Press Deal to start.";
    setResult("Secret test mode off", isCompactLayout() ? compactOffText : KEY_HINT_TEXT);
  }
  renderAll();
}

function cycleTestScenario() {
  if (!state.testMode || !(state.phase === "PRE_DEAL" || state.phase === "ROUND_RESULT")) {
    invalidBeep();
    return;
  }
  state.testScenarioIndex = (state.testScenarioIndex + 1) % TEST_SCENARIOS.length;
  const scenario = TEST_SCENARIOS[state.testScenarioIndex];
  state.testScenarioLabel = scenario.name;
  state.testScenarioNote = scenario.note;
  hiBeep();
  if (scenario.name === "Low Cards") {
    setResult("Test selected.", "Test: Low cards to test card fanning layout.");
  } else {
    setResult("Test selected.", `Test: ${scenario.name}. ${scenario.note}`);
  }
  renderAll();
}

function handlePrimaryAction() {
  if (state.phase === "ROUND_RESULT") {
    clearDealTimers();
    state.phase = "PRE_DEAL";
    state.dealerHand = [];
    state.playerHands = [];
    state.activeHandIndex = 0;
    state.dealerHoleHidden = true;
    state.dealRevealPlayer = [false, false];
    state.dealRevealDealer = [false, false];
    state.bet = MIN_BET;
    setResult("Press Deal to start.", KEY_HINT_TEXT);
    renderAll();
    return;
  }
  if (state.phase === "PRE_DEAL") {
    startRound();
  } else {
    invalidBeep();
  }
}

function renderPaytable() {
  el.paytableList.innerHTML = "";
  for (const row of PAYTABLE) {
    const li = document.createElement("li");
    if (row.value) {
      li.innerHTML = `<span>${row.name}</span><span>${row.value}</span>`;
    } else {
      li.innerHTML = `<span>${row.name}</span>`;
    }
    el.paytableList.appendChild(li);
  }
}

function renderDealer() {
  el.dealerHand.innerHTML = "";
  el.dealerHand.classList.toggle("is-fanned", state.dealerHand.length >= 4);
  for (let i = 0; i < state.dealerHand.length; i += 1) {
    let hidden = false;
    if (state.phase === "DEALING") {
      hidden = !state.dealRevealDealer[i];
    } else {
      hidden = state.dealerHoleHidden && i === 1 && state.phase !== "ROUND_RESULT";
    }
    const slot = renderCardSlot(state.dealerHand[i], hidden);
    slot.style.zIndex = String(i + 1);
    el.dealerHand.appendChild(slot);
  }
  if (!state.dealerHand.length && state.phase === "PRE_DEAL") {
    el.dealerHand.appendChild(renderCardSlot(null, true));
    el.dealerHand.appendChild(renderCardSlot(null, true));
  } else if (!state.dealerHand.length) {
    const empty = document.createElement("div");
    empty.className = "empty-hand";
    empty.textContent = "Waiting for deal";
    el.dealerHand.appendChild(empty);
  }

  if (!state.dealerHand.length) {
    el.dealerTotal.textContent = HAND_TOTAL_PREFIX;
  } else if (state.dealerHoleHidden && state.dealerHand.length > 1) {
    const upEval = handValue([state.dealerHand[0]]);
    el.dealerTotal.textContent = `${HAND_TOTAL_PREFIX}${upEval.best} + ?`;
  } else {
    const evalDealer = handValue(state.dealerHand);
    el.dealerTotal.textContent = `${HAND_TOTAL_PREFIX}${evalDealer.best}`;
  }
}

function handHeaderLabel(hand) {
  const evalHand = handValue(hand.cards);
  const betLine = hand.result ? `Bet: ${formatCash(hand.bet)}  ${hand.result}` : `Bet: ${formatCash(hand.bet)}`;
  const lines = [`Hand: ${evalHand.best}`, betLine];
  return lines.join("\n");
}

function renderPlayerHands() {
  el.playerHands.innerHTML = "";

  if (!state.playerHands.length && state.phase === "PRE_DEAL") {
    const handWrap = document.createElement("div");
    handWrap.className = "player-hand single-hand";
    const cards = document.createElement("div");
    cards.className = "hand-cards";
    cards.appendChild(renderCardSlot(null, true));
    cards.appendChild(renderCardSlot(null, true));
    handWrap.appendChild(cards);
    el.playerHands.appendChild(handWrap);
    el.playerTotal.textContent = HAND_TOTAL_PREFIX;
    el.playerHands.classList.remove("is-split");
    return;
  }

  if (!state.playerHands.length) {
    const empty = document.createElement("div");
    empty.className = "empty-hand";
    empty.textContent = "Place bet and press Deal";
    el.playerHands.appendChild(empty);
    el.playerTotal.textContent = HAND_TOTAL_PREFIX;
    el.playerHands.classList.remove("is-split");
    return;
  }

  el.playerHands.classList.toggle("is-split", state.playerHands.length > 1);

  for (let i = 0; i < state.playerHands.length; i += 1) {
    const hand = state.playerHands[i];
    const handWrap = document.createElement("div");
    handWrap.className = "player-hand";
    if (state.playerHands.length === 1) handWrap.classList.add("single-hand");
    if (state.phase === "PLAYER_TURN" && i === state.activeHandIndex && !hand.done) {
      handWrap.classList.add("is-active");
    }

    const cards = document.createElement("div");
    cards.className = "hand-cards";
    cards.classList.toggle("is-fanned", hand.cards.length >= 4);
    for (let c = 0; c < hand.cards.length; c += 1) {
      const hideDuringDeal = state.phase === "DEALING" && i === 0 && c < 2 && !state.dealRevealPlayer[c];
      const slot = renderCardSlot(hand.cards[c], hideDuringDeal);
      slot.style.zIndex = String(c + 1);
      cards.appendChild(slot);
    }

    if (state.playerHands.length > 1) {
      const label = document.createElement("div");
      label.className = "player-hand-label";
      label.textContent = handHeaderLabel(hand);
      handWrap.appendChild(label);
    }
    handWrap.appendChild(cards);
    el.playerHands.appendChild(handWrap);
  }

  const active = currentHand();
  if (state.playerHands.length > 1) {
    el.playerTotal.textContent = "";
  } else if (active) {
    const evalActive = handValue(active.cards);
    el.playerTotal.textContent = `${HAND_TOTAL_PREFIX}${evalActive.best}`;
  } else {
    el.playerTotal.textContent = HAND_TOTAL_PREFIX;
  }
}

function renderStatus() {
  const compact = isCompactLayout();
  const active = currentHand();
  const displayBet = state.phase === "PLAYER_TURN" && active ? active.bet : state.bet;
  el.betValue.textContent = formatCash(displayBet);
  el.balanceValue.textContent = formatCash(state.balance);
  el.hitBtn.textContent = compact ? "Hit" : "Hit (Space)";
  el.standBtn.textContent = compact ? "Stand" : "Stand (Enter)";
  el.doubleBtn.textContent = compact ? "Double" : "Double (D)";
  el.splitBtn.textContent = compact ? "Split" : "Split (T)";
  el.aboutBtn.textContent = compact ? "About" : "About (A)";
  el.helpBtn.textContent = compact ? "Help" : "Help (H)";
  el.soundBtn.textContent = compact ? `Sound: ${state.soundOn ? "On" : "Off"}` : `Sound: ${state.soundOn ? "On" : "Off"} (S)`;

  if (state.phase === "PRE_DEAL") {
    el.dealDrawBtn.textContent = "Deal";
  } else if (state.phase === "ROUND_RESULT") {
    el.dealDrawBtn.textContent = "Next Hand";
  } else if (state.phase === "DEALER_TURN") {
    el.dealDrawBtn.textContent = "Dealer...";
  } else if (state.phase === "SPLIT_DEALING") {
    el.dealDrawBtn.textContent = "Splitting...";
  } else {
    el.dealDrawBtn.textContent = "In Hand";
  }

  el.dealDrawBtn.disabled = !(state.phase === "PRE_DEAL" || state.phase === "ROUND_RESULT");
  const canBet = state.phase === "PRE_DEAL" || state.phase === "ROUND_RESULT";
  el.betUpBtn.disabled = !canBet;
  el.betDownBtn.disabled = !canBet;

  el.hitBtn.disabled = !canHit();
  el.standBtn.disabled = !canStand();
  el.doubleBtn.disabled = !canDouble();
  const splitReady = canSplit();
  el.splitBtn.disabled = !splitReady;
  el.splitBtn.classList.toggle("is-split-ready", splitReady);

  const isDoublePrompt = state.resultMain.startsWith("Bet doubled to ");
  if (isDoublePrompt) {
    el.subLine.textContent = state.resultSub;
  } else if (compact && state.phase === "PLAYER_TURN") {
    el.subLine.textContent = state.resultSub;
  } else if (state.testMode && compact) {
    el.subLine.textContent = `Test: ${state.testScenarioLabel}.`;
  } else if (compact && state.phase !== "ROUND_RESULT") {
    el.subLine.textContent = "";
  } else {
    el.subLine.textContent = state.resultSub;
  }
}

function renderAll() {
  renderStatus();
  renderDealer();
  renderPlayerHands();
}

function wireEvents() {
  el.dealDrawBtn.addEventListener("click", handlePrimaryAction);
  el.betUpBtn.addEventListener("click", () => adjustBet(BET_STEP));
  el.betDownBtn.addEventListener("click", () => adjustBet(-BET_STEP));
  el.hitBtn.addEventListener("click", hit);
  el.standBtn.addEventListener("click", stand);
  el.doubleBtn.addEventListener("click", doubleDown);
  el.splitBtn.addEventListener("click", split);
  el.aboutBtn.addEventListener("click", openAbout);
  el.helpBtn.addEventListener("click", openHelp);
  el.soundBtn.addEventListener("click", toggleSound);
  if (el.brandLogo) el.brandLogo.addEventListener("click", toggleTestMode);

  document.addEventListener("keydown", (e) => {
    if (el.helpDialog.open || el.aboutDialog.open) {
      if (e.key === "Escape") return;
    }

    const key = e.key;
    const primaryEnabled = state.phase === "PRE_DEAL" || state.phase === "ROUND_RESULT";
    if (key === "Enter") {
      e.preventDefault();
      if (primaryEnabled) {
        handlePrimaryAction();
        return;
      }
      stand();
      return;
    }
    if (key === " " || e.code === "Space") {
      e.preventDefault();
      if (primaryEnabled) {
        handlePrimaryAction();
        return;
      }
      hit();
      return;
    }
    if (key === "d" || key === "D") {
      e.preventDefault();
      doubleDown();
      return;
    }
    if (key === "t" || key === "T") {
      e.preventDefault();
      split();
      return;
    }
    if (key === "Escape") {
      e.preventDefault();
      resetSession();
      return;
    }
    if (key === "h" || key === "H") {
      e.preventDefault();
      openHelp();
      return;
    }
    if (key === "a" || key === "A") {
      e.preventDefault();
      openAbout();
      return;
    }
    if (key === "s" || key === "S") {
      e.preventDefault();
      toggleSound();
      return;
    }
    if (key === "z" || key === "Z") {
      e.preventDefault();
      toggleTestMode();
      return;
    }
    if (key === "n" || key === "N") {
      e.preventDefault();
      cycleTestScenario();
      return;
    }

    if (key === "ArrowUp" || key === "ArrowRight") {
      e.preventDefault();
      adjustBet(BET_STEP);
      return;
    }
    if (key === "ArrowDown" || key === "ArrowLeft") {
      e.preventDefault();
      adjustBet(-BET_STEP);
    }
  });

  window.addEventListener("resize", () => {
    renderStatus();
  });
}

function init() {
  if (el.versionTag) el.versionTag.textContent = `V${APP_VERSION}`;
  buildFreshShoe();
  renderPaytable();
  setResult("Press Deal to start.", KEY_HINT_TEXT);
  renderAll();
  wireEvents();
}

init();
