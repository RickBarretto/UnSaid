import type { AudioAnalysis } from './mediaAnalysis';

export function analyzePcm(channels: Float32Array[], sampleRate: number): AudioAnalysis {
  if (!channels.length || !channels[0].length || !Number.isFinite(sampleRate) || sampleRate <= 0 || channels.some((channel) => channel.length !== channels[0].length)) {
    throw new Error('Invalid audio samples or sample rate.');
  }
  const samples = new Float32Array(channels[0].length);
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) samples[i] += channel[i] / channels.length;
  }
  const peakCount = Math.max(1, Math.min(200_000, Math.ceil(samples.length / sampleRate * 100)));
  const peaks = new Float32Array(peakCount);
  for (let column = 0; column < peakCount; column++) {
    const start = Math.floor(column * samples.length / peakCount);
    const end = Math.floor((column + 1) * samples.length / peakCount);
    let peak = 0;
    for (let i = start; i < end; i++) peak = Math.max(peak, Math.abs(samples[i]));
    peaks[column] = peak;
  }

  const size = 512;
  const bins = 64;
  const columns = Math.max(1, Math.min(1600, Math.ceil(samples.length / (size / 2))));
  const spectrum = new Uint8Array(columns * bins);
  const real = new Float32Array(size);
  const imaginary = new Float32Array(size);
  const window = Float32Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)));

  for (let column = 0; column < columns; column++) {
    const center = Math.floor((column + 0.5) * samples.length / columns);
    for (let i = 0; i < size; i++) {
      const index = center + i - size / 2;
      real[i] = (index >= 0 && index < samples.length ? samples[index] : 0) * window[i];
      imaginary[i] = 0;
    }
    // In-place radix-2 FFT, with bit-reversed input.
    for (let i = 1, j = 0; i < size; i++) {
      let bit = size >> 1;
      while (j & bit) { j ^= bit; bit >>= 1; }
      j ^= bit;
      if (i < j) { const value = real[i]; real[i] = real[j]; real[j] = value; }
    }
    for (let width = 2; width <= size; width *= 2) {
      const half = width / 2;
      for (let start = 0; start < size; start += width) {
        for (let k = 0; k < half; k++) {
          const angle = -2 * Math.PI * k / width;
          const cosine = Math.cos(angle), sine = Math.sin(angle);
          const right = start + k + half, left = start + k;
          const re = real[right] * cosine - imaginary[right] * sine;
          const im = real[right] * sine + imaginary[right] * cosine;
          real[right] = real[left] - re; imaginary[right] = imaginary[left] - im;
          real[left] += re; imaginary[left] += im;
        }
      }
    }
    // Logarithmic frequency bands from about 31 Hz to Nyquist, in dBFS.
    for (let band = 0; band < bins; band++) {
      const low = Math.max(1, Math.floor(Math.pow(size / 2, band / bins)));
      const high = Math.min(size / 2, Math.max(low + 1, Math.ceil(Math.pow(size / 2, (band + 1) / bins))));
      let magnitude = 0;
      for (let i = low; i < high; i++) magnitude = Math.max(magnitude, Math.hypot(real[i], imaginary[i]) * 4 / size);
      const db = 20 * Math.log10(Math.max(magnitude, 1e-6));
      spectrum[column * bins + band] = Math.round(Math.max(0, Math.min(1, (db + 80) / 80)) * 255);
    }
  }
  return { peaks, spectrum, columns, bins };
}
