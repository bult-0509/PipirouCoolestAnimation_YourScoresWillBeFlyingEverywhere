// State
let songIndex = 0;
let scoreIndex = 0;
let isRatingMode = false;
let isAnimating = false;
const recognizedSongs = [];

// DOM Elements
const statusX = document.getElementById('status-x');
const apiStatus = document.getElementById('api-status');
const cameraSelect = document.getElementById('camera-select');
const refreshCamerasButton = document.getElementById('btn-refresh-cameras');
const sampleSelect = document.getElementById('sample-select');
const barsWrapper = document.getElementById('bars-wrapper');
const dynLayer = document.getElementById('dynamic-layer');
const sourceFrameLayer = document.getElementById('source-frame-layer');
const sourceFrameImage = document.getElementById('source-frame-image');
const summaryInfo = document.getElementById('summary-info');
const summaryText = document.getElementById('summary-text');

const fallbackSongs = [
  { diff: 'IN', constant: '15.8', name: 'DESTRUCTION 3,2,1', score: '09954320', rating: '15.65' },
  { diff: 'AT', constant: '16.4', name: 'Igrape', score: '09821000', rating: '15.98' },
  { diff: 'HD', constant: '11.5', name: 'Lyrith', score: '10000000', rating: '11.50' }
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const forceReflow = (element) => element.offsetHeight;

function updateStatus() {
  statusX.innerText = `song:${songIndex} score:${scoreIndex}`;
}

function setApiStatus(text, mode = 'idle') {
  apiStatus.innerText = text;
  apiStatus.dataset.mode = mode;
}

function selectedCameraIndex() {
  if (!cameraSelect || cameraSelect.value === '') {
    return null;
  }
  return Number.parseInt(cameraSelect.value, 10);
}

function selectedSampleFrame() {
  if (!sampleSelect || sampleSelect.value === '') {
    return null;
  }
  return sampleSelect.value;
}

function setCameraOptions(cameras, selectedValue = '') {
  cameraSelect.innerHTML = '<option value="">自动选择</option>';

  for (const camera of cameras) {
    const option = document.createElement('option');
    option.value = String(camera.index);
    option.textContent = camera.label || `Camera ${camera.index}`;
    cameraSelect.appendChild(option);
  }

  if ([...cameraSelect.options].some(option => option.value === selectedValue)) {
    cameraSelect.value = selectedValue;
  } else {
    cameraSelect.value = '';
  }
}

function setSampleOptions(samples, selectedValue = sampleSelect.value) {
  sampleSelect.innerHTML = `
    <option value="">关闭</option>
    <option value="auto">按按钮自动选择</option>
  `;

  for (const sample of samples) {
    if (!sample.exists) continue;
    const option = document.createElement('option');
    option.value = sample.key;
    option.textContent = sample.label;
    sampleSelect.appendChild(option);
  }

  if ([...sampleSelect.options].some(option => option.value === selectedValue)) {
    sampleSelect.value = selectedValue;
  }
}

async function refreshCameras() {
  const previousValue = cameraSelect.value;
  refreshCamerasButton.disabled = true;
  setApiStatus('正在扫描摄像头...', 'busy');

  try {
    const response = await fetch('/api/cameras');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    setCameraOptions(payload.cameras || [], previousValue);

    if (!payload.opencv) {
      setApiStatus(`无法扫描摄像头：${payload.reason || 'OpenCV 不可用'}`, 'warn');
    } else if ((payload.cameras || []).length === 0) {
      setApiStatus(`未发现摄像头，后端：${payload.backend}`, 'warn');
    } else {
      setApiStatus(`发现 ${(payload.cameras || []).length} 个摄像头，后端：${payload.backend}`, 'ok');
    }
  } catch (error) {
    setCameraOptions([], previousValue);
    setApiStatus(`摄像头列表不可用：${error.message}`, 'warn');
  } finally {
    refreshCamerasButton.disabled = false;
  }
}

async function refreshSamples() {
  try {
    const response = await fetch('/api/samples');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    setSampleOptions(payload.samples || []);
  } catch (error) {
    setApiStatus(`测试图列表不可用：${error.message}`, 'warn');
  }
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function fallbackSong(slot) {
  return { ...fallbackSongs[slot % fallbackSongs.length] };
}

function normalizeSong(input, slot) {
  const fallback = fallbackSong(slot);
  return {
    diff: input?.diff || fallback.diff,
    constant: input?.constant || fallback.constant,
    name: input?.name || fallback.name,
    score: input?.score || fallback.score,
    rating: input?.rating || fallback.rating,
    coverImage: input?.coverImage || null,
    coverCrop: input?.coverCrop || null,
    coverMatch: input?.coverMatch || null,
    sourceFrame: input?.sourceFrame || null,
    sourceWidth: input?.sourceWidth || null,
    sourceHeight: input?.sourceHeight || null
  };
}

async function recognize(kind, slot) {
  setApiStatus(`正在${kind === 'song' ? '拍照识别曲绘' : '拍照识别成绩'}...`, 'busy');

  try {
    const response = await fetch('/api/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        slot,
        cameraIndex: selectedCameraIndex(),
        sampleFrame: selectedSampleFrame()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!payload.ok) {
      throw new Error(payload.error || 'recognition failed');
    }

    const captureText = payload.capture?.ok && payload.capture?.source === 'sample'
      ? `测试图 ${payload.capture.sampleLabel} 已载入`
      : payload.capture?.ok
        ? `摄像头 ${payload.capture.cameraIndex} 已拍照 ${payload.capture.width}x${payload.capture.height}`
        : `后端在线，使用模拟识别：${payload.capture?.reason || '未取得画面'}`;
    setApiStatus(captureText, payload.capture?.ok ? 'ok' : 'warn');
    return payload;
  } catch (error) {
    setApiStatus(`后端不可用，使用前端模拟：${error.message}`, 'warn');
    return {
      ok: true,
      kind,
      slot,
      capture: { ok: false, reason: error.message },
      song: kind === 'song' ? fallbackSong(slot) : undefined,
      score: kind === 'score'
        ? { score: fallbackSong(slot).score, rating: fallbackSong(slot).rating }
        : undefined,
      recognitionMode: 'frontend-fallback'
    };
  }
}

function coverStyle(song, opacity = null) {
  const styles = [];
  if (song.coverImage) {
    styles.push(`background-image: url('${escapeHTML(song.coverImage)}')`);
  }
  if (opacity !== null) {
    styles.push(`opacity: ${opacity}`);
  }
  return styles.length > 0 ? ` style="${styles.join('; ')};"` : '';
}

function attachCaptureToSong(song, capture) {
  if (!capture?.ok || !capture.frameUrl) {
    return song;
  }

  song.sourceFrame = capture.frameUrl;
  song.sourceWidth = capture.width;
  song.sourceHeight = capture.height;
  return song;
}

function hideSourceFrame() {
  sourceFrameLayer?.classList.add('hidden');
}

async function showSourceFrame(song) {
  if (!sourceFrameLayer || !sourceFrameImage || !song.sourceFrame || !song.sourceWidth || !song.sourceHeight) {
    return false;
  }

  sourceFrameImage.src = song.sourceFrame;
  sourceFrameLayer.classList.remove('hidden');

  if (sourceFrameImage.decode) {
    try {
      await sourceFrameImage.decode();
    } catch (_error) {
      // Browser may reject decode for an already-loading image; layout math uses known frame size.
    }
  }
  return true;
}

function frameViewportMapping(frameWidth, frameHeight) {
  if (!frameWidth || !frameHeight) {
    return null;
  }

  const scale = Math.min(window.innerWidth / frameWidth, window.innerHeight / frameHeight);
  const renderedWidth = frameWidth * scale;
  const renderedHeight = frameHeight * scale;
  const offsetX = (window.innerWidth - renderedWidth) / 2;
  const offsetY = (window.innerHeight - renderedHeight) / 2;

  return { scale, renderedWidth, renderedHeight, offsetX, offsetY };
}

function mapFramePointToViewport(point, mapping) {
  return {
    x: mapping.offsetX + point[0] * mapping.scale,
    y: mapping.offsetY + point[1] * mapping.scale
  };
}

function coverSourcePlacement(song) {
  const sourceQuad = song.coverCrop?.sourceQuad;
  const mapping = frameViewportMapping(song.sourceWidth, song.sourceHeight);
  if (!mapping || !Array.isArray(sourceQuad) || sourceQuad.length !== 4) {
    return null;
  }

  const points = sourceQuad.map(point => mapFramePointToViewport(point, mapping));
  const left = Math.min(...points.map(point => point.x));
  const top = Math.min(...points.map(point => point.y));
  const right = Math.max(...points.map(point => point.x));
  const bottom = Math.max(...points.map(point => point.y));
  const width = right - left;
  const height = bottom - top;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    left,
    top,
    width,
    height,
    clipPath: points
      .map(point => `${((point.x - left) / width) * 100}% ${((point.y - top) / height) * 100}%`)
      .join(', '),
    backgroundSize: `${mapping.renderedWidth}px ${mapping.renderedHeight}px`,
    backgroundPosition: `${mapping.offsetX - left}px ${mapping.offsetY - top}px`
  };
}

function buildSongInfoHTML(song, slot, coverOpacity = '0') {
  return `
    <div class="info-inner" data-song-idx="${slot}">
      <div class="cover-wrapper">
        <div class="dyn-cover show-cover"${coverStyle(song, coverOpacity)}></div>
        <div class="bottom-texts">
          <div class="diff-tag diff-${escapeHTML(song.diff)}">${escapeHTML(song.diff)}</div>
          <div class="song-name">${escapeHTML(song.name)}</div>
        </div>
      </div>
      <div class="score-large"><span class="score-value"></span></div>
    </div>
  `;
}

function currentScoreTotal() {
  return recognizedSongs.reduce((sum, song) => {
    const value = Number.parseInt(String(song?.score || '0').replace(/\D/g, ''), 10);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function currentRatingTotal() {
  return recognizedSongs.reduce((sum, song) => {
    const value = Number.parseFloat(song?.rating || '0');
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function updateSummary() {
  if (isRatingMode) {
    summaryText.innerText = `总定数：${currentRatingTotal().toFixed(2)}`;
  } else {
    summaryText.innerText = `总分数：${String(currentScoreTotal()).padStart(8, '0')}`;
  }
}

async function playSongAnimation(song, slot) {
  await showSourceFrame(song);
  const sourcePlacement = coverSourcePlacement(song);

  const el = document.createElement('div');
  el.className = 'dyn-element cover-flight';
  if (sourcePlacement) {
    el.classList.add('source-origin');
    el.style.left = sourcePlacement.left + 'px';
    el.style.top = sourcePlacement.top + 'px';
    el.style.width = sourcePlacement.width + 'px';
    el.style.height = sourcePlacement.height + 'px';
    el.style.transform = 'none';
  } else {
    el.style.left = '20%';
    el.style.top = '40%';
    el.style.width = '128px';
    el.style.height = '72px';
    el.style.transform = 'translate(-50%, -50%) scale(1.5)';
  }

  el.innerHTML = `
    <div class="source-cut-cover"></div>
    <div class="cover-wrapper flight-cover-wrapper">
      <div class="dyn-cover flight-cover"${coverStyle(song)}></div>
      <div class="bottom-texts" style="opacity: 0;">
        <div class="diff-tag diff-${escapeHTML(song.diff)}">${escapeHTML(song.diff)}</div>
        <div class="song-name">${escapeHTML(song.name)}</div>
      </div>
    </div>
  `;
  dynLayer.appendChild(el);

  const sourceCut = el.querySelector('.source-cut-cover');
  if (sourcePlacement && sourceCut) {
    sourceCut.style.backgroundImage = `url('${song.sourceFrame}')`;
    sourceCut.style.backgroundSize = sourcePlacement.backgroundSize;
    sourceCut.style.backgroundPosition = sourcePlacement.backgroundPosition;
    sourceCut.style.clipPath = `polygon(${sourcePlacement.clipPath})`;
  } else if (sourceCut) {
    sourceCut.remove();
  }

  await sleep(50);
  const dynCover = el.querySelector('.dyn-cover');
  if (sourcePlacement) {
    el.classList.add('source-cut-ready');
    await sleep(520);
    el.classList.add('source-revealed');
    dynCover.classList.add('show-cover');
    await sleep(260);
  } else {
    dynCover.classList.add('show-cover');
  }

  el.style.width = '128px';
  el.style.height = '72px';
  el.classList.add('center');

  await sleep(sourcePlacement ? 1150 : 600);
  el.querySelector('.bottom-texts').style.opacity = '1';

  await sleep(1400);
  hideSourceFrame();
  const targetBar = document.getElementById(`bar-${slot}`);
  const barContent = targetBar.querySelector('.bar-content');

  barContent.innerHTML = buildSongInfoHTML(song, slot);

  const infoInner = barContent.querySelector('.info-inner');
  const targetWrapper = infoInner.querySelector('.cover-wrapper');

  targetBar.classList.add('no-anim', 'extend');
  forceReflow(targetBar);
  const targetRect = targetWrapper.getBoundingClientRect();
  targetBar.classList.remove('extend');
  forceReflow(targetBar);
  targetBar.classList.remove('no-anim');

  targetBar.classList.add('extend');

  await sleep(800);
  el.querySelector('.bottom-texts').style.opacity = '0';

  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  el.classList.remove('center');
  el.style.left = targetCenterX + 'px';
  el.style.top = targetCenterY + 'px';
  el.style.transform = 'translate(-50%, -50%) scale(1)';

  await sleep(1200);

  const targetDynCover = infoInner.querySelector('.dyn-cover');
  targetDynCover.style.transition = 'none';
  targetDynCover.style.opacity = '1';
  el.remove();

  forceReflow(infoInner);
  infoInner.querySelector('.bottom-texts').classList.add('float-up');

  await sleep(800);
  targetBar.classList.remove('extend');
  await sleep(1000);
}

async function playScoreAnimation(song, slot) {
  const targetBar = document.getElementById(`bar-${slot}`);
  const infoInner = targetBar.querySelector('.info-inner');

  const el = document.createElement('div');
  el.className = 'dyn-element dyn-score';
  el.style.left = '80%';
  el.style.top = '15%';
  el.innerText = song.score;
  dynLayer.appendChild(el);

  await sleep(50);
  el.classList.add('center', 'glow-white');

  await sleep(1400);

  const scoreSlot = infoInner.querySelector('.score-large');
  const scoreValue = infoInner.querySelector('.score-value');

  scoreValue.innerText = song.score;
  targetBar.classList.add('no-anim', 'extend');
  forceReflow(targetBar);
  const targetRect = scoreValue.getBoundingClientRect();
  targetBar.classList.remove('extend');
  forceReflow(targetBar);
  targetBar.classList.remove('no-anim');
  scoreValue.innerText = '';

  targetBar.classList.add('extend');

  await sleep(800);

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

  targetBar.classList.remove('extend');
  await sleep(1000);
}

document.getElementById('btn-1').addEventListener('click', async () => {
  if (isAnimating || songIndex > 2) return;
  isAnimating = true;

  try {
    const slot = songIndex;
    const result = await recognize('song', slot);
    const song = attachCaptureToSong(normalizeSong(result.song, slot), result.capture);
    recognizedSongs[slot] = song;

    await playSongAnimation(song, slot);

    songIndex++;
    updateStatus();
  } finally {
    isAnimating = false;
  }
});

document.getElementById('btn-2').addEventListener('click', async () => {
  if (isAnimating || scoreIndex > 2) return;
  if (scoreIndex >= songIndex) {
    alert('请先进行选歌识别！');
    return;
  }

  const targetBar = document.getElementById(`bar-${scoreIndex}`);
  const infoInner = targetBar.querySelector('.info-inner');
  if (!infoInner) return;

  isAnimating = true;

  try {
    const slot = scoreIndex;
    const result = await recognize('score', slot);
    const currentSong = normalizeSong(recognizedSongs[slot], slot);
    currentSong.score = result.score?.score || currentSong.score;
    currentSong.rating = result.score?.rating || currentSong.rating;
    recognizedSongs[slot] = currentSong;

    await playScoreAnimation(currentSong, slot);

    scoreIndex++;
    updateStatus();
  } finally {
    isAnimating = false;
  }
});

document.getElementById('btn-3').addEventListener('click', async () => {
  if (isAnimating) return;
  isAnimating = true;

  const activeBars = [];
  for (let i = 0; i < 3; i++) {
    const bar = document.getElementById(`bar-${i}`);
    if (bar.querySelector('.info-inner')) {
      bar.classList.add('extend');
      activeBars.push(bar);
    }
  }

  if (activeBars.length > 0) {
    await sleep(800);
    activeBars.forEach(bar => {
      bar.querySelector('.bar-content').innerHTML = '';
      bar.classList.remove('extend');
    });
    await sleep(1000);
  }

  recognizedSongs.length = 0;
  songIndex = 0;
  scoreIndex = 0;
  summaryInfo.classList.add('hidden');
  hideSourceFrame();
  updateStatus();
  setApiStatus('等待本地识别服务', 'idle');
  isAnimating = false;
});

document.getElementById('btn-4').addEventListener('click', async () => {
  if (isAnimating) return;
  isAnimating = true;

  if (barsWrapper.classList.contains('display-mode')) {
    isRatingMode = !isRatingMode;

    for (let i = 0; i < 3; i++) {
      const slot = document.querySelector(`#bar-${i} .score-large`);
      if (slot && slot.dataset.score) {
        const valSpan = slot.querySelector('.score-value');
        if (valSpan) {
          valSpan.innerText = isRatingMode ? slot.dataset.rating : slot.dataset.score;
        }
      }
    }

    updateSummary();
    isAnimating = false;
    return;
  }

  barsWrapper.classList.add('display-mode');

  for (let i = 0; i < 3; i++) {
    const bar = document.getElementById(`bar-${i}`);
    if (bar.querySelector('.info-inner')) {
      bar.classList.add('extend');
      await sleep(200);
    }
  }

  await sleep(800);

  isRatingMode = false;
  updateSummary();
  summaryInfo.classList.remove('hidden');

  isAnimating = false;
});

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
    bar.style.transform = 'skewX(-15deg) translateX(1200px)';
  }
  forceReflow(barsWrapper);

  for (let i = 0; i < 3; i++) {
    const bar = document.getElementById(`bar-${i}`);
    bar.classList.remove('no-anim');
    bar.style.transform = '';
  }

  await sleep(1200);

  recognizedSongs.length = 0;
  songIndex = 0;
  scoreIndex = 0;
  hideSourceFrame();
  updateStatus();
  setApiStatus('等待本地识别服务', 'idle');
  isAnimating = false;
});

updateStatus();
setApiStatus('等待本地识别服务', 'idle');
refreshCamerasButton.addEventListener('click', refreshCameras);
refreshCameras();
refreshSamples();
