import * as Flac from 'libflacjs/dist/libflac.dev.wasm';

const BUFSIZE = 4096;
const VERIFY = false;

let flac_decoder;
let flac_ok = true;
let meta_data;
let sample_data;

let flac_return = true;
let current_chunk;
const num_chunks = 0;
let currentDataOffset = 0;
const decData = [];
const flacBuffers = [];
const bufferedInputData = [];
let flacLength = 0;

let decodingPaused = true; //<- add pause flag
let dec_state = 0; //variable for storing current decoding state
const MIN_DATA_DECODE_THRESHOLD = Math.max(1024, BUFSIZE / 2); //<- wait for buffer to have at least THRESHOLD before calling DECODE (again)

function read_callback_fn(bufferSize) {
  console.log(
    'flac | decoder | read_callback_fn',
    bufferSize,
    bufferedInputData
  );

  if (!bufferedInputData.length) {
    return {
      buffer: null,
      readDataLength: 0,
      error: false,
    };
  }

  const size = bufferedInputData[0].buffer.byteLength;

  const start = currentDataOffset;
  const end =
    currentDataOffset === size
      ? -1
      : Math.min(currentDataOffset + bufferSize, size);

  let _buffer;
  let numberOfReadBytes;
  if (end !== -1) {
    _buffer = bufferedInputData[0].subarray(currentDataOffset, end);
    numberOfReadBytes = end - currentDataOffset;

    currentDataOffset = end;
  } else {
    numberOfReadBytes = 0;
  }
  //console.log('numberOfReadBytes', numberOfReadBytes);

  if (numberOfReadBytes < bufferSize) {
    //use next buffered data-chunk for decoding:

    bufferedInputData.shift(); //<- remove first (i.e. active) data-chunk from buffer
    const nextSize =
      bufferedInputData.length > 0 ? bufferedInputData[0].buffer.byteLength : 0;
    currentDataOffset = 0;

    if (nextSize === 0) {
      console.log(
        'flac | decoder | read_callback_fn | setting decodePaused true'
      );
      decodingPaused = true; //<- set pause flag if no more data is available
    }
  }

  return {
    buffer: _buffer,
    readDataLength: numberOfReadBytes,
    error: false,
  };
}

function write_callback_fn(buffer, blockMetadata) {
  // buffer is the decoded audio data, Uint8Array
  // buffer[0] 1st channel, buffer[1] 2nd channel (if exists)
  console.log('flac | decoder | write_callback_fn', blockMetadata, buffer);
  self.postMessage({
    cmd: 'pcm-chunk',
    buf: buffer[0],
  });

  //NOTE: buffer.length === blockMetadata.channels

  if (blockMetadata.channels !== 1)
    console.error(
      'flac | decoder | write_callback_fn | decoded data does not have expected count of channels: expected mono, got ' +
        blockMetadata.channels
    );

  if (!sample_data)
    //store meta-data for sample
    sample_data = blockMetadata;

  //    decData.push(buffer[0]);//<- buffer data for 1st channel (i.e. mono)
  decData.push(buffer[0]); //<- store complete "channels buffer" (for use in exportWavFile())

  console.log('flac | decoder | write_callback_fn | decData', decData);
}

function metadata_callback_fn(data) {
  console.log('flac | decoder | metadata_callback_fn', data);
  meta_data = data;
}

function error_callback_fn(decoder, err, client_data = null) {
  console.error('flac | decoder | error_callback_fn', err);
  //Flac.FLAC__stream_decoder_finish(decoder);
}

function doDecode(forceDecoding = false) {
  if (!decodingPaused) {
    //decoding in progress -> do nothing
    return;
  }

  if (
    !forceDecoding &&
    getBufferSize(bufferedInputData) < MIN_DATA_DECODE_THRESHOLD
  ) {
    //if there is not enough buffered data yet, do wait
    return;
  }

  console.log(
    'flac | decoder | doDecode | about to set decodingPaused=false',
    decodingPaused
  );
  decodingPaused = false;

  //request to decode data chunks until end-of-stream is reached (or decoding is paused):
  while (!decodingPaused && dec_state <= 3 && flac_return != false) {
    flac_return =
      flac_return && Flac.FLAC__stream_decoder_process_single(flac_decoder);
    dec_state = Flac.FLAC__stream_decoder_get_state(flac_decoder);
    console.log('flac | decoder | doDecode | dec_state', dec_state);
    let byteSum = 0;
    flacBuffers.forEach((uint8Arr) => {
      byteSum += uint8Arr.byteLength;
    });
    console.log(
      'flac | decoder | paused | variable state',
      bufferedInputData,
      flacBuffers,
      `${byteSum / 1024 / 1024} MB`,
      decData
    );
  }
}

function getBufferSize(buffer) {
  let size = 0;
  for (let i = buffer.length - 1; i >= 0; --i) {
    size += buffer[i].buffer.byteLength;
  }
  return size;
}

function handleInit(e) {
  flac_decoder = Flac.create_libflac_decoder(VERIFY);
  ////
  if (flac_decoder != 0) {
    const status_decoder = Flac.init_decoder_stream(
      flac_decoder,
      read_callback_fn,
      write_callback_fn,
      error_callback_fn,
      metadata_callback_fn
    );
    flac_ok = flac_ok && status_decoder == 0;

    console.log('flac | decoder | init | flac_ok', flac_ok);
    console.log('flac | decoder | init | status decoder', status_decoder);

    //INIT = true;
  } else {
    console.error('Error initializing the decoder.');
  }
}

function handleDecode(e) {
  // peerjs sends as ArrayBuffer - need to convert to Uint8Array
  console.log('handleDecode', e.data.buf);
  const toUint8 = new Uint8Array(e.data.buf);
  // e.data.buf is the chunk we need to decode, and it must sit until FLAC calls the read callback, after which we must set the data into the supplied buffer and set the bytes pointer
  bufferedInputData.push(toUint8);
  //current_chunk = e.data.buf;
  flacBuffers.push(toUint8);
  flacLength += toUint8.byteLength;
  doDecode();
}

Flac.on('ready', function (event) {
  const libFlac = event.target;
  console.log(
    'flac | decoder | Flac onready | Flac ready from decoder worker',
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
      case 'decode':
        handleDecode(e);
        break;

      case 'finish':
        console.log('finish');

        break;
    }
  });
})();
