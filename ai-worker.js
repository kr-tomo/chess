importScripts('engine.js');
onmessage = function (e) {
  const d = e.data;
  const move = self.Chess.think(d.state, d.opts, d.level);
  postMessage({ id: d.id, move: move });
};
