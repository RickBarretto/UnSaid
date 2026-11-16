import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePcm } from '../../src/lib/audioAnalysisCore';

describe('audio analysis', () => {
  test('silence has zero waveform and spectrum', () => {
    const result = analyzePcm([new Float32Array(16000)], 16000);
    assert.equal(result.peaks.length, 100);
    assert.ok(result.peaks.every((value) => value === 0));
    assert.ok(result.spectrum.every((value) => value === 0));
  });

  test('a 220 Hz tone produces its peak and expected frequency band', () => {
    const sampleRate = 16000;
    const samples = Float32Array.from({ length: sampleRate }, (_, i) => 0.5 * Math.sin(2 * Math.PI * 220 * i / sampleRate));
    const { peaks, spectrum, columns, bins } = analyzePcm([samples], sampleRate);
    assert.ok(Math.abs(Math.max(...peaks) - 0.5) < 0.001);
    const center = Math.floor(columns / 2);
    const magnitudes = spectrum.subarray(center * bins, (center + 1) * bins);
    const max = Math.max(...magnitudes);
    const strongest = [...magnitudes].map((value, index) => value === max ? index : -1).filter((index) => index >= 0);
    // A 512-sample FFT at 16 kHz resolves the tone around bin 7 (218.75 Hz).
    assert.ok(strongest.some((band) => {
      const low = Math.max(1, Math.floor(Math.pow(256, band / bins)));
      const high = Math.min(256, Math.max(low + 1, Math.ceil(Math.pow(256, (band + 1) / bins))));
      return low <= 7 && 7 < high;
    }), `strongest bands ${strongest} should include FFT bin 7`);
  });

  test('opposite-phase stereo cancels when mixed to mono', () => {
    const left = Float32Array.from({ length: 2048 }, (_, i) => Math.sin(i / 10));
    const right = Float32Array.from(left, (value) => -value);
    const result = analyzePcm([left, right], 16000);
    assert.ok(result.peaks.every((value) => value === 0));
    assert.ok(result.spectrum.every((value) => value === 0));
  });

  test('short samples produce finite bounded output and invalid input fails', () => {
    const result = analyzePcm([new Float32Array([0.25])], 16000);
    assert.equal(result.columns, 1);
    assert.equal(result.bins, 64);
    assert.ok(result.peaks.every(Number.isFinite));
    assert.ok(result.spectrum.every(Number.isFinite));
    assert.throws(() => analyzePcm([], 16000));
    assert.throws(() => analyzePcm([new Float32Array(0)], 16000));
    assert.throws(() => analyzePcm([new Float32Array(1)], 0));
    assert.throws(() => analyzePcm([new Float32Array(1), new Float32Array(2)], 16000));
  });
});
