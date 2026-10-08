// 子进程：读 stdin JSON {pairs:[[i,j,seed]], decks, ai}，输出结果
const { play, randomDeck } = require('./lib');
let buf = ''; process.stdin.on('data', d => buf += d).on('end', () => {
  const { pairs, decks, ai } = JSON.parse(buf);
  const D = decks.map(d => d === 'RANDOM' ? (s => randomDeck(mul(s))) : d === 'RANDOM_STRONG' ? (s => randomDeck(mul(s), null, true)) : d);
  function mul(s) { let x = s * 2654435761 >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
  const out = pairs.map(([i, j, s]) => [i, j, play(D[i], D[j], s, ai)]);
  process.stdout.write(JSON.stringify(out));
});
