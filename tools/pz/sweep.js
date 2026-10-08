const { db, Game } = require('../../server/engine');
const { Solver, moves } = require('../../server/solver');
const N='BP01-099', L='TD02-006';
module.exports = function sweep(base, variants) {
  for (const v of variants) {
    const sc = base(v);
    const g = new Game({ db, decks: [[], []], names: ['你', '敌'], seed: 7, scenario: sc });
    const S = new Solver({ hero: 0, maxNodes: 300000 }); let ok; try { ok = S.win(g); } catch (e) { ok = 'X'; }
    const wm = ok === true ? S.winningMoves(g).length : 0;
    console.log(JSON.stringify(v), ok, S.nodes, wm + '/' + moves(g).length);
  }
};
