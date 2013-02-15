var names = ['alpha', 'space', 'beta', 'omega', 'zone', 'base', 'bass', 'centaur', 'official', 'free', 'fresh', 'freedom', 'power', 'synth', 'lazer', 'gamma', 'red', 'green', 'ultra', 'net', 'cafe', 'secret', 'open', 'track', 'wisdom', 'genghis', 'tron', 'grid', 'plus', 'maximum', 'pre', 'post', 'mid', 'pyramid', 'core', 'fast', 'dragon', 'wizard', 'yak', 'crystal', 'electric', 'rizzle', 'tiny', 'pantry', 'dry', 'bleeding', 'fruit', 'mower', 'whiskey', 'marble', 'cake', 'meat', 'donkey','wewo', 'banana', 'rooster', 'bear', 'bacon', 'moon', 'glitter', 'grandma', 'walrus', 'party', 'junk', 'crazy', 'turbo', 'hyper', 'mega', 'boss', 'dunk', 'pow', 'icy', 'bobo', 'pile', 'tater', 'wiz', 'gnarl', 'mix', 'pop', 'mustard', 'bizzler', 'fog', 'punch', 'planar']

module.exports = function(len) {
  len = len || 2
  var name = ''
  while (len > 0) {
    name += randomName()
    len--
  }
  return name
}

function randomName() {
  return names[~~(Math.random() * names.length)]
}