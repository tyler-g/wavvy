/* global currentTime */

const SMOOTHING_FACTOR = 0.8;
const FRAME_PER_SECOND = 60;
const FRAME_INTERVAL = 1 / FRAME_PER_SECOND;

/**
 *  Measure microphone volume.
 *
 * @class PcmProcessor
 * @extends AudioWorkletProcessor
 */
class PcmProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this._lastUpdate = currentTime;
    this._volume = 0;

    const { encoderWorker } = options.processorOptions;
    console.log('pcm constructor', encoderWorker);
  }

  // when returning, use true, because false will cause process() to stop running
  process(inputs) {
    if (!inputs || inputs[0].length === 0) return true;
    const inputChannelData = inputs[0][0]; // left channel

    // only post message to main thread if there's data
    this.port.postMessage(inputChannelData);

    // Post a message to the node every 16ms.
    if (currentTime - this._lastUpdate > FRAME_INTERVAL) {
      //this.port.postMessage(this._db);
      this._lastUpdate = currentTime;
    }

    return true;
  }
}

registerProcessor('pcm-processor', PcmProcessor);
