(() => {
  'use strict';

  const audio = document.getElementById('audioEl');
  const cards = Array.from(document.querySelectorAll('.card'));

  const playerTitle = document.getElementById('playerTitle');
  const playerSubtitle = document.getElementById('playerSubtitle');
  const playerArt = document.getElementById('playerArt');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const stopBtn = document.getElementById('stopBtn');
  const progressBar = document.getElementById('progressBar');
  const progressCurrent = document.getElementById('progressCurrent');
  const progressTotal = document.getElementById('progressTotal');
  const volumeBar = document.getElementById('volumeBar');
  const volumeIcon = document.getElementById('volumeIcon');

  let activeCard = null;
  let isSeeking = false;

  // ---------- volume (persisted) ----------
  const savedVolume = parseInt(localStorage.getItem('ambient-hours-volume'), 10);
  const initialVolume = Number.isFinite(savedVolume) ? savedVolume : 70;
  volumeBar.value = initialVolume;
  audio.volume = initialVolume / 100;
  updateVolumeIcon(initialVolume);

  volumeBar.addEventListener('input', () => {
    const v = Number(volumeBar.value);
    audio.volume = v / 100;
    localStorage.setItem('ambient-hours-volume', String(v));
    updateVolumeIcon(v);
  });

  function updateVolumeIcon(v) {
    if (v === 0) {
      volumeIcon.innerHTML = '<path d="M3 10v4h4l5 5V5L7 10H3z"/>';
    } else if (v < 50) {
      volumeIcon.innerHTML = '<path d="M3 10v4h4l5 5V5L7 10H3z"/><path d="M16.5 12a3.5 3.5 0 0 0-2-3.16v6.32c1.19-.6 2-1.85 2-3.16z"/>';
    } else {
      volumeIcon.innerHTML = '<path d="M3 10v4h4l5 5V5L7 10H3z"/><path d="M16.5 12a3.5 3.5 0 0 0-2-3.16v6.32c1.19-.6 2-1.85 2-3.16z"/><path d="M14.5 4.97v2.06c2.89.86 5 3.54 5 6.97s-2.11 6.11-5 6.97v2.06c4.01-.91 7-4.49 7-9.03s-2.99-8.12-7-9.03z"/>';
    }
  }

  // ---------- format time ----------
  function formatTime(sec) {
    if (!Number.isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // ---------- card click: play / pause / switch ----------
  cards.forEach((card) => {
    card.addEventListener('click', () => {
      const isSameTrack = activeCard === card;

      if (isSameTrack && !audio.paused) {
        audio.pause();
        return;
      }

      if (isSameTrack && audio.paused) {
        audio.play().catch(() => {});
        return;
      }

      loadTrack(card);
      audio.play().catch(() => {});
    });
  });

  function loadTrack(card) {
    if (activeCard) activeCard.classList.remove('is-playing');

    activeCard = card;
    card.classList.add('is-playing');

    const src = card.dataset.audio;
    if (audio.getAttribute('src') !== src) {
      audio.src = src;
    }

    const title = card.dataset.title;
    const subtitle = card.dataset.subtitle;
    const cover = card.dataset.cover;

    playerTitle.textContent = title;
    playerSubtitle.textContent = subtitle;
    playerArt.src = cover;
    playerArt.alt = title;

    playPauseBtn.disabled = false;
    stopBtn.disabled = false;
    progressBar.disabled = false;

    setMediaSession(title, subtitle, cover);
  }

  // ---------- transport controls ----------
  playPauseBtn.addEventListener('click', () => {
    if (!activeCard) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  });

  stopBtn.addEventListener('click', () => {
    if (!activeCard) return;
    audio.pause();
    audio.currentTime = 0;
    activeCard.classList.remove('is-playing');
    activeCard = null;

    playerTitle.textContent = 'Nothing playing';
    playerSubtitle.textContent = 'Choose a room above';
    playerArt.removeAttribute('src');
    playPauseBtn.disabled = true;
    stopBtn.disabled = true;
    progressBar.disabled = true;
    progressBar.value = 0;
    progressCurrent.textContent = '0:00';
    progressTotal.textContent = '0:00';
    playPauseBtn.classList.remove('is-playing');

    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = null;
    }
  });

  // ---------- audio events ----------
  audio.addEventListener('play', () => {
    playPauseBtn.classList.add('is-playing');
    playPauseBtn.setAttribute('aria-label', 'Pause');
    if (activeCard) activeCard.classList.add('is-playing');
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  });

  audio.addEventListener('pause', () => {
    playPauseBtn.classList.remove('is-playing');
    playPauseBtn.setAttribute('aria-label', 'Play');
    if (activeCard) activeCard.classList.remove('is-playing');
    if ('mediaSession' in navigator && activeCard) navigator.mediaSession.playbackState = 'paused';
  });

  audio.addEventListener('loadedmetadata', () => {
    progressBar.max = audio.duration || 0;
    progressTotal.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('timeupdate', () => {
    if (isSeeking) return;
    progressBar.value = audio.currentTime;
    progressCurrent.textContent = formatTime(audio.currentTime);
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && audio.duration) {
      try {
        navigator.mediaSession.setPositionState({
          duration: audio.duration,
          playbackRate: audio.playbackRate,
          position: audio.currentTime,
        });
      } catch (e) { /* ignore */ }
    }
  });

  audio.addEventListener('ended', () => {
    // loop the ambient loop by default so the room keeps running
    audio.currentTime = 0;
    audio.play().catch(() => {});
  });

  progressBar.addEventListener('input', () => {
    isSeeking = true;
    progressCurrent.textContent = formatTime(Number(progressBar.value));
  });

  progressBar.addEventListener('change', () => {
    audio.currentTime = Number(progressBar.value);
    isSeeking = false;
  });

  // ---------- Media Session (lock screen / notification controls) ----------
  function setMediaSession(title, subtitle, cover) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: subtitle,
      album: 'Ambient Hours',
      artwork: [
        { src: cover, sizes: '500x500', type: 'image/jpeg' },
      ],
    });

    navigator.mediaSession.setActionHandler('play', () => audio.play().catch(() => {}));
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('stop', () => stopBtn.click());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime == null) return;
      audio.currentTime = details.seekTime;
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset || 10));
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + (details.seekOffset || 10));
    });
  }

  // ---------- PWA service worker ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
})();
