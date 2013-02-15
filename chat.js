module.exports = function(name, emitter) {
  // Handle entering a command
  window.addEventListener('keyup', function(e) {
    if (e.keyCode !== 13) return;
    var el = document.getElementById('cmd');
    if (document.activeElement === el) {
      emitter.emit('message', {user: name, text: el.value})
      el.value = '';
      el.blur();
    } else {
      el.focus();
    }
  });

  emitter.on('message', showMessage)

  function showMessage(message) {
    var li = document.createElement('li')
    li.innerHTML = message.user + ': ' + message.text
    messages.appendChild(li)
    messages.scrollTop = messages.scrollHeight
  }
}
