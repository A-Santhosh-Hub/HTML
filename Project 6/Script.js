function createModalParticles(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const numParticles = 30;
    for (let i = 0; i < numParticles; i++) {
      const particle = document.createElement('div');
      particle.className = 'modal-particle';
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * 50 + 20;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      particle.style.setProperty('--tx', tx + 'px');
      particle.style.setProperty('--ty', ty + 'px');
      const size = Math.random() * 6 + 2;
      particle.style.width = size + 'px';
      particle.style.height = size + 'px';
      particle.style.animationDelay = Math.random() * 0.3 + 's';
      container.appendChild(particle);
    }
    setTimeout(() => { container.innerHTML = ''; }, 1500);
  }
  function exitModalParticles(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const numParticles = 20;
    for (let i = 0; i < numParticles; i++) {
      const particle = document.createElement('div');
      particle.className = 'modal-particle exit';
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * 80 + 30;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      particle.style.setProperty('--tx', tx + 'px');
      particle.style.setProperty('--ty', ty + 'px');
      particle.style.animationDelay = Math.random() * 0.2 + 's';
      container.appendChild(particle);
    }
    setTimeout(() => { container.innerHTML = ''; }, 1500);
  }
  function showClipboardModal() {
    const modal = document.getElementById('clipboardModal');
    modal.classList.add('show');
    createModalParticles('clipboardModalParticles');
  }
  function closeClipboardModal() {
    exitModalParticles('clipboardModalParticles');
    const modal = document.getElementById('clipboardModal');
    modal.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; }, 500);
  }
  function showUpdateModal() {
    const modal = document.getElementById('updateModal');
    modal.style.display = 'block';
    setTimeout(() => { modal.classList.add('show'); }, 10);
    createModalParticles('updateModalParticles');
  }
  function closeUpdateModal() {
    exitModalParticles('updateModalParticles');
    const modal = document.getElementById('updateModal');
    modal.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; }, 500);
  }
  document.querySelectorAll('.download-button').forEach(button => {
    button.addEventListener('click', function(event) {
      event.preventDefault();
      if (this.classList.contains('faster-button')) {
        navigator.clipboard.writeText(this.href).then(() => {
          const modal = document.getElementById('clipboardModal');
          modal.style.display = 'block';
          setTimeout(() => { showClipboardModal(); }, 10);
        }).catch(err => {
          window.alert("Failed to copy the link. Please try again.");
        });
      } else {
        this.classList.add('loading');
        setTimeout(() => { window.location.href = this.href; }, 2000);
      }
    });
  });
  document.getElementById('clipboardModalClose').addEventListener('click', closeClipboardModal);
  document.getElementById('updateModalClose').addEventListener('click', closeUpdateModal);
  window.addEventListener('click', function(event) {
    const clipboardModal = document.getElementById('clipboardModal');
    if (event.target == clipboardModal) {
      closeClipboardModal();
    }
    const updateModal = document.getElementById('updateModal');
    if (event.target == updateModal) {
      closeUpdateModal();
    }
  });
  const recentUpdatesCount = 0;
  if (recentUpdatesCount > 0) {
    setTimeout(() => { showUpdateModal(); }, 1000);
  }
  let prevScrollPos = window.pageYOffset;
  const backHomeButton = document.querySelector('.back-home');
  window.addEventListener('scroll', function() {
    let currentScrollPos = window.pageYOffset;
    if (prevScrollPos > currentScrollPos) {
      backHomeButton.style.opacity = "1";
      backHomeButton.style.visibility = "visible";
    } else {
      backHomeButton.style.opacity = "0";
      backHomeButton.style.visibility = "hidden";
    }
    prevScrollPos = currentScrollPos;
  });
  function triggerShinyEffect() {
    const buttons = document.querySelectorAll('.download-button.faster-button, .download-button.coming-soon-button');
    buttons.forEach(button => {
      button.classList.add('shiny');
      setTimeout(() => { button.classList.remove('shiny'); }, 1000);
    });
  }
  setInterval(triggerShinyEffect, 2000);

 
