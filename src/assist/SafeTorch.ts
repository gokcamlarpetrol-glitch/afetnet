// Safe Torch wrapper to prevent crashes when native modules are not available
let Torch: any = null;

try {
  Torch = require('react-native-torch');
} catch (e) {
  console.warn('react-native-torch not available');
}

export const SafeTorch = {
  isAvailable: () => Torch !== null,
  
  switchState: async (state: boolean) => {
    if (!Torch) {
      console.warn('Torch not available, cannot switch state');
      return;
    }
    try {
      await Torch.switchState(state);
    } catch (e) {
      console.warn('Failed to switch torch state:', e);
    }
  }
};



