const Util = (function () {
  function interleave(
    recBuffers: Uint8Array[][],
    channels: number,
    bitsPerSample: number
  ): Uint8Array {
    let byteLen = bitsPerSample / 8;

    //NOTE 24-bit samples are padded with 1 byte
    const pad8 = bitsPerSample === 24 || bitsPerSample === 8 ? 1 : 0;
    if (pad8) {
      byteLen += pad8;
    }

    //calculate total length for interleaved data
    let dataLength = 0;
    for (let i = 0; i < channels; ++i) {
      dataLength += getLengthFor(recBuffers, i, byteLen, pad8);
    }

    const result = new Uint8Array(dataLength);

    let buff: Uint8Array[],
      buffLen = 0,
      index = 0,
      inputIndex = 0,
      ch_i = 0,
      b_i = 0,
      pad_i: number | boolean = false,
      ord = false;

    for (
      let arrNum = 0, arrCount = recBuffers.length;
      arrNum < arrCount;
      ++arrNum
    ) {
      //for each buffer (i.e. array of Uint8Arrays):
      buff = recBuffers[arrNum];
      buffLen = buff[0].length;
      inputIndex = 0;
      pad_i = false;
      ord = false;

      //interate over buffer
      while (inputIndex < buffLen) {
        //write channel data
        for (ch_i = 0; ch_i < channels; ++ch_i) {
          //write sample-length
          for (b_i = 0; b_i < byteLen; ++b_i) {
            // write data & update target-index
            if (pad8) {
              pad_i = pad8 && b_i === byteLen - pad8;
              if (pad_i) {
                if (
                  buff[ch_i][inputIndex + b_i] !== 0 &&
                  buff[ch_i][inputIndex + b_i] !== 255
                ) {
                  console.error(
                    '[ERROR] mis-aligned padding: ignoring non-padding value (padding should be 0 or 255) at ' +
                      (inputIndex + b_i) +
                      ' -> ',
                    buff[ch_i][inputIndex + b_i]
                  );
                }
              } else {
                if (bitsPerSample === 8) {
                  ord = buff[ch_i][inputIndex + b_i + 1] === 0;
                  result[index++] = ord
                    ? buff[ch_i][inputIndex + b_i] | 128
                    : buff[ch_i][inputIndex + b_i] & 127;
                } else {
                  result[index++] = buff[ch_i][inputIndex + b_i];
                }
              }
            } else {
              result[index++] = buff[ch_i][inputIndex + b_i];
            }
          }
        }
        //update source-index
        inputIndex += byteLen;
      }
    }
    return result;
  }

  /**
   * creates blob element PCM audio data incl. WAV header
   *
   * @param recBuffers
   * 			the array of buffered audio data, where each entry contains an array for the channels, i.e.
   * 			recBuffers[0]: [channel_1_data, channel_2_data, ..., channel_n_data]
   * 			recBuffers[1]: [channel_1_data, channel_2_data, ..., channel_n_data]
   * 			...
   * 			recBuffers[length-1]: [channel_1_data, channel_2_data, ..., channel_n_data]
   *
   * @returns blob with MIME type audio/wav
   */
  function exportWavFile(
    recBuffers: Uint8Array[][],
    sampleRate: number,
    channels: number,
    bitsPerSample: number
  ): Blob {
    //convert buffers into one single buffer
    console.log('buffers before interlave', recBuffers);
    const samples = interleave(recBuffers, channels, bitsPerSample);
    console.log('samples after interlave', samples);
    const dataView = encodeWAV(samples, sampleRate, channels, bitsPerSample);
    return new Blob([dataView], { type: 'audio/wav' });
  }

  function getLengthFor(
    recBuffers: Uint8Array[][],
    index: number,
    sampleBytes: number,
    bytePadding: number
  ) {
    let recLength = 0,
      blen;
    const decrFac = bytePadding > 0 ? bytePadding / sampleBytes : 0; //<- factor do decrease size in case of padding bytes
    for (let i = recBuffers.length - 1; i >= 0; --i) {
      blen = recBuffers[i][index].byteLength;
      if (bytePadding > 0) {
        recLength += blen - decrFac * blen;
      } else {
        recLength += blen;
      }
    }
    return recLength;
  }

  /**
   * write PCM data to a WAV file, incl. header
   *
   * @param samples the PCM audio data
   * @param sampleRate the sample rate for the audio data
   * @param channels the number of channels that the audio data contains
   * @param bitsPerSample the bit-per-sample
   *
   * @returns the WAV data incl. header
   */
  function encodeWAV(
    samples: Uint8Array,
    sampleRate: number,
    channels: number,
    bitsPerSample: number
  ): DataView {
    const bytePerSample = bitsPerSample / 8;
    const length = samples.length * samples.BYTES_PER_ELEMENT;

    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 36 + length, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, 1, true);
    /* channel count */
    view.setUint16(22, channels, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * channels * bytePerSample, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, channels * bytePerSample, true);
    /* bits per sample */
    view.setUint16(34, bitsPerSample, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, length, true);

    writeData(view, 44, samples);

    return view;
  }

  /**
   *
   * @param view {DataView}
   * 				the buffer into which the MD5 checksum will be written
   * @param offset {Number}
   * 				the byte offset in the buffer, at which the checksum will be written
   * @param str {String} the MD5 checksum as HEX formatted string with length 32 (i.e. each HEX number has length 2)
   */
  function writeMd5(view, offset, str) {
    let index;
    for (let i = 0; i < str.length / 2; ++i) {
      index = i * 2;
      view.setUint8(i + offset, parseInt(str.substring(index, index + 2), 16));
    }
  }

  function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  function writeData(view: DataView, offset: number, input: Uint8Array) {
    for (let i = 0; i < input.length; ++i, ++offset) {
      view.setUint8(offset, input[i]);
    }
  }

  /**
   *  create A-element for data BLOB and trigger download
   */
  function forceDownload(blob, filename) {
    const link = getDownloadLink(blob, filename, true);
    //NOTE: FireFox requires a MouseEvent (in Chrome a simple Event would do the trick)
    const click = document.createEvent('MouseEvent');
    click.initMouseEvent(
      'click',
      true,
      true,
      window,
      0,
      0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      0,
      null
    );
    link.dispatchEvent(click);
  }

  /**
   *  create A-element for data BLOB
   */
  function getDownloadLink(blob, filename, omitLinkLabel = false) {
    const name = filename || 'output.wav';
    const url = (window.URL || window.webkitURL).createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = name;
    if (!omitLinkLabel) {
      link.textContent = name;
    }
    return link;
  }
  function float32ToUint8(float32Array) {
    const uint8Array = new Uint8Array(float32Array.buffer);
    return uint8Array;
  }

  // Returns Uint8Array of WAV bytes
  function getWavBytes(buffer, options) {
    const type = options.isFloat ? Float32Array : Uint16Array;
    const numFrames = buffer.byteLength / type.BYTES_PER_ELEMENT;

    const headerBytes = getWavHeader(Object.assign({}, options, { numFrames }));
    const wavBytes = new Uint8Array(headerBytes.length + buffer.byteLength);

    // prepend header, then add pcmBytes
    wavBytes.set(headerBytes, 0);
    wavBytes.set(new Uint8Array(buffer), headerBytes.length);

    return wavBytes;
  }

  // adapted from https://gist.github.com/also/900023
  // returns Uint8Array of WAV header bytes
  function getWavHeader(options) {
    const numFrames = options.numFrames;
    const numChannels = options.numChannels || 2;
    const sampleRate = options.sampleRate || 44100;
    const bytesPerSample = options.isFloat ? 4 : 2;
    const format = options.isFloat ? 3 : 1;

    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numFrames * blockAlign;

    const buffer = new ArrayBuffer(44);
    const dv = new DataView(buffer);

    let p = 0;

    function writeString(s) {
      for (let i = 0; i < s.length; i++) {
        dv.setUint8(p + i, s.charCodeAt(i));
      }
      p += s.length;
    }

    function writeUint32(d) {
      dv.setUint32(p, d, true);
      p += 4;
    }

    function writeUint16(d) {
      dv.setUint16(p, d, true);
      p += 2;
    }

    writeString('RIFF'); // ChunkID
    writeUint32(dataSize + 36); // ChunkSize
    writeString('WAVE'); // Format
    writeString('fmt '); // Subchunk1ID
    writeUint32(16); // Subchunk1Size
    writeUint16(format); // AudioFormat https://i.sstatic.net/BuSmb.png
    writeUint16(numChannels); // NumChannels
    writeUint32(sampleRate); // SampleRate
    writeUint32(byteRate); // ByteRate
    writeUint16(blockAlign); // BlockAlign
    writeUint16(bytesPerSample * 8); // BitsPerSample
    writeString('data'); // Subchunk2ID
    writeUint32(dataSize); // Subchunk2Size

    return new Uint8Array(buffer);
  }

  function mergeFloat32Arrays(float32Arrays) {
    // Calculate total length for the new Float32Array
    const totalLength = float32Arrays.reduce((sum, arr) => sum + arr.length, 0);

    // Create a new Float32Array with the total length
    const result = new Float32Array(totalLength);

    // Copy each Float32Array into the new array
    let offset = 0;
    float32Arrays.forEach((arr) => {
      result.set(arr, offset);
      offset += arr.length;
    });

    return result;
  }
  return {
    exportWavFile,
    getDownloadLink,
    float32ToUint8,
    getWavBytes,
    mergeFloat32Arrays,
  };
})();

if (typeof self !== 'undefined' && self !== null) {
  //eslint-disable-next-line
  //@ts-ignore
  self.Util = Util; // make Util accessible to other webworker scripts.
}

self.addEventListener('message', (e) => {
  if (!e) return;
  let wavBlob;
  let convertedArr;
  let wavBytes;
  let wav;
  let mergedFloat32Arr;
  switch (e.data.cmd) {
    case 'passthrough':
      self.postMessage({
        cmd: 'passthrough',
        pcm: e.data.pcm,
      });
      convertedArr = Util.float32ToUint8(e.data.pcm);
      self.postMessage({
        cmd: 'passthrough-uint8',
        pcm: convertedArr,
      });
      break;
    case 'export-wav':
      console.log('exporter worker received export-wav', e.data.buf);
      wavBlob = Util.exportWavFile(e.data.buf, 44100, 1, 16);
      self.postMessage({
        cmd: 'wav-blob',
        wav: wavBlob,
      });

      break;
    case 'export-wav2':
      console.log('exporter worker received export-wav2', e.data.buf);
      mergedFloat32Arr = Util.mergeFloat32Arrays(e.data.buf);
      // get WAV file bytes and audio params of your audio source
      wavBytes = Util.getWavBytes(mergedFloat32Arr.buffer, {
        isFloat: true, // floating point or 16-bit integer
        numChannels: 1,
        sampleRate: 44100,
      });
      wav = new Blob([wavBytes], { type: 'audio/wav' });
      self.postMessage({
        cmd: 'wav-blob',
        wav: wav,
      });
      break;
  }
});
