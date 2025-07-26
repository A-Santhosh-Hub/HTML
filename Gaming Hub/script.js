document.addEventListener('DOMContentLoaded', () => {

    // --- 🎮 GAME DATA 🎮 ---
    // This is your "database" of games. Add your games here.
    // The 'url' should point to the HTML file of your game inside the 'games' folder.
    const games = [
        { id: 1, title: "Space Shooter", category: "action", image: "as/1.png", url: "games/space-shooter.html" },
        { id: 2, title: "Logic Blocks", category: "puzzle", image: "as/2.png", url: "games/logic-blocks.html" },
        { id: 3, title: "Tower Masters", category: "strategy", image: "as/3.png", url: "games/tower-masters.html" },
        { id: 4, title: "Haunted Maze", category: "horror", image: "as/4.png", url: "games/haunted-maze.html" },
        { id: 5, title: "Rapid Reflex", category: "action", image: "as/5.png", url: "games/rapid-reflex.html" },
        { id: 6, title: "Sudoku Pro", category: "puzzle", image: "as/6.png", url: "games/sudoku-pro.html" },
        { id: 7, title: "Classic Snake", category: "arcade", image: "as/7.png", url: "games/snake.html" },
    ];
    // Replace "https://via.placeholder.com" URLs with your own game thumbnail images!

    // ---  DOM Elements ---
    const gameGrid = document.getElementById('game-grid');
    const navItems = document.querySelectorAll('.nav-item');
    const themeSwitcher = document.getElementById('theme-switcher');
    const gameView = document.getElementById('game-view');
    const gameFrame = document.getElementById('game-frame');
    const closeGameBtn = document.getElementById('close-game-btn');
    const htmlEl = document.documentElement;

    // --- 🎨 THEME SWITCHER 🎨 ---
    const currentTheme = localStorage.getItem('theme') || 'dark';
    htmlEl.setAttribute('data-theme', currentTheme);
    themeSwitcher.textContent = currentTheme === 'dark' ? '☀️' : '🌙';

    themeSwitcher.addEventListener('click', () => {
        const newTheme = htmlEl.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        htmlEl.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeSwitcher.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    });

    // --- 🕹️ RENDER GAMES 🕹️ ---
    function renderGames(filter = 'all') {
        gameGrid.innerHTML = ''; // Clear existing games
        const filteredGames = games.filter(game => filter === 'all' || game.category === filter);

        filteredGames.forEach(game => {
            const gameCard = document.createElement('div');
            gameCard.className = 'game-card';
            gameCard.setAttribute('data-game-url', game.url); // Set the URL to load
            
            gameCard.innerHTML = `
                <img src="${game.image}" alt="${game.title}" class="card-image">
                <div class="card-content">
                    <h3 class="card-title">${game.title}</h3>
                    <p class="card-category">${game.category}</p>
                </div>
            `;
            gameGrid.appendChild(gameCard);
        });
    }

    // --- 📂 CATEGORY FILTERING 📂 ---
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Update active class on nav items
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            const category = item.getAttribute('data-category');
            renderGames(category);
        });
    });

    // --- 🚀 LOAD & PLAY GAME 🚀 ---
    gameGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.game-card');
        if (card) {
            const gameUrl = card.getAttribute('data-game-url');
            gameFrame.src = gameUrl; // Load game into the iframe
            gameView.classList.remove('hidden');
        }
    });

    closeGameBtn.addEventListener('click', () => {
        gameView.classList.add('hidden');
        gameFrame.src = ''; // Stop the game by clearing the src
    });

    // Initial render of all games on page load
    renderGames('all');
});
