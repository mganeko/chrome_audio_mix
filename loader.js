async function load() {
  const res = await fetch(chrome.runtime.getURL('cs.js'), { method: 'GET' })
  const js = await res.text()
  const script = document.createElement('script')
  script.textContent = js
  document.body.insertBefore(script, document.body.firstChild)
}

const _PRINT_LOADER_LOG = false;
function _loaderlog(var_args) {
  if (_PRINT_LOADER_LOG) {
    console.log(...arguments);
  }
}

// window.addEventListener('load', (evt) => {
//   _loaderlog('event load'); // 元のindex.html の中の処理より後に呼ばれる
//   load()
// }, false)

window.addEventListener('load', async (evt) => {
  _loaderlog('event load'); // 元のindex.html の中の処理より後に呼ばれる
  await load()
}, true) // use capture

_loaderlog('loader.js');


