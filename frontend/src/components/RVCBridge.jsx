import React, { useEffect, useRef } from 'react';
import { websocketUrl } from '../constants.js';

function createWavHeader(sampleRate, numSamples) {
  const byteRate = sampleRate * 2;
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  writeStr(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(view, 8, 'WAVE');
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  return buffer;
}

function writeStr(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function floatTo16BitPcm(input) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output;
}

function int16ToFloatPcm(input) {
  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    output[i] = input[i] / (input[i] < 0 ? 0x8000 : 0x7FFF);
  }
  return output;
}

function parseWavPcm(bytes) {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3],
    );
    const chunkSize = view.getUint32(offset + 4, true);
    const dataStart = offset + 8;
    if (chunkId === 'data') {
      return { sampleRate, bitsPerSample, dataStart, dataSize: chunkSize };
    }
    offset = dataStart + chunkSize + (chunkSize % 2);
  }
  return null;
}

export function RVCBridge({
  inputStream,
  modelName,
  sessionId,
  chunkMs = 1600,
  silenceThreshold = 0.003,
  outputVolume = 1,
  onProcessedStream,
  onError,
  onChunkStats,
}) {
  const wsRef = useRef(null);
  const ctxRef = useRef(null);
  const destRef = useRef(null);
  const procRef = useRef(null);
  const silentGainRef = useRef(null);
  const outputGainRef = useRef(null);
  const mountedRef = useRef(true);
  const chunkIdxRef = useRef(0);
  const pendingFramesRef = useRef([]);
  const pendingSamplesRef = useRef(0);
  const nextPlayTimeRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!inputStream || !modelName) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const sampleRate = 16000;
    const audioCtx = new AudioCtx({ sampleRate });
    ctxRef.current = audioCtx;
    nextPlayTimeRef.current = 0;
    pendingFramesRef.current = [];
    pendingSamplesRef.current = 0;

    const dest = audioCtx.createMediaStreamDestination();
    const outputGain = audioCtx.createGain();
    outputGain.gain.value = outputVolume;
    outputGain.connect(dest);
    destRef.current = dest;
    outputGainRef.current = outputGain;

    const source = audioCtx.createMediaStreamSource(inputStream);
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    const silentGain = audioCtx.createGain();
    silentGain.gain.value = 0;
    procRef.current = processor;
    silentGainRef.current = silentGain;

    const sid = sessionId || ('rvc-' + Date.now());
    const wsUrl = websocketUrl('/api/rvc/stream/' + sid + '?model=' + encodeURIComponent(modelName) + '&transpose=0&f0_method=rmvpe');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      audioCtx.resume().catch(() => {});
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioCtx.destination);
      if (onProcessedStream) {
        onProcessedStream(dest.stream);
      }
    };

    processor.onaudioprocess = (event) => {
      if (!mountedRef.current || ws.readyState !== WebSocket.OPEN) return;

      const floatData = event.inputBuffer.getChannelData(0);
      const frame = new Float32Array(floatData);
      pendingFramesRef.current.push(frame);
      pendingSamplesRef.current += frame.length;

      const targetSamples = Math.max(4096, Math.round(audioCtx.sampleRate * chunkMs / 1000));
      if (pendingSamplesRef.current < targetSamples) return;

      const chunkData = new Float32Array(pendingSamplesRef.current);
      let offset = 0;
      pendingFramesRef.current.forEach((item) => {
        chunkData.set(item, offset);
        offset += item.length;
      });
      pendingFramesRef.current = [];
      pendingSamplesRef.current = 0;

      let hasSignal = false;
      let peak = 0;
      for (let i = 0; i < chunkData.length; i++) {
        const value = Math.abs(chunkData[i]);
        if (value > peak) peak = value;
        if (value > silenceThreshold) hasSignal = true;
      }
      if (onChunkStats) {
        onChunkStats({ peak, samples: chunkData.length, durationMs: Math.round(chunkData.length / audioCtx.sampleRate * 1000) });
      }
      if (!hasSignal) return;

      const int16Data = floatTo16BitPcm(chunkData);
      const header = createWavHeader(audioCtx.sampleRate, int16Data.length);
      const wav = new Uint8Array(header.byteLength + int16Data.byteLength);
      wav.set(new Uint8Array(header), 0);
      wav.set(new Uint8Array(int16Data.buffer), header.byteLength);

      let binary = '';
      for (let i = 0; i < wav.length; i++) {
        binary += String.fromCharCode(wav[i]);
      }

      const idx = chunkIdxRef.current++;
      ws.send(JSON.stringify({ type: 'chunk', index: idx, data: btoa(binary) }));
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current || !ctxRef.current || !destRef.current) return;

      try {
        const msg = JSON.parse(event.data);
        if (msg.type !== 'chunk' || msg.status !== 'ok' || !msg.data) return;

        const binary = atob(msg.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const wav = parseWavPcm(bytes);
        if (!wav || wav.bitsPerSample !== 16) return;

        const pcmLen = Math.floor(Math.min(wav.dataSize, bytes.length - wav.dataStart) / 2);
        if (pcmLen <= 0) return;
        const int16 = new Int16Array(pcmLen);
        const view = new DataView(bytes.buffer, bytes.byteOffset + wav.dataStart, pcmLen * 2);
        for (let i = 0; i < pcmLen; i++) {
          int16[i] = view.getInt16(i * 2, true);
        }

        const floatOut = int16ToFloatPcm(int16);
        const buf = ctxRef.current.createBuffer(1, floatOut.length, wav.sampleRate || ctxRef.current.sampleRate);
        buf.getChannelData(0).set(floatOut);

        const bufSrc = ctxRef.current.createBufferSource();
        bufSrc.buffer = buf;
        bufSrc.connect(outputGainRef.current || destRef.current);
        const startAt = Math.max(ctxRef.current.currentTime + 0.04, nextPlayTimeRef.current || 0);
        bufSrc.start(startAt);
        nextPlayTimeRef.current = startAt + buf.duration;
      } catch (_) {}
    };

    ws.onerror = () => {
      if (mountedRef.current && onError) {
        onError('RVC 流连接失败');
      }
    };

    ws.onclose = () => {
      if (mountedRef.current && onError) {
        onError('RVC 流已断开');
      }
    };

    return () => {
      try { procRef.current && procRef.current.disconnect(); } catch (_) {}
      try { silentGainRef.current && silentGainRef.current.disconnect(); } catch (_) {}
      try { outputGainRef.current && outputGainRef.current.disconnect(); } catch (_) {}
      try { wsRef.current && wsRef.current.close(); } catch (_) {}
      try { ctxRef.current && ctxRef.current.close(); } catch (_) {}
    };
  }, [inputStream, modelName, sessionId, chunkMs, silenceThreshold, outputVolume]);

  // Return a hidden audio element for the processed stream to play through
  return React.createElement('audio', { ref: (el) => { if (el && destRef.current) { el.srcObject = destRef.current.stream; } }, autoPlay: true, style: { display: 'none' } });
}
