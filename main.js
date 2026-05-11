// State
let songIndex = 0;
let scoreIndex = 0;
let isRatingMode = false;
let isAnimating = false;

// DOM Elements
const statusX = document.getElementById('status-x');
const barsWrapper = document.getElementById('bars-wrapper');
const dynLayer = document.getElementById('dynamic-layer');
const summaryInfo = document.getElementById('summary-info');
const summaryText = document.getElementById('summary-text');

// Mock Data
const mockSongs = [
  { diff: 'IN', constant: '15.8', name: 'DESTRUCTION 3,2,1', score: '09954320', rating: '15.65' },
  { diff: 'AT', constant: '16.4', name: 'Igrape', score: '09821000', rating: '15.98' },
  { diff: 'HD', constant: '11.5', name: 'Lyrith', score: '1000000', rating: '11.50' }
];

// Helper: wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: force reflow
const forceReflow = (element) => element.offsetHeight;

// Update UI
function updateStatus() {
  statusX.innerText = `song:${songIndex} score:${scoreIndex}`;
}

// Button 1: Song Selection Recognition
document.getElementById('btn-1').addEventListener('click', async () => {
  if (isAnimating || songIndex > 2) return;
  isAnimating = true;

  const song = mockSongs[songIndex];

  // Phase 1: Magnification (Spawn)
  const el = document.createElement('div');
  el.className = 'dyn-element';
  el.style.left = '20%';
  el.style.top = '40%';
  // Scale 1.5 visually
  el.style.transform = 'translate(-50%, -50%) scale(1.5)';

  el.innerHTML = `
    <div class="cover-wrapper">
      <div class="dyn-cover"></div>
      <div class="bottom-texts" style="opacity: 0;">
        <div class="diff-tag diff-${song.diff}">${song.diff}</div>
        <div class="song-name">${song.name}</div>
      </div>
    </div>
  `;
  dynLayer.appendChild(el);

  // Cover fades in and center
  await sleep(50);
  const dynCover = el.querySelector('.dyn-cover');
  dynCover.classList.add('show-cover');
  el.classList.add('center');

  // Text fade in
  await sleep(600); // Wait for center animation to be halfway
  el.querySelector('.bottom-texts').style.opacity = '1';

  // Wait 1s, prepare to extend bar
  await sleep(1400); 
  const targetBar = document.getElementById(`bar-${songIndex}`);
  const barContent = targetBar.querySelector('.bar-content');

  // Create inner content for bar NOW so we can measure it
  barContent.innerHTML = `
    <div class="info-inner" data-song-idx="${songIndex}">
      <div class="cover-wrapper">
        <div class="dyn-cover show-cover" style="opacity: 0;"></div>
        <div class="bottom-texts">
          <div class="diff-tag diff-${song.diff}">${song.diff}</div>
          <div class="song-name">${song.name}</div>
        </div>
      </div>
      <div class="score-large"><span class="score-value"></span></div>
    </div>
  `;

  const infoInner = barContent.querySelector('.info-inner');
  const targetWrapper = infoInner.querySelector('.cover-wrapper');

  // Synchronously measure final destination coordinates
  targetBar.classList.add('no-anim', 'extend');
  forceReflow(targetBar);
  const targetRect = targetWrapper.getBoundingClientRect();
  targetBar.classList.remove('extend');
  forceReflow(targetBar);
  targetBar.classList.remove('no-anim');

  // Now actually start extending animation
  targetBar.classList.add('extend');

  // Phase 2: Shrink and Move
  await sleep(800); // wait for extension halfway
  
  // Fade out texts on the flying element
  el.querySelector('.bottom-texts').style.opacity = '0';
  
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  // Animate the flying cover to perfectly measured target
  el.classList.remove('center');
  el.style.left = targetCenterX + 'px';
  el.style.top = targetCenterY + 'px';
  el.style.transform = 'translate(-50%, -50%) scale(1)';

  await sleep(1200); // wait for 1.2s movement animation
  
  const targetDynCover = infoInner.querySelector('.dyn-cover');
  targetDynCover.style.transition = 'none'; // Disable transition for instant swap
  targetDynCover.style.opacity = '1'; // Show bar cover instantly
  el.remove();

  // Phase 3: Texts Float Up
  forceReflow(infoInner);
  infoInner.querySelector('.bottom-texts').classList.add('float-up');

  // Retract bar after floating up completes
  await sleep(800);
  targetBar.classList.remove('extend');
  await sleep(1000);

  songIndex++;
  updateStatus();
  isAnimating = false;
});

// Button 2: Score Recognition
document.getElementById('btn-2').addEventListener('click', async () => {
  if (isAnimating || scoreIndex > 2) return;
  if (scoreIndex >= songIndex) {
    alert("请先进行选歌识别！");
    return;
  }

  const targetBar = document.getElementById(`bar-${scoreIndex}`);
  const infoInner = targetBar.querySelector('.info-inner');

  isAnimating = true;
  const song = mockSongs[scoreIndex];

  // 1. Create Element (Mock top right spawn)
  const el = document.createElement('div');
  el.className = 'dyn-element dyn-score';
  el.style.left = '80%';
  el.style.top = '15%';
  el.innerText = song.score;
  dynLayer.appendChild(el);

  // 2. Center and glow white
  await sleep(50);
  el.classList.add('center', 'glow-white');

  // 3. Wait 1.4s, prepare to extend bar
  await sleep(1400);

  const scoreSlot = infoInner.querySelector('.score-large');
  const scoreValue = infoInner.querySelector('.score-value');
  
  // Temporarily insert text and simulate fully extended bar to measure exact bounding box
  scoreValue.innerText = song.score;
  targetBar.classList.add('no-anim', 'extend');
  forceReflow(targetBar);
  const targetRect = scoreValue.getBoundingClientRect();
  targetBar.classList.remove('extend');
  forceReflow(targetBar);
  targetBar.classList.remove('no-anim');
  scoreValue.innerText = ''; // Clear it

  // Now animate
  targetBar.classList.add('extend');

  // 4. Catch and retract
  await sleep(800);

  // Animate el to shrink, move, and smoothly fade to final colors
  el.classList.remove('center', 'glow-white');
  el.classList.add('settled');
  el.style.left = (targetRect.left + targetRect.width / 2) + 'px';
  el.style.top = (targetRect.top + targetRect.height / 2) + 'px';
  el.style.transform = 'translate(-50%, -50%) scale(1)';
  
  await sleep(1200);
  el.remove();
  
  scoreValue.innerText = song.score;
  scoreSlot.dataset.score = song.score;
  scoreSlot.dataset.rating = song.rating;

  // Retract bar
  targetBar.classList.remove('extend');
  await sleep(1000);

  scoreIndex++;
  updateStatus();
  isAnimating = false;
});

// Button 3: Normal Reset
document.getElementById('btn-3').addEventListener('click', async () => {
  if (isAnimating) return;
  isAnimating = true;

  let activeBars = [];
  for (let i = 0; i < 3; i++) {
    const bar = document.getElementById(`bar-${i}`);
    if (bar.querySelector('.info-inner')) {
      bar.classList.add('extend');
      activeBars.push(bar);
    }
  }

  if (activeBars.length > 0) {
    await sleep(800);
    // Destroy contents instantly
    activeBars.forEach(bar => {
      bar.querySelector('.bar-content').innerHTML = '';
      bar.classList.remove('extend'); // retract
    });
    await sleep(1000);
  }

  songIndex = 0;
  scoreIndex = 0;
  updateStatus();
  isAnimating = false;
});

// Button 4: Settlement Board
document.getElementById('btn-4').addEventListener('click', async () => {
  if (isAnimating) return;
  isAnimating = true;

  if (barsWrapper.classList.contains('display-mode')) {
    isRatingMode = !isRatingMode;

    for (let i = 0; i < 3; i++) {
      const slot = document.querySelector(`#bar-${i} .score-large`);
      if (slot && slot.dataset.score) {
        const valSpan = slot.querySelector('.score-value');
        if(valSpan) {
          valSpan.innerText = isRatingMode ? slot.dataset.rating : slot.dataset.score;
        }
      }
    }

    if (isRatingMode) {
      summaryText.innerText = "总定数：43.13";
    } else {
      summaryText.innerText = "总分数：29775320";
    }

    isAnimating = false;
    return;
  }

  barsWrapper.classList.add('display-mode');

  for (let i = 0; i < 3; i++) {
    const bar = document.getElementById(`bar-${i}`);
    if (bar.querySelector('.info-inner')) {
      bar.classList.add('extend');
      await sleep(200); // cascading extension
    }
  }

  await sleep(800);

  isRatingMode = false;
  summaryText.innerText = "总分数：29775320"; // Mock sum
  summaryInfo.classList.remove('hidden');

  isAnimating = false;
});

// Button 5: Settlement Reset (Exit Animation)
document.getElementById('btn-5').addEventListener('click', async () => {
  if (isAnimating) return;
  if (!barsWrapper.classList.contains('display-mode')) return;

  isAnimating = true;
  summaryInfo.classList.add('hidden');

  for (let i = 0; i < 3; i++) {
    const bar = document.getElementById(`bar-${i}`);
    bar.classList.add('exit-left');
    await sleep(100);
  }

  await sleep(1000);

  barsWrapper.classList.remove('display-mode');
  isRatingMode = false;

  for (let i = 0; i < 3; i++) {
    const bar = document.getElementById(`bar-${i}`);
    bar.classList.add('no-anim');
    bar.classList.remove('exit-left', 'extend');
    bar.querySelector('.bar-content').innerHTML = '';
  }

  forceReflow(barsWrapper);

  for (let i = 0; i < 3; i++) {
    const bar = document.getElementById(`bar-${i}`);
    bar.classList.add('no-anim');
    bar.style.transform = 'skewX(-15deg) translateX(1200px)'; // move far right
  }
  forceReflow(barsWrapper);

  for (let i = 0; i < 3; i++) {
    const bar = document.getElementById(`bar-${i}`);
    bar.classList.remove('no-anim');
    bar.style.transform = '';
  }

  await sleep(1200);

  songIndex = 0;
  scoreIndex = 0;
  updateStatus();
  isAnimating = false;
});
