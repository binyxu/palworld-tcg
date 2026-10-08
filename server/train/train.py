"""训练与卡牌 ID 无关的价值网络（numpy，纯 CPU）。
用法: python3 train.py <输出json> [--ood]   --ood: 只用不含紫色的对局训练，在含紫色的对局上测试（模拟"全新卡牌"）
"""
import sys, glob, json, numpy as np
DIM = None
xs, ys, ms = [], [], []
for f in sorted(glob.glob('data/*.x')):
    b = f[:-2]
    y = np.fromfile(b + '.y', dtype=np.float32); m = np.fromfile(b + '.m', dtype=np.float32).reshape(-1, 3)
    x = np.fromfile(b + '.x', dtype=np.float32); DIM = x.size // y.size; x = x.reshape(-1, DIM)
    r = 4 if b.split('/')[-1].startswith('d') else 1
    for _ in range(r): xs.append(x); ys.append(y); ms.append(m)
X = np.concatenate(xs); Y = np.concatenate(ys); M = np.concatenate(ms)
print('positions', len(Y), 'dim', DIM)
rng = np.random.default_rng(0)
ood = '--ood' in sys.argv
# 以"局"为单位划分：相邻两条（双方视角）属于同一位置，按块划分避免泄漏
blk = np.arange(len(Y)) // 64
if ood:
    tr = M[:, 0] == 0; te = M[:, 0] == 1
else:
    te = (blk % 10) == 0; tr = ~te
Xtr, Ytr, Xte, Yte = X[tr], Y[tr], X[te], Y[te]
mu = Xtr.mean(0); sd = Xtr.std(0) + 1e-3
n = lambda a: (a - mu) / sd
H1, H2 = 48, 24
W1 = rng.normal(0, np.sqrt(2 / DIM), (DIM, H1)).astype(np.float32); b1 = np.zeros(H1, np.float32)
W2 = rng.normal(0, np.sqrt(2 / H1), (H1, H2)).astype(np.float32); b2 = np.zeros(H2, np.float32)
W3 = rng.normal(0, np.sqrt(1 / H2), (H2, 1)).astype(np.float32); b3 = np.zeros(1, np.float32)
P = [W1, b1, W2, b2, W3, b3]; Mo = [np.zeros_like(p) for p in P]; Ve = [np.zeros_like(p) for p in P]
def fwd(x):
    h1 = np.maximum(x @ W1 + b1, 0); h2 = np.maximum(h1 @ W2 + b2, 0); return np.tanh(h2 @ W3 + b3)[:, 0], (h1, h2)
def metrics(Xs, Ys, Ms=None):
    p = fwd(n(Xs))[0]; out = {'mse': float(((p - Ys) ** 2).mean()), 'acc': float(((p > 0) == (Ys > 0)).mean())}
    return out
Xn = n(Xtr); lr, wd, bs, step = 1e-3, 3e-3, 512, 0
best = (9, None)
for ep in range(int(next((a[3:] for a in sys.argv if a.startswith('ep=')), 6))):
    idx = rng.permutation(len(Ytr))
    for k in range(0, len(idx), bs):
        j = idx[k:k + bs]; x = Xn[j]; y = Ytr[j]
        p, (h1, h2) = fwd(x)
        g = (2 * (p - y) * (1 - p * p) / len(j))[:, None]
        gW3 = h2.T @ g; gb3 = g.sum(0); d2 = (g @ W3.T) * (h2 > 0)
        gW2 = h1.T @ d2; gb2 = d2.sum(0); d1 = (d2 @ W2.T) * (h1 > 0)
        gW1 = x.T @ d1; gb1 = d1.sum(0)
        step += 1
        for i, gr in enumerate([gW1, gb1, gW2, gb2, gW3, gb3]):
            if gr.ndim == 2: gr = gr + wd * P[i]
            Mo[i] = 0.9 * Mo[i] + 0.1 * gr; Ve[i] = 0.999 * Ve[i] + 0.001 * gr * gr
            P[i] -= lr * (Mo[i] / (1 - 0.9 ** step)) / (np.sqrt(Ve[i] / (1 - 0.999 ** step)) + 1e-8)
    lr *= 0.8
    mt = metrics(Xte, Yte); print('ep', ep, 'train', metrics(Xtr[:40000], Ytr[:40000]), 'test', mt)
    if mt['mse'] < best[0]: best = (mt['mse'], [p.copy() for p in P])
for i, p in enumerate(best[1]): P[i][...] = p
# 对比：手写评估 evalM 的胜负预测准确率
e = M[te, 2]; print('evalM baseline acc', float(((e > 0) == (Yte > 0)).mean()))
for lo, hi in [(0, 2), (2, 5), (5, 99)]:
    s = (M[te, 1] >= lo) & (M[te, 1] < hi)
    p = fwd(n(Xte[s]))[0]
    print(f'  距终局 {lo}-{hi} 回合: net acc {((p > 0) == (Yte[s] > 0)).mean():.3f}  evalM acc {((M[te][s, 2] > 0) == (Yte[s] > 0)).mean():.3f}  n={s.sum()}')
if len(sys.argv) > 1 and not sys.argv[1].startswith('--'):
    json.dump({'dim': DIM, 'mu': mu.tolist(), 'sd': sd.tolist(), 'W1': W1.tolist(), 'b1': b1.tolist(), 'W2': W2.tolist(), 'b2': b2.tolist(), 'W3': W3[:, 0].tolist(), 'b3': float(b3[0])}, open(sys.argv[1], 'w'))
    print('saved', sys.argv[1])
