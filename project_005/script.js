const fileInput = document.getElementById('file-input');
const playBtn = document.getElementById('play-btn');
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');

let audioContext;
let analyser;
let source;
let dataArray;
let bufferLength;
let audio;
let isPlaying = false;

// Resize canvas to match container width
function resizeCanvas() {
  canvas.width = canvas.clientWidth;
  canvas.height = 300;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

fileInput.addEventListener('change', function () {
  const files = this.files;
  if (files.length === 0) return;

  if (audio) {
    audio.pause();
    audio = null;
  }

  const fileURL = URL.createObjectURL(files[0]);
  audio = new Audio(fileURL);
  audio.crossOrigin = "anonymous";

  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (source) {
    source.disconnect();
  }

  source = audioContext.createMediaElementSource(audio);

  if (analyser) {
    analyser.disconnect();
  }

  analyser = audioContext.createAnalyser();
  source.connect(analyser);
  analyser.connect(audioContext.destination);

  analyser.fftSize = 256;
  bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  playBtn.textContent = '▶️ Play';
  isPlaying = false;

  draw(); // Start drawing
});

playBtn.addEventListener('click', () => {
  if (!audio) return;

  if (!isPlaying) {
    audioContext.resume();
    audio.play();
    playBtn.textContent = '⏸ Pause';
    isPlaying = true;
  } else {
    audio.pause();
    playBtn.textContent = '▶️ Play';
    isPlaying = false;
  }
});

function draw() {
  requestAnimationFrame(draw);

  if (!analyser) return;

  analyser.getByteFrequencyData(dataArray);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const barWidth = (canvas.width / bufferLength) * 2.5;
  let barHeight;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    barHeight = dataArray[i];

    const r = 0;
    const g = barHeight + 100;
    const b = 200;

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.shadowColor = `rgb(${r},${g},${b})`;
    ctx.shadowBlur = 15;
    ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

    x += barWidth + 1;
  }
}
