'use strict';

// A single native player moves between turns. Nothing loads until a click.
window.turnAudio = (() => {
  const player = document.createElement('audio');
  player.controls = true;
  player.preload = 'none';
  player.className = 'turn-audio-player';
  let active = null;
  let version = 0;

  function sync() {
    if (!active) return;
    const playing = !player.paused && !player.ended;
    active.button.setAttribute('aria-pressed', String(playing));
    active.button.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} audio for ${active.label}`);
    active.button.querySelector('[data-audio-icon]').textContent = playing ? 'Ⅱ' : '▶';
    active.button.querySelector('[data-audio-label]').textContent = playing ? 'Pause' : 'Listen';
  }

  function reset() {
    version++;
    player.pause();
    if (active) {
      active.slot.hidden = true;
      active.status.textContent = '';
      active.article.classList.remove('audio-active');
      sync();
    }
    active = null;
    player.removeAttribute('src');
    player.load();
    player.remove();
  }

  async function toggle(button) {
    if (active?.button === button && !player.paused) {
      player.pause();
      return;
    }
    if (active?.button !== button) {
      reset();
      const article = button.closest('.transcript-turn');
      active = {
        button, article, label: button.dataset.audioName,
        slot: article.querySelector('.turn-audio-slot'),
        status: article.querySelector('.turn-audio-status'),
      };
      active.slot.hidden = false;
      active.slot.prepend(player);
      active.article.classList.add('audio-active');
      player.setAttribute('aria-label', `Audio for ${active.label}`);
      player.src = button.dataset.audio;
    }
    const request = ++version;
    active.status.textContent = '';
    if (player.error) player.load();
    if (player.ended) player.currentTime = 0;
    try {
      await player.play();
    } catch (error) {
      if (request !== version || error.name === 'AbortError') return;
      active.status.textContent = 'Audio unavailable. Tap Listen to retry.';
      sync();
    }
  }

  for (const event of ['play', 'pause', 'ended']) player.addEventListener(event, sync);
  player.addEventListener('error', () => {
    if (active && player.error) {
      active.status.textContent = 'Audio unavailable. Tap Listen to retry.';
      sync();
    }
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-audio]');
    if (button) toggle(button);
  });
  window.addEventListener('pagehide', reset);
  return {reset};
})();
