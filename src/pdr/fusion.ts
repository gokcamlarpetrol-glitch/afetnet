/**
 * Simple complementary filter:
 * - PDR provides relative delta (fast, drift)
 * - Beacons provide sparse absolute fixes (slow, stable)
 */
export type Vec = { x:number; y:number };
export type Fusion = {
  pos: Vec;           // fused position (meters)
  pdrBias: Vec;       // bias correction
};

export class Complementary {
  k: number; // weight of beacon correction (0..1)
  state: Fusion = { pos:{ x:0,y:0 }, pdrBias:{ x:0,y:0 } };

  constructor(k=0.1){ this.k = k; }

  stepPdr(delta: Vec){
    // apply bias-compensated delta
    this.state.pos.x += delta.x - this.state.pdrBias.x;
    this.state.pos.y += delta.y - this.state.pdrBias.y;
  }
  fixBeacon(abs: Vec){
    // move pos slightly toward absolute fix & update bias toward last delta error
    const err = { x: abs.x - this.state.pos.x, y: abs.y - this.state.pos.y };
    this.state.pos.x += this.k * err.x;
    this.state.pos.y += this.k * err.y;
    // Update bias slowly
    this.state.pdrBias.x += 0.01 * err.x;
    this.state.pdrBias.y += 0.01 * err.y;
  }
}



