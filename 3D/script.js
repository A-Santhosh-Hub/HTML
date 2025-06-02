const fadeEls = document.querySelectorAll('.fade-in, .slide-in');
const progressBar = document.getElementById('progress-bar');
const music = document.getElementById('bg-music');
let isPlaying = false;

function onScroll() {
  const scrollTop = window.scrollY;
  const winHeight = window.innerHeight;
  const docHeight = document.documentElement.scrollHeight;
  const totalScroll = (scrollTop / (docHeight - winHeight)) * 100;
  progressBar.style.width = `${totalScroll}%`;

  fadeEls.forEach(el => {
    const elTop = el.getBoundingClientRect().top;
    if (elTop < winHeight * 0.85) {
      el.classList.add('show');
    } else {
      el.classList.remove('show');
    }
  });
}

function scrollToSection(id) {
  const section = document.getElementById(id);
  section.scrollIntoView({ behavior: 'smooth' });
}

function toggleAudio() {
  if (isPlaying) {
    music.pause();
  } else {
    music.play();
  }
  isPlaying = !isPlaying;
}

// // 🖱️ Mouse Parallax
// document.addEventListener('mousemove', (e) => {
//   document.querySelectorAll('.parallax-layer').forEach(layer => {
//     const speed = layer.dataset.speed || 10;
//     const x = (window.innerWidth / 2 - e.pageX) / speed;
//     const y = (window.innerHeight / 2 - e.pageY) / speed;
//     layer.style.transform = `translateX(${x}px) translateY(${y}px)`;
//   });
// });

window.addEventListener('scroll', onScroll);
window.addEventListener('load', onScroll);
