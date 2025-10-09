// IMA ADPCM encoder for voice ping compression
// Based on IMA ADPCM algorithm for 8kHz mono audio

export class ADPCMEncoder {
  private stepIndex: number = 0;
  private prevSample: number = 0;

  constructor() {
    this.reset();
  }

  reset() {
    this.stepIndex = 0;
    this.prevSample = 0;
  }

  encode(pcmData: Int16Array): Uint8Array {
    const stepTable = [
      7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31,
      34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143,
      157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658,
      724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024,
      3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899,
      15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767
    ];

    const indexTable = [
      -1, -1, -1, -1, 2, 4, 6, 8,
      -1, -1, -1, -1, 2, 4, 6, 8
    ];

    const output: number[] = [];
    
    for (let i = 0; i < pcmData.length; i++) {
      const sample = pcmData[i];
      
      // Calculate difference
      const diff = sample - this.prevSample;
      
      // Get step size
      const step = stepTable[this.stepIndex];
      
      // Calculate step
      const stepSize = step / 8;
      
      // Calculate predicted value
      let predicted = this.prevSample;
      if (diff < 0) {
        predicted -= stepSize;
      } else {
        predicted += stepSize;
      }
      
      // Clamp predicted value
      predicted = Math.max(-32768, Math.min(32767, predicted));
      
      // Calculate error
      const error = sample - predicted;
      
      // Calculate code (4-bit ADPCM code)
      let code = 0;
      if (error < -stepSize * 2) code = 8;
      else if (error < -stepSize) code = 4;
      else if (error < 0) code = 2;
      else if (error < stepSize) code = 0;
      else if (error < stepSize * 2) code = 1;
      else if (error < stepSize * 4) code = 3;
      else if (error < stepSize * 8) code = 5;
      else code = 7;
      
      // Update step index
      this.stepIndex += indexTable[code];
      this.stepIndex = Math.max(0, Math.min(88, this.stepIndex));
      
      // Update previous sample
      this.prevSample = predicted;
      
      output.push(code);
    }
    
    // Convert to bytes (2 codes per byte)
    const bytes = new Uint8Array(Math.ceil(output.length / 2));
    for (let i = 0; i < output.length; i += 2) {
      const byte1 = output[i];
      const byte2 = output[i + 1] || 0;
      bytes[i / 2] = (byte1 & 0x0F) | ((byte2 & 0x0F) << 4);
    }
    
    return bytes;
  }
}

export function encodePCMToADPCM(pcmData: Int16Array): Uint8Array {
  const encoder = new ADPCMEncoder();
  return encoder.encode(pcmData);
}

export function estimateCompressionRatio(originalSize: number): number {
  // ADPCM typically achieves ~4:1 compression ratio for 16-bit PCM
  return originalSize / 4;
}

export function createVoiceChunks(adpcmData: Uint8Array, chunkSize: number = 1024): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  
  for (let i = 0; i < adpcmData.length; i += chunkSize) {
    const chunk = adpcmData.slice(i, i + chunkSize);
    chunks.push(chunk);
  }
  
  return chunks;
}
