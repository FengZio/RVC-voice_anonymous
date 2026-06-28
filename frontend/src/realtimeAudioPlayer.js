export class RealtimeAudioPlayer {
  constructor({ targetBufferMs = 1500, crossfadeMs = 30, onStats = () => {} } = {}) {
    this.targetBufferMs = targetBufferMs;
    this.crossfadeMs = crossfadeMs;
    this.onStats = onStats;
    this.context = null;
    this.pending = new Map();
    this.nextChunk = 0;
    this.nextStartTime = 0;
    this.started = false;
    this.dropped = 0;
    this.decoding = 0;
    this.status = 'idle';
  }

  async ensureContext() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContextClass();
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  configure({ targetBufferMs, crossfadeMs } = {}) {
    if (targetBufferMs) {
      this.targetBufferMs = targetBufferMs;
    }
    if (crossfadeMs) {
      this.crossfadeMs = crossfadeMs;
    }
    this.emitStats();
  }

  async enqueue(chunk, audioUrl, latencyMs) {
    if (chunk < this.nextChunk) {
      this.emitStats(latencyMs);
      return;
    }
    await this.ensureContext();
    this.decoding += 1;
    this.status = this.started ? 'playing' : 'buffering';
    this.emitStats(latencyMs);

    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      this.pending.set(chunk, { audioBuffer, latencyMs });
      this.scheduleReadyChunks();
    } finally {
      this.decoding -= 1;
      this.emitStats(latencyMs);
    }
  }

  markDropped(chunk) {
    if (chunk < this.nextChunk) {
      this.emitStats();
      return;
    }
    if (chunk === this.nextChunk) {
      this.nextChunk += 1;
      this.dropped += 1;
      this.scheduleReadyChunks();
    } else {
      this.pending.set(chunk, { dropped: true });
    }
    this.emitStats();
  }

  scheduleReadyChunks() {
    if (!this.context) {
      return;
    }

    while (this.pending.has(this.nextChunk)) {
      const item = this.pending.get(this.nextChunk);
      this.pending.delete(this.nextChunk);
      this.nextChunk += 1;

      if (item.dropped) {
        this.dropped += 1;
        continue;
      }

      this.scheduleBuffer(item.audioBuffer, item.latencyMs);
    }

    this.emitStats();
  }

  scheduleBuffer(audioBuffer, latencyMs) {
    const now = this.context.currentTime;
    if (!this.started) {
      this.nextStartTime = now + this.targetBufferMs / 1000;
      this.started = true;
      this.status = 'buffering';
    }

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = audioBuffer;
    source.connect(gain);
    gain.connect(this.context.destination);

    const fade = Math.min(this.crossfadeMs / 1000, audioBuffer.duration / 4);
    const start = Math.max(this.nextStartTime - fade, now + 0.02);
    const end = start + audioBuffer.duration;

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(1, start + fade);
    gain.gain.setValueAtTime(1, Math.max(start + fade, end - fade));
    gain.gain.linearRampToValueAtTime(0.0001, end);

    source.start(start);
    this.nextStartTime = end;
    this.status = start > now ? 'buffering' : 'playing';
    source.onended = () => {
      if (this.context && this.nextStartTime <= this.context.currentTime + 0.05 && this.pending.size === 0) {
        this.status = 'waiting';
        this.emitStats(latencyMs);
      }
    };
  }

  stop() {
    this.pending.clear();
    this.started = false;
    this.nextChunk = 0;
    this.nextStartTime = 0;
    this.dropped = 0;
    this.decoding = 0;
    this.status = 'idle';
    if (this.context) {
      this.context.close();
      this.context = null;
    }
    this.emitStats();
  }

  emitStats(latencyMs) {
    const now = this.context ? this.context.currentTime : 0;
    const bufferedMs = this.started ? Math.max(0, Math.round((this.nextStartTime - now) * 1000)) : 0;
    this.onStats({
      status: this.status,
      bufferedMs,
      queuedChunks: this.pending.size + this.decoding,
      droppedChunks: this.dropped,
      latencyMs: typeof latencyMs === 'number' ? latencyMs : null,
      nextChunk: this.nextChunk,
    });
  }
}
