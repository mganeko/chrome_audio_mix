// Chrome Audio Mix Extension
//   mganeko https://github.com/mganeko/chrome_audio_mix
//  MIT LICENSE


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
            <button id="play_button" disabled>play</button>
            <br />
            Audio Gain: <input type="range" id="audio_file_range" min="0" max="100" value="80" step="1"> Max
            &nbsp;&nbsp;
            <input type="checkbox" id="playback_check" checked>Playback</input>
            <br />
            <br />
            Balance: Device <input type="range" id="mix_range" min="0" max="100" value="50" step="1"> File <br />
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
        loadAudio();
      }, false);

      node.querySelector('#audio_file_range').addEventListener('change', (evt) => {
        changeAudioFileGain();
      }, false);

      node.querySelector('#mix_range').addEventListener('change', (evt) => {
        changeMixGain();
      }, false);

      node.querySelector('#play_button').addEventListener('click', (evt) => {
        playAudio();
      }, false);

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
    if (constraints.video) {
      _setupCanvasSize(constraints);
    }

    // --- audio constraints ---
    const withAudio = !(!constraints.audio);

    // --- bypass for desktop capture ---
    if (constraints?.video?.mandatory?.chromeMediaSource === 'desktop') {
      if (select?.value === 'mask_meet_display') {
        // -- overlay person on google meet desplay --
        _showMessage('use bodypix (overlay meet display)');
        _bodypix_setMask('overlay_meet_display');
        return _startMeetDisplayOverlayStream(withVideo, withAudio, constraints);
      }
      else {
        _debuglog('GUM start Desktop Capture');
        _showMessage('use device for Desktop Catpure');
        return navigator.mediaDevices._getUserMedia(constraints);
      }
    }

    // --- start media ---
    if (select?.value === 'file') {
      _showMessage('use audio file');
      return _startVideoFileStream(withVideo, withAudio);
    }
    else {
      _showMessage('use device');
      return navigator.mediaDevices._getUserMedia(constraints);
    }
  }

  function _startVideoFileStream(withVideo, withAudio) {
    return new Promise((resolve, reject) => {
      video.play()
        .then(() => {
          const stream = video.captureStream();
          if (!stream) { reject('video Capture ERROR'); }

          if ((!withVideo) && (stream.getVideoTracks().length > 0)) {
            // remove video track
            _debuglog('remove video track from video');
            const videoTrack = stream.getVideoTracks()[0];
            stream.removeTrack(videoTrack);
            videoTrack.stop();
          }

          if ((!withAudio) && (stream.getAudioTracks().length > 0)) {
            // remove audio track
            _debuglog('remove audio track from video');
            const audioTrack = stream.getAudioTracks()[0];
            stream.removeTrack(audioTrack);
            audioTrack.stop();
          }

          resolve(stream);
        }).
        catch(err => reject(err));
    });
  }


  // --- meet用 ---
  // Google Meet 用
  //  - gUM with chromeMediaSource === 'desktop'
  //  - gUM with device video (if not yet)
  //    - if device video already exist, clone? (TODO)
  //  - same as DisplayOverlayStream
  function _startMeetDisplayOverlayStream(withVideo, withAudio, constraints) {
    _debuglog('Google Meet Diplay Overlay')

    // -- temp ---
    //return _startDisplayOverlayStream(withVideo, withAudio, constraints);


    _bodyPixMask = null;
    _backPixMask = null;

    return new Promise((resolve, reject) => {
      if (!withVideo) {
        // NEED video
        reject('NEED video for Boxypix mask');
      }
      if (constraints?.video?.mandatory?.chromeMediaSource !== 'desktop') {
        // NOT Google Meet
        reject('NOT using Google Meet');
      }
      if (withAudio) {
        _debuglog('WARN: with Audio NOT Supported correctly');
      }

      // TODO support using video already
      if (video.srcObject) {
        _debuglog('WARN: ALREADY using Device video. NOT working corrent');
      }

      // --- withVideo ---
      const constraintsForCamera = { video: true, audio: false };
      navigator.mediaDevices._getUserMedia(constraintsForCamera).
        then(async (deviceStream) => {
          _debuglog('got device stream');

          // --- device stream and videoPix
          //stream = deviceStream;
          video.srcObject = deviceStream;
          video.onloadedmetadata = () => {
            _debuglog('loadedmetadata videoWidht,videoHeight', video.videoWidth, video.videoHeight);
            video.width = video.videoWidth;
            video.height = video.videoHeight;
            img.width = video.width;
            img.height = video.height;
            //canvas.width = video.width;
            //canvas.height = video.height;
          }
          await video.play().catch(err => console.error('local play ERROR:', err));
          video.volume = 0.0;

          // ---- screen stream for google meet---
          _debuglog('getting display stream');
          const displayStream = await navigator.mediaDevices._getUserMedia(constraints).catch(err => {
            debuglog('get display stream ERROR');
            video.pause();
            deviceStream.getTracks().forEach(track => track.stop());
            reject('display Capture ERROR');
          });
          _debuglog('got display stream');
          videoBackground.srcObject = displayStream;
          videoBackground.onloadedmetadata = () => {
            _debuglog('videoBackground loadedmetadata videoWidht,videoHeight', videoBackground.videoWidth, videoBackground.videoHeight);
            videoBackground.width = videoBackground.videoWidth;
            videoBackground.height = videoBackground.videoHeight;
            //img.width = video.width;
            //img.height = video.height;
            canvas.width = videoBackground.width;
            canvas.height = videoBackground.height;
          }
          await videoBackground.play().catch(err => console.error('videoBackground play ERROR:', err));
          videoBackground.volume = 0.0;

          // ----- canvas stream ----
          _clearCanvas();
          requestAnimationFrame(_updateCanvasWithMask);
          const canvasStream = canvas.captureStream(10);
          if (!canvasStream) {
            reject('canvas Capture ERROR');
          }
          keepAnimation = true;
          _bodypix_updateSegment();
          const videoTrack = canvasStream.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack._stop = videoTrack.stop;
            videoTrack.stop = function () {
              _debuglog('camvas stream stop');
              keepAnimation = false;
              videoTrack._stop();
              _debuglog('stop device track');
              deviceStream.getTracks().forEach(track => {
                track.stop();
              });
              _debuglog('stop display track');
              displayStream.getTracks().forEach(track => {
                track.stop();
              });
            };
          }

          // --- for audio ---
          if (withAudio) {
            // TODO : NOT supported yet
            _debuglog('WARN: display meet overlay with audio');
            // must use audio.mandatory.chromeMediaSource.system
            const audioTrack = displayStream.getAudioTracks()[0];
            if (audioTrack) {
              canvasStream.addTrack(audioTrack);
            }
            else {
              _debuglog('WARN: NO audio in Display stream');
            }

          }

          resolve(canvasStream);
        })
        .catch(err => {
          reject(err);
        });
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
    if (! env.audioContext) {
      env.audioContext = new AudioContext();
    }

    return env.audioContext;
  }

  
  function loadAudio() {
    const env = getAudioEnv();
    const audioContext = prepareAudioContext(env);

    // --- file ---
    const audioFileInput = document.getElementById('audio_file');
    if (audioFileInput.files.length == 0) {
      console.warn('file not selected');
      return;
    }
    const audioFileToPlay = audioFileInput.files[0];
    console.log(audioFileToPlay);

    // --- load 
    disableElement('play_button')
    loadLocalAudio(audioFileToPlay, env).then(buffer => {
      env.audioSourceBuffer = buffer;
      enabelElement('play_button')
    })
    .catch(err => {
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
    if (playbackCheck.checked) {
      // モニター用出力
      env.audioSourceGain.connect(audioContext.destination);
    }
    else {
      env.audioSourceGain.disconnect(audioContext.destination);
    }
  }

  function playbakOff() {
    playbackCheck.checked = false;
    const env = getAudioEnv();
    const audioSourceGain = env.audioSourceGain;
    if (audioSourceGain) {
      audioSourceGain.disconnect();
    }
  }


  function startAudioNode(env) {
    // audioSource(aoudoSoruceBuffer) --> audioSourceGain
    // return audioSoruceGain

    const audioContext = prepareAudioContext(env);

    if (! env.audioSourceGain) {
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
    audioSource.loop　= true;
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
      reader.onload = function(evt) {
        const audioContext = prepareAudioContext(env);
        console.log('reader.onload(), evt:', evt);
        audioContext.decodeAudioData(reader.result)
        .then(buffer => {
          console.log('buffer ready');
          resolve(buffer);
        })
        .catch(err => {
          reject(err);
        })
      }
      reader.onloadend = function(evt) {
        console.log('reader.onloadend(), evt:', evt);
      }
      reader.onloadstart = function(evt) {
        console.log('reader.onloadstart(), evt:', evt);
      }
    })
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
