const emojis = ['🐶','🐱','🐼','🦊','🐸','🐵','🐯','🐰'];
let cardsArray = [...emojis, ...emojis];
let grid = document.getElementById("grid");
let movesEl = document.getElementById("moves");
let timerEl = document.getElementById("timer");
let bestTimeEl = document.getElementById("best-time");
let winPopup = document.getElementById("win-popup");

let firstCard = null;
let secondCard = null;
let lockBoard = false;
let moves = 0;
let time = 0;
let matched = 0;
let timer;
let started = false;

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function createCard(emoji) {
  const card = document.createElement("div");
  card.classList.add("card");
  card.innerHTML = `
    <div class="front">❓</div>
    <div class="back">${emoji}</div>
  `;
  card.dataset.emoji = emoji;
  card.addEventListener("click", () => handleFlip(card));
  return card;
}

function handleFlip(card) {
  if (lockBoard || card.classList.contains("flipped") || card === firstCard) return;

  card.classList.add("flipped");

  if (!started) {
    started = true;
    startTimer();
  }

  if (!firstCard) {
    firstCard = card;
    return;
  }

  secondCard = card;
  moves++;
  movesEl.textContent = moves;

  if (firstCard.dataset.emoji === secondCard.dataset.emoji) {
    matched += 2;
    resetTurn();
    if (matched === cardsArray.length) {
      setTimeout(() => showWin(), 800);
    }
  } else {
    lockBoard = true;
    setTimeout(() => {
      firstCard.classList.remove("flipped");
      secondCard.classList.remove("flipped");
      resetTurn();
    }, 1000);
  }
}

function resetTurn() {
  [firstCard, secondCard] = [null, null];
  lockBoard = false;
}

function startTimer() {
  timer = setInterval(() => {
    time++;
    timerEl.textContent = `${time}s`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timer);
}

function showWin() {
  stopTimer();
  document.getElementById("final-moves").textContent = moves;
  document.getElementById("final-time").textContent = `${time}s`;
  winPopup.classList.remove("hidden");

  const best = localStorage.getItem("memory-best-time");
  if (!best || time < parseInt(best)) {
    localStorage.setItem("memory-best-time", time);
  }
  bestTimeEl.textContent = localStorage.getItem("memory-best-time") + "s";
}

function startGame() {
  grid.innerHTML = "";
  cardsArray = shuffle(cardsArray);
  cardsArray.forEach(emoji => grid.appendChild(createCard(emoji)));

  [firstCard, secondCard] = [null, null];
  lockBoard = false;
  moves = 0;
  time = 0;
  matched = 0;
  started = false;
  clearInterval(timer);
  timerEl.textContent = "0s";
  movesEl.textContent = "0";
  winPopup.classList.add("hidden");
  bestTimeEl.textContent = localStorage.getItem("memory-best-time") 
    ? localStorage.getItem("memory-best-time") + "s"
    : "--";
}

document.getElementById("restart").addEventListener("click", startGame);

startGame();
