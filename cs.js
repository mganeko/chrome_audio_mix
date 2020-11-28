// Chrome Audio Mix Extension
//   mganeko https://github.com/mganeko/chrome_audio_mix
//  MIT LICENSE

// TODO
//   - DONE: stopMedia --> release device Audio (mic) 
//   - DONE: startMedia without Audio
//   - DONE: auto play after load
//   - soso: with Google Meet --> switch mix from setting option
//   - select device/audio 

function main() {
  'use strict'
  const PRINT_DEBUG_LOG = true;
  //const PRINT_DEBUG_LOG = false;

  const LANG_TYPE = navigator.language; // en, en-US, ja
  _debuglog('lang=' + LANG_TYPE);

  if (navigator.mediaDevices._getUserMedia !== undefined) return;
  //const video = document.createElement('video');
  //const videoBackground = document.createElement('video');


  // --- ファイル選択GUIを挿入 ---
  function _insertPanel(node) {
    try {
      const html_ja =
        `<div id="gum_panel" style="border: 1px solid blue; position: absolute; left:2px; top:2px;  z-index: 2001; background-color: rgba(192, 250, 192, 0.7);">
          <div><span id="gum_pannel_button">[+]</span><span id="gum_position_button">[_]</span></div>
          <div id="gum_control" style="display: none;">
            <label for="audio_file">Audio File</label>
            <input type="file" accept="audio/*" id="audio_file" />
            <br />
            Audio Gain: <input type="range" id="audio_file_range" min="0" max="100" value="80" step="1"> Max
            &nbsp;&nbsp;
            <input type="checkbox" id="playback_check" checked>Playback</input>
            <br />
            <br />
            Balance: Device <input type="range" id="mix_range" min="0" max="100" value="50" step="1"> Audio File <br />
          </div>
        </div>`;
      const html_en = html_ja;

      if (LANG_TYPE == 'ja') {
        node.insertAdjacentHTML('beforeend', html_ja);
      }
      else {
        node.insertAdjacentHTML('beforeend', html_en);
      }

      node.querySelector('#audio_file').addEventListener('change', (evt) => {
        //loadAudio();
        loadAndPlay();
      }, false);

      node.querySelector('#audio_file_range').addEventListener('change', (evt) => {
        changeAudioFileGain();
      }, false);

      node.querySelector('#mix_range').addEventListener('change', (evt) => {
        changeMixGain();
      }, false);

      //node.querySelector('#play_button').addEventListener('click', (evt) => {
      //  playAudio();
      //}, false);

      node.querySelector('#playback_check').addEventListener('change', (evt) => {
        togglePlayback();
      }, false);

      node.querySelector('#gum_pannel_button').addEventListener('click', (evt) => {
        _debuglog('pannel open/close');
        _openClosePanel();
      }, false);

      node.querySelector('#gum_position_button').addEventListener('click', (evt) => {
        _debuglog('pannel top/bottom');
        _changePanelPositon();
      }, false)
    } catch (e) {
      console.error('_insertPanel() ERROR:', e);
    }
  }

  let panelVisible = false;
  let panelPositionTop = true;
  function _openClosePanel() {
    panelVisible = (!panelVisible);
    if (panelVisible) {
      document.getElementById('gum_control').style.display = 'block';
      document.getElementById('gum_pannel_button').innerText = '[-]';
    }
    else {
      document.getElementById('gum_control').style.display = 'none';
      document.getElementById('gum_pannel_button').innerText = '[+]';
    }
  }

  function _changePanelPositon() {
    panelPositionTop = (!panelPositionTop);
    const pannelDiv = document.getElementById('gum_panel');
    if (panelPositionTop) {
      pannelDiv.style.top = '2px';
      pannelDiv.style.bottom = '';
      document.getElementById('gum_position_button').innerText = '[_]';
    }
    else {
      pannelDiv.style.top = '';
      pannelDiv.style.bottom = '2px';
      document.getElementById('gum_position_button').innerText = '[^]';
    }
  }

  function _replaceGetUserMedia() {
    if (navigator.mediaDevices._getUserMedia) {
      console.warn('ALREADY replace getUserMedia()');
      return;
    }

    _debuglog('replacing GUM');
    _showMessage('replace GUM');

    navigator.mediaDevices._getUserMedia = navigator.mediaDevices.getUserMedia
    navigator.mediaDevices.getUserMedia = _modifiedGetUserMedia;
  }

  function _showMessage(str) {
    const span = document.getElementById('message_span');
    if (span) {
      span.innerHTML = str;
    }
  }

  function _debuglog(var_args) {
    if (PRINT_DEBUG_LOG) {
      console.log(...arguments);
    }
  }


  function _modifiedGetUserMedia(constraints) {
    _debuglog('GUM constraints:', constraints);

    // --- video constraints ---
    const withVideo = !(!constraints.video);

    // --- audio constraints ---
    const withAudio = !(!constraints.audio);

    // --- bypass for desktop capture ---
    if (constraints?.video?.mandatory?.chromeMediaSource === 'desktop') {
      _debuglog('GUM start Desktop Capture');
      _showMessage('use device for Desktop Catpure');
      return navigator.mediaDevices._getUserMedia(constraints);
    }

    // --- start media ---
    if (withAudio) {
      _debuglog('use audio file');
      _showMessage('use audio file');
      return _startMixedStream(constraints);
    }
    else {
      _debuglog('vidoe only. use device');
      _showMessage('vidoe only. use device');
      return navigator.mediaDevices._getUserMedia(constraints);
    }
  }

  function _startMixedStream(constraints) {
    const env = getAudioEnv();
    playbakOff();

    return new Promise((resolve, reject) => {
      navigator.mediaDevices._getUserMedia(constraints)
        .then(stream => {
          env.deviceStream = stream;
          //mixedStream = prepareMixStream(deviceStream, audioSource);
          env.mixedStream = prepareMixStream(env, env.deviceStream, env.audioSourceGain);
          resolve(env.mixedStream);
        })
        .catch(err => {
          console.error('UserMedia ERROR:', err);
          reject(err);
        })
    });
  }


  // -------------- audio ------------------
  const audioEnv = {};
  initAudioEnv(audioEnv);

  // ----

  function initAudioEnv(env) {
    // audioContext
    env.audioContext = null;

    // audio file
    env.audioSourceBuffer = null;
    env.audioSource = null;
    env.audioSourceGain = null;

    // device
    env.deviceStream = null;
    env.deviceSource = null;

    // -- mix --
    env.deviceGain = null;
    env.audioGain = null;
    env.mixedOutput = null;
    env.mixedStream = null;
  }

  function getAudioEnv() {
    return audioEnv;
  }

  function prepareAudioContext(env) {
    if (!env.audioContext) {
      env.audioContext = new AudioContext();
    }

    return env.audioContext;
  }

  function loadAndPlay() {
    const env = getAudioEnv();

    // --- file ---
    const audioFileInput = document.getElementById('audio_file');
    if (audioFileInput.files.length == 0) {
      console.warn('file not selected');
      return;
    }
    const audioFileToPlay = audioFileInput.files[0];
    _debuglog(audioFileToPlay);

    // --- load 
    //disableElement('play_button')
    loadLocalAudio(audioFileToPlay, env).then(buffer => {
      env.audioSourceBuffer = buffer;
      //enabelElement('play_button');
      playAudio();
    }).catch(err => {
      console.error('load audio file ERROR:', err);
    })
  }

  function loadAudio() {
    const env = getAudioEnv();

    // --- file ---
    const audioFileInput = document.getElementById('audio_file');
    if (audioFileInput.files.length == 0) {
      console.warn('file not selected');
      return;
    }
    const audioFileToPlay = audioFileInput.files[0];
    _debuglog(audioFileToPlay);

    // --- load 
    disableElement('play_button')
    loadLocalAudio(audioFileToPlay, env).then(buffer => {
      env.audioSourceBuffer = buffer;
      enabelElement('play_button')
    }).catch(err => {
      console.error('load audio file ERROR:', err);
    })
  }

  function playAudio() {
    const env = getAudioEnv();
    const audioContext = prepareAudioContext(env);
    const source = startAudioNode(env);
    const playbackCheck = document.getElementById('playback_check');
    if (playbackCheck.checked) {
      // モニター用出力
      source.connect(audioContext.destination);
    }
  }

  function togglePlayback() {
    const env = getAudioEnv();
    const audioContext = prepareAudioContext(env);
    const playbackCheck = document.getElementById('playback_check');
    if (playbackCheck.checked) {
      // モニター用出力
      env.audioSourceGain.connect(audioContext.destination);
    }
    else {
      env.audioSourceGain.disconnect(audioContext.destination);
    }
  }

  function playbakOff() {
    const playbackCheck = document.getElementById('playback_check');
    playbackCheck.checked = false;
    const env = getAudioEnv();
    const audioSourceGain = env.audioSourceGain;
    if (audioSourceGain) {
      audioSourceGain.disconnect();
    }
  }

  function changeMixGain() {
    const mixRange = document.getElementById('mix_range');
    const env = getAudioEnv();
    const deviceGain = env.deviceGain;
    const audioGain = env.audioGain;

    const mixValue = mixRange.value;
    if (deviceGain) {
      deviceGain.gain.value = (100 - mixValue) / 100.0;
    }
    if (audioGain) {
      audioGain.gain.value = (mixValue) / 100.0;
    }
  }

  function changeAudioFileGain() {
    const audioFileRange = document.getElementById('audio_file_range');
    const env = getAudioEnv();
    const audioSourceGain = env.audioSourceGain;
    if (audioSourceGain) {
      audioSourceGain.gain.value = (audioFileRange.value / 100.0)
    }
  }

  function startAudioNode(env) {
    // audioSource(aoudoSoruceBuffer) --> audioSourceGain
    // return audioSoruceGain

    const audioContext = prepareAudioContext(env);

    if (!env.audioSourceGain) {
      env.audioSourceGain = audioContext.createGain();
    }
    else {
      // -- すでにAudio再生中の場合は、再生停止、切り離す
      if (env.audioSource) {
        // disconnect
        env.audioSource.disconnect(env.audioSourceGain);
        env.audioSource.stop();
        env.audioSource = null;
      }
    }

    const audioFileRange = document.getElementById('audio_file_range');
    const audioSourceGain = env.audioSourceGain;
    audioSourceGain.gain.value = (audioFileRange.value / 100.0);
    //env.audioSourceGain = audioSourceGain;

    // source を作成
    const audioSource = audioContext.createBufferSource();
    audioSource.buffer = env.audioSourceBuffer;
    audioSource.loop = true;
    audioSource.connect(audioSourceGain);
    // if (env.audioSource) {
    //   // disconnect
    //   env.audioSource.disconnect(env.audioSourceGain);
    //   env.audioSource.stop();
    //   env.audioSource = null;
    // }
    env.audioSource = audioSource;

    // 開始
    audioSource.start(0);

    // 音声ファイルの出力ノードを返す
    return audioSourceGain;
  }

  function loadLocalAudio(file, env) {
    const reader = new FileReader;
    reader.readAsArrayBuffer(file);
    return new Promise((resolve, reject) => {
      reader.onload = function (evt) {
        const audioContext = prepareAudioContext(env);
        _debuglog('reader.onload(), evt:', evt);
        audioContext.decodeAudioData(reader.result)
          .then(buffer => {
            _debuglog('buffer ready');
            resolve(buffer);
          })
          .catch(err => {
            reject(err);
          })
      }
      reader.onloadend = function (evt) {
        _debuglog('reader.onloadend(), evt:', evt);
      }
      reader.onloadstart = function (evt) {
        _debuglog('reader.onloadstart(), evt:', evt);
      }
    })
  }

  function prepareMixStream(env, stream, source) {
    const audioContext = prepareAudioContext(env);
    const mixStream = new MediaStream();

    // --- video track ---
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      mixStream.addTrack(videoTrack);
    }

    // --- audio track ---
    // -- device --
    const deviceSource = audioContext.createMediaStreamSource(stream);
    const deviceGain = audioContext.createGain();
    deviceGain.gain.value = 0.5;
    deviceSource.connect(deviceGain);
    env.deviceSource = deviceSource;
    env.deviceGain = deviceGain;

    // -- audio file --
    const audioGain = audioContext.createGain();
    audioGain.gain.value = 0.5;
    if (source) {
      source.connect(audioGain);
    }
    env.audioGain = audioGain;

    // -- mix --
    const mixedOutput = audioContext.createMediaStreamDestination();
    const mediaStream = mixedOutput.stream;
    deviceGain.connect(mixedOutput);
    audioGain.connect(mixedOutput);
    env.mixedOutput = mixedOutput;

    // ---- new media stream --
    const autioTrack = mediaStream.getAudioTracks()[0];
    if (autioTrack) {
      mixStream.addTrack(autioTrack);

      // -- stop device audio --
      autioTrack._stop = autioTrack.stop;
      autioTrack.stop = function () {
        _debuglog('on webaudio track stop');
        autioTrack._stop();
        stream.getAudioTracks().forEach(track => {
          _debuglog('stop device audio track');
          track.stop();
        });
      };
    }
    else {
      console.error('Mix Audio ERROR');
    }

    return mixStream;
  }

  function playMedia(element, stream, volume = 0) {
    element.srcObject = stream;
    element.play().catch(err => console.error('Media Play Error:', err));
    element.volume = volume;
  }

  function enabelElement(id) {
    let element = document.getElementById(id);
    if (element) {
      element.removeAttribute('disabled');
    }
  }

  function disableElement(id) {
    let element = document.getElementById(id);
    if (element) {
      element.setAttribute('disabled', '1');
    }
  }
  // -------------- audio ------------------

  // -----------------
  _debuglog('cs main()');
  const insertPoint = document.body;
  _insertPanel(insertPoint);
  _replaceGetUserMedia();
}

main()
