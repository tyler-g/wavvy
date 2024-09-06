import * as Flac from 'libflacjs/dist/libflac.dev.wasm';

let flac_encoder,
  CHANNELS = 1,
  SAMPLERATE = 44100,
  COMPRESSION = 5,
  BPS = 16,
  flac_ok = true,
  flacLength = 0;

const BUFSIZE = 4096;
const flacBuffers = [];

function write_callback_fn(buffer, bytes) {
  //console.log('flac-chunk!', buffer, bytes);
  self.postMessage({
    cmd: 'flac-chunk',
    buf: buffer,
  });

  flacBuffers.push(buffer);
  flacLength += buffer.byteLength;
}

function mergeBuffersUint8(channelBuffer, recordingLength) {
  const result = new Uint8Array(recordingLength);
  let offset = 0;
  const lng = channelBuffer.length;
  for (let i = 0; i < lng; i++) {
    const buffer = channelBuffer[i];
    result.set(buffer, offset);
    offset += buffer.length;
  }
  return result;
}

function exportFlacFile(recBuffers, recLength) {
  //convert buffers into one single buffer
  const samples = mergeBuffersUint8(recBuffers, recLength);

  console.log('final samples', samples);

  //	var audioBlob = new Blob([samples], { type: type });
  const the_blob = new Blob([samples]);
  return the_blob;
}

/*
 * clear recording buffers
 */
function clear() {
  flacBuffers.splice(0, flacBuffers.length);
  flacLength = 0;
}

function handleInit(e) {
  console.log('init');
  // using FLAC

  if (!e.data.config) {
    e.data.config = {
      bps: BPS,
      channels: CHANNELS,
      samplerate: SAMPLERATE,
      compression: COMPRESSION,
    };
  }

  e.data.config.channels = e.data.config.channels
    ? e.data.config.channels
    : CHANNELS;
  e.data.config.samplerate = e.data.config.samplerate
    ? e.data.config.samplerate
    : SAMPLERATE;
  e.data.config.bps = e.data.config.bps ? e.data.config.bps : BPS;
  e.data.config.compression = e.data.config.compression
    ? e.data.config.compression
    : COMPRESSION;

  ////
  COMPRESSION = e.data.config.compression;
  BPS = e.data.config.bps;
  SAMPLERATE = e.data.config.samplerate;
  CHANNELS = e.data.config.channels;
  ////

  console.log('flac | encoder | settings', {
    COMPRESSION,
    BPS,
    SAMPLERATE,
    CHANNELS,
  });

  // last false is to turn off verify, which checks decoding as it encodes
  // !!! verify can add ~25 ms of latency to encoding (unverified)
  flac_encoder = Flac.create_libflac_encoder(
    SAMPLERATE,
    CHANNELS,
    BPS,
    COMPRESSION as Flac.CompressionLevel,
    0,
    false
  );
  ////
  if (flac_encoder != 0) {
    const status_encoder = Flac.init_encoder_stream(
      flac_encoder,
      write_callback_fn
    );
    //flac_ok &= status_encoder = 0;
    flac_ok = flac_ok && status_encoder == 0;

    console.log('flac | encoder | init | flac_ok', flac_ok);
    console.log('flac | encoder | init | status encoder', status_encoder);

    self.postMessage({ cmd: 'ready' });
  } else {
    console.error('flac | encoder | init | Error initializing the encoder.');
  }
}

function handleEncode(e) {
  const buf_length = e.data.buf.length;
  const buffer_i32 = new Uint32Array(buf_length);
  const view = new DataView(buffer_i32.buffer);
  const volume = 1;
  let index = 0;
  for (let i = 0; i < buf_length; i++) {
    view.setInt32(index, e.data.buf[i] * (0x7fff * volume), true);
    index += 4;
  }

  const flac_return = Flac.FLAC__stream_encoder_process_interleaved(
    flac_encoder,
    buffer_i32,
    buf_length
  );

  if (flac_return != true) {
    console.error(
      'Error: encode_buffer_pcm_as_flac returned false. ' + flac_return
    );
  }
}

function handleFinish() {
  let data;

  flac_ok = flac_ok && Flac.FLAC__stream_encoder_finish(flac_encoder);
  console.log('flac finish: ' + flac_ok);
  //data = exportFlacFile(flacBuffers, flacLength, mergeBuffersUint8);

  clear();

  self.postMessage({
    cmd: 'end',
    buf: data,
  });
}

Flac.on('ready', function (event) {
  const libFlac = event.target;
  console.log(
    'flac | encoder | Flac onready | Flac ready from encoder worker',
    event.target
  );
});

export default (() => {
  self.addEventListener('message', (e) => {
    if (!e) return;
    switch (e.data.cmd) {
      case 'init':
        handleInit(e);
        break;
      case 'encode':
        handleEncode(e);
        break;
      case 'buffer':
        flacBuffers.push(e.data.buf);
        flacLength += e.data.buf.byteLength;
        break;

      case 'finish':
        handleFinish();

        break;
    }
  });
})();
