const shards = new Map();
function getShard(initial) {
  if (!shards.has(initial)) {
    const pending = fetch(chrome.runtime.getURL(`dict/${initial}.json`))
      .then(response => { if (!response.ok) throw new Error('dictionary'); return response.json(); })
      .catch(error => { shards.delete(initial); throw error; });
    shards.set(initial, pending);
  }
  return shards.get(initial);
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== 'lookup') return;
  const word = message.word;
  if (typeof word !== 'string' || word.length > 100 || !/^[a-z]+(?:['-][a-z]+)*$/.test(word)) {
    reply({ entry: null }); return;
  }
  getShard(word[0]).then(dictionary => {
    let key = word;
    if (!Object.hasOwn(dictionary, key) && key.endsWith("'s")) key = key.slice(0, -2);
    reply({ entry: Object.hasOwn(dictionary, key) ? dictionary[key] : null, key });
  }).catch(() => reply({ error: '词典加载失败，请刷新页面重试' }));
  return true;
});
