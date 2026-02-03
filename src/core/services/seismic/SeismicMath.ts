/**
 * SEISMIC MATH UTILS - ELITE EDITION
 * High-performance math operations for signal processing.
 * Optimized for React Native JS thread (Hermes compatible).
 */

/**
 * Circular Buffer for efficient sliding window
 */
export class RingBuffer {
  private buffer: Float32Array;
  private capacity: number;
  private pointer: number = 0;
  private count: number = 0;
  private sum: number = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Float32Array(capacity);
  }

  push(value: number) {
    if (this.count === this.capacity) {
      this.sum -= this.buffer[this.pointer];
    }
    this.buffer[this.pointer] = value;
    this.sum += value;
    this.pointer = (this.pointer + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  getAverage(): number {
    return this.count === 0 ? 0 : this.sum / this.count;
  }

  isFull(): boolean {
    return this.count === this.capacity;
  }

  toArray(): number[] {
    const res = new Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const index = (this.pointer - this.count + i + this.capacity) % this.capacity;
      res[i] = this.buffer[index];
    }
    return res;
  }
}

/**
 * Recursive STA/LTA Algorithm
 * Industry-standard seismic trigger detection.
 */
export class RecursiveSTALTA {
  private sta: number = 0;
  private lta: number = 0;
  private staCoeff: number;
  private ltaCoeff: number;

  constructor(staLen: number, ltaLen: number) {
    this.staCoeff = 1 / staLen;
    this.ltaCoeff = 1 / ltaLen;
  }

  update(value: number): number {
    const sq = value * value;
    this.sta = this.staCoeff * sq + (1 - this.staCoeff) * this.sta;
    this.lta = this.ltaCoeff * sq + (1 - this.ltaCoeff) * this.lta;
    if (this.lta === 0) return 0;
    return this.sta / this.lta;
  }

  reset() {
    this.sta = 0;
    this.lta = 0;
  }
}

/**
 * Simple DFT-based Frequency Analyzer
 * Calculates dominant frequency from signal window.
 * O(N^2) but optimized for small N (32-128 samples).
 */
export class FrequencyAnalyzer {
  private size: number;

  constructor(size: number) {
    this.size = size;
  }

  /**
     * Returns dominant frequency in Hz
     */
  getDominantFrequency(signal: number[], sampleRate: number): number {
    const N = Math.min(signal.length, this.size);
    if (N < 4) return 0;

    let maxMag = 0;
    let maxK = 0;

    // DFT: Check bins 1 to N/2
    for (let k = 1; k < N / 2; k++) {
      let sumReal = 0;
      let sumImag = 0;
      const angleStep = (2 * Math.PI * k) / N;

      for (let n = 0; n < N; n++) {
        const angle = angleStep * n;
        sumReal += signal[n] * Math.cos(angle);
        sumImag -= signal[n] * Math.sin(angle);
      }

      const magnitude = sumReal * sumReal + sumImag * sumImag;
      if (magnitude > maxMag) {
        maxMag = magnitude;
        maxK = k;
      }
    }

    return (maxK * sampleRate) / N;
  }
}

/**
 * Zero Crossing Rate - Fast frequency estimator
 */
/**
 * AIC Picker (Akaike Information Criterion)
 * Precise P-wave onset detection. 
 * Finds the point where the signal statistically changes from noise to signal.
 */
export class AICPicker {
  /**
     * Calculates the AIC function for a signal window.
     * The minimum of the AIC function corresponds to the optimal pick time.
     */
  static pick(signal: number[]): number {
    const N = signal.length;
    if (N < 10) return -1;

    let minAIC = Infinity;
    let pickIndex = -1;

    // Iterate through possible pick points (k)
    // Avoid edges to prevent log(0)
    for (let k = 5; k < N - 5; k++) {
      // Variance of noise (0 to k)
      let varNoise = 0;
      for (let i = 0; i < k; i++) varNoise += signal[i] * signal[i];
      varNoise /= k;
      if (varNoise === 0) varNoise = 0.000001; // Avoid log(0)

      // Variance of signal (k to N)
      let varSignal = 0;
      for (let i = k; i < N; i++) varSignal += signal[i] * signal[i];
      varSignal /= (N - k);
      if (varSignal === 0) varSignal = 0.000001;

      // AIC Calculation (Maeda's approximation)
      // AIC(k) = k * log(varNoise) + (N - k - 1) * log(varSignal)
      const aic = k * Math.log10(varNoise) + (N - k - 1) * Math.log10(varSignal);

      if (aic < minAIC) {
        minAIC = aic;
        pickIndex = k;
      }
    }

    return pickIndex;
  }
}

/**
 * 3D Polarization Analysis (PCA) - ELITE EDITION
 * Distinguishes between P-waves (Rectilinear) and S-waves (Planar).
 * Uses full Jacobi eigenvalue decomposition for exact results.
 */
export class PolarizationAnalyzer {
  /**
     * ELITE: Jacobi Eigenvalue Algorithm for 3x3 Symmetric Matrix
     * Finds eigenvalues of a real symmetric 3x3 matrix using iterative rotation.
     * Returns eigenvalues sorted in descending order [λ1, λ2, λ3].
     * 
     * Input: Covariance matrix elements (xx, yy, zz, xy, xz, yz)
     */
  private static jacobi3x3(
    a11: number, a22: number, a33: number,
    a12: number, a13: number, a23: number,
    maxIterations: number = 50,
    tolerance: number = 1e-10,
  ): [number, number, number] {
    // Working copy of matrix (symmetric, so we store 6 elements)
    let m11 = a11, m22 = a22, m33 = a33;
    let m12 = a12, m13 = a13, m23 = a23;

    for (let iter = 0; iter < maxIterations; iter++) {
      // Find the largest off-diagonal element
      const abs12 = Math.abs(m12);
      const abs13 = Math.abs(m13);
      const abs23 = Math.abs(m23);

      // Check for convergence
      const offDiagMax = Math.max(abs12, abs13, abs23);
      if (offDiagMax < tolerance) break;

      // Choose which off-diagonal element to eliminate
      let p: number, q: number, apq: number, app: number, aqq: number;

      if (abs12 >= abs13 && abs12 >= abs23) {
        // Eliminate m12
        p = 0; q = 1; apq = m12; app = m11; aqq = m22;
      } else if (abs13 >= abs23) {
        // Eliminate m13
        p = 0; q = 2; apq = m13; app = m11; aqq = m33;
      } else {
        // Eliminate m23
        p = 1; q = 2; apq = m23; app = m22; aqq = m33;
      }

      // Calculate rotation angle (Jacobi rotation)
      const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      const c2 = c * c;
      const s2 = s * s;
      const cs = c * s;

      // Apply rotation to matrix elements
      if (p === 0 && q === 1) {
        // Rotating in 1-2 plane
        const new11 = c2 * m11 - 2 * cs * m12 + s2 * m22;
        const new22 = s2 * m11 + 2 * cs * m12 + c2 * m22;
        const new13 = c * m13 - s * m23;
        const new23 = s * m13 + c * m23;
        m11 = new11; m22 = new22; m12 = 0;
        m13 = new13; m23 = new23;
      } else if (p === 0 && q === 2) {
        // Rotating in 1-3 plane
        const new11 = c2 * m11 - 2 * cs * m13 + s2 * m33;
        const new33 = s2 * m11 + 2 * cs * m13 + c2 * m33;
        const new12 = c * m12 - s * m23;
        const new23 = s * m12 + c * m23;
        m11 = new11; m33 = new33; m13 = 0;
        m12 = new12; m23 = new23;
      } else {
        // Rotating in 2-3 plane (p === 1 && q === 2)
        const new22 = c2 * m22 - 2 * cs * m23 + s2 * m33;
        const new33 = s2 * m22 + 2 * cs * m23 + c2 * m33;
        const new12 = c * m12 - s * m13;
        const new13 = s * m12 + c * m13;
        m22 = new22; m33 = new33; m23 = 0;
        m12 = new12; m13 = new13;
      }
    }

    // Eigenvalues are the diagonal elements, sort descending
    const eigenvalues = [m11, m22, m33].sort((a, b) => b - a) as [number, number, number];
    return eigenvalues;
  }

  /**
     * Calculates Rectilinearity and Planarity from 3-component data.
     * x, y, z arrays must be same length.
     * 
     * Rectilinearity: Measures how linear the particle motion is (P-wave = high)
     * Planarity: Measures how planar the motion is (S-wave = high)
     */
  static analyze(x: number[], y: number[], z: number[]): {
        rectilinearity: number;
        planarity: number;
        eigenvalues: [number, number, number];
    } {
    const N = Math.min(x.length, y.length, z.length);
    if (N < 10) return { rectilinearity: 0, planarity: 0, eigenvalues: [0, 0, 0] };

    // 1. Construct Covariance Matrix (3x3)
    let xx = 0, yy = 0, zz = 0, xy = 0, xz = 0, yz = 0;

    // Remove mean for proper covariance calculation
    let meanX = 0, meanY = 0, meanZ = 0;
    for (let i = 0; i < N; i++) {
      meanX += x[i]; meanY += y[i]; meanZ += z[i];
    }
    meanX /= N; meanY /= N; meanZ /= N;

    for (let i = 0; i < N; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      const dz = z[i] - meanZ;
      xx += dx * dx;
      yy += dy * dy;
      zz += dz * dz;
      xy += dx * dy;
      xz += dx * dz;
      yz += dy * dz;
    }

    // Normalize by N-1 for sample covariance
    const norm = 1 / (N - 1);
    xx *= norm; yy *= norm; zz *= norm;
    xy *= norm; xz *= norm; yz *= norm;

    // 2. Compute Eigenvalues using Jacobi method
    const eigenvalues = this.jacobi3x3(xx, yy, zz, xy, xz, yz);
    const [L1, L2, L3] = eigenvalues; // L1 >= L2 >= L3

    // 3. Calculate Rectilinearity and Planarity
    // Formulas from Jurkevics (1988) and Flinn (1965)

    // Rectilinearity: How much energy is in the principal direction
    // R = 1 - (L2 + L3) / (2 * L1)
    // When R = 1, motion is perfectly linear (P-wave)
    // When R = 0, motion is isotropic
    const rectilinearity = L1 > 0 ? 1 - (L2 + L3) / (2 * L1) : 0;

    // Planarity: How much motion is confined to a plane
    // P = 1 - (2 * L3) / (L1 + L2)
    // When P = 1, motion is perfectly planar (S-wave)
    // When P = 0, motion is 3D/isotropic
    const planarity = (L1 + L2) > 0 ? 1 - (2 * L3) / (L1 + L2) : 0;

    return {
      rectilinearity: Math.max(0, Math.min(1, rectilinearity)),
      planarity: Math.max(0, Math.min(1, planarity)),
      eigenvalues,
    };
  }
}
