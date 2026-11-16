/// <reference lib="webworker" />
import { analyzePcm } from './audioAnalysisCore';

self.onmessage = (event: MessageEvent<{ channels: Float32Array[]; sampleRate: number }>) => {
  const { peaks, spectrum, columns, bins } = analyzePcm(event.data.channels, event.data.sampleRate);
  self.postMessage({ peaks, spectrum, columns, bins }, { transfer: [peaks.buffer, spectrum.buffer] });
};
