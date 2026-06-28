import React, { useEffect, useRef } from 'react';

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

export function RVCBridge({ inputStream, modelName, sessionId, onProcessedStream, onError }) {
  const wsRef = useRef(null);
  const ctxRef = useRef(null);
  const destRef = useRef(null);
  const procRef = useRef(null);
  const mountedRef = useRef(true);
  const chunkIdxRef = useRef(0);

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

    const dest = audioCtx.createMediaStreamDestination();
    destRef.current = dest;

    const source = audioCtx.createMediaStreamSource(inputStream);
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    procRef.current = processor;

    const sid = sessionId || ('rvc-' + Date.now());
    const wsUrl = 'ws://127.0.0.1:7860/api/rvc/stream/' + sid + '?model=' + encodeURIComponent(modelName) + '&transpose=0&f0_method=rmvpe';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      // Connect source to processor for capture only (NOT to dest)
      source.connect(processor);
      // Pass the processed stream handle to parent
      if (onProcessedStream) {
        onProcessedStream(dest.stream);
      }
    };

    processor.onaudioprocess = (event) => {
      if (!mountedRef.current || ws.readyState !== WebSocket.OPEN) return;

      const floatData = event.inputBuffer.getChannelData(0);

      // Skip silent chunks to save bandwidth
      let hasSignal = false;
      for (let i = 0; i < floatData.length; i++) {
        if (Math.abs(floatData[i]) > 0.005) { hasSignal = true; break; }
      }
      if (!hasSignal) return;

      const int16Data = floatTo16BitPcm(floatData);
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

        // Skip 44-byte WAV header
        const pcmLen = (bytes.length - 44) / 2;
        if (pcmLen <= 0) return;

        const int16 = new Int16Array(pcmLen);
        const view = new DataView(bytes.buffer.slice(44));
        for (let i = 0; i < pcmLen; i++) {
          int16[i] = view.getInt16(i * 2, true);
        }

        const floatOut = int16ToFloatPcm(int16);
        const buf = ctxRef.current.createBuffer(1, floatOut.length, 16000);
        buf.getChannelData(0).set(floatOut);

        const bufSrc = ctxRef.current.createBufferSource();
        bufSrc.buffer = buf;
        bufSrc.connect(destRef.current);
        bufSrc.start();
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
      try { wsRef.current && wsRef.current.close(); } catch (_) {}
      try { ctxRef.current && ctxRef.current.close(); } catch (_) {}
    };
  }, [inputStream, modelName, sessionId]);

  // Return a hidden audio element for the processed stream to play through
  return React.createElement('audio', { ref: (el) => { if (el && destRef.current) { el.srcObject = destRef.current.stream; } }, autoPlay: true, style: { display: 'none' } });
}
