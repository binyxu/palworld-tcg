# 幻兽帕鲁卡牌游戏 · 粉丝对战平台

[![GitHub stars](https://img.shields.io/github/stars/binyxu/palworld-tcg?style=social)](https://github.com/binyxu/palworld-tcg) 　觉得好玩的话，请点右上角 ⭐ Star 支持一下！

> **非官方粉丝二创作品，完全非盈利。** 《幻兽帕鲁》《幻兽帕鲁卡牌游戏》及全部卡牌名称、卡面插画、规则文本、标志等，版权均归 Pocketpair, Inc. 及官方卡牌游戏权利方所有。详见下方[版权声明](#版权声明)。

依据《幻兽帕鲁卡牌游戏 综合规则书 ver.1.00 & FAQ 第1弹》实现的网页对战平台：完整规则、组卡、人机对战（四档 AI）、真人联机、残局解谜、大奖赛、抽卡、复盘。

**▶ 在线试玩（纯浏览器单机版）：https://palworld-tcg.github.io/**

| | 在线试玩（单机版） | 本地部署（本仓库） |
|---|---|---|
| 安装 | 无需安装，打开网页即玩 | 需要 Node.js 18+ |
| 人机 / 残局 / 大奖赛 / 抽卡 / 组卡 / 复盘 | ✅ | ✅ |
| 真人联机对战 | ❌ | ✅ 局域网或公网 |
| AI 在哪里计算 | 你的浏览器（后台线程） | 服务器 |
| 存档 | 本机浏览器（清缓存会丢失） | 服务器 `userdata/` 目录，可注册账号多端同步 |
| 自备原声带 | ❌ | ✅ |

## 本地部署

零依赖，不需要 `npm install`：

```bash
git clone https://github.com/binyxu/palworld-tcg.git
cd palworld-tcg
npm start                      # 或 node server/server.js
```

浏览器打开 http://localhost:8930 。

- 改端口：`PORT=9000 npm start`
- 数据目录（账号、复盘、大奖赛记录、原声带）：默认 `userdata/`，可用 `PTCG_DATA=/路径 npm start` 指定。
- 和朋友联机：对方访问 `http://你的局域网IP:8930`，在「对战 → 在线对战」创建 / 加入 4 位房间号。
  - 想给外网的朋友玩，可以用内网穿透，例如 `cloudflared tunnel --url http://localhost:8930`，会得到一个公网 https 地址；也可以部署到任意云服务器（建议用 pm2 常驻、Nginx/Caddy 反向代理）。
- 残局攻略密码：`palworld`（可用环境变量 `PUZZLE_PW` 修改）。

## 功能

- **卡牌**：收录第 1 弹（BP01）、TD01、TD02、SS01、PR 共 153 种卡及全部异画，所有效果均已实现。
- **规则**：先后攻、重抽、灵魂、任命、解体、战斗各步骤（阻挡 / 快速步骤 / 妨碍）、自动能力排序、伤害翻卡与 ☆ 抵消、帕鲁上限、黑夜、全部关键词。
- **组卡**：50 张、同名 4 张、☆ 至多 8 张、至多 2 色；保存 / 导入 / 导出 / 多种随机生成；精调预设与知名卡组。
- **人机对战**：
  - 简单 / 普通：规则型 AI。
  - 困难：深度搜索 AI，**不偷看**你的手牌和卡组顺序（对隐藏信息做抽样推测）。
  - 地狱：同样的搜索，但能看到全部信息。
- **残局**：29 个解谜关卡（Lv1–Lv6），对手由求解器扮演，总会选最顽强的应对。
- **大奖赛**：随机两色、50 轮三选一组卡，无限连战地狱 AI，输 3 场结束，排行榜。
- **其他**：抽卡（补充包第 1 弹概率）、收藏册、复盘（逐步回放）、悔棋、表情、程序合成的原创配乐。

## AI 简介

困难 / 地狱 AI 位于 `server/ai_deep.js`：

1. **己方回合搜索**：对本回合所有出牌与攻击顺序做深度优先搜索；对手在你回合中的妨碍 / 阻挡 / 快速应对按「对我最不利」处理。
2. **对手回合复核**：取最好的几种回合结束局面，对每种局面抽样推测对手手牌，替对手搜索其下一整回合的最佳应对，再按最终结果重新打分。
3. **局面评估**：一个小型神经网络价值函数（`server/ai_value.json`，约 1.8 万参数），以自对弈胜负训练。它**不按卡牌编号认识卡**，只看费用、战斗力、打击力、关键字、效果文字标签等属性，因此新卡无需重新训练即可使用。训练代码见 `server/train/`。
4. **必胜搜索**：接近终局时用求解器寻找「无论对手怎么应对都能获胜」的着法；残局关卡同样依靠它解题。

## 构建在线单机版

```bash
npm run build:demo             # 输出到 dist/
cd dist && python3 -m http.server 8000   # 本地预览，打开 http://localhost:8000
```

原理：`tools/build-demo.js` 把 `server/` 下的服务端代码打包成一个 Web Worker 脚本，用 `web/worker-prelude.js` 中的替身实现 Node 的 fs / path / crypto / http；页面端 `web/demo.js` 把 `fetch('/api/…')` 和 WebSocket 透明地转发给 Worker，数据存进 localStorage。因此单机版与本地部署版共用同一套游戏代码。

`dist/` 需部署在域名根路径（例如 `<用户名>.github.io` 仓库或自定义域名）。

## 目录

```
server/engine/   规则引擎（流程、战斗、关键词、各色卡牌效果）与卡组工具
server/          服务端、AI（ai.js / ai_deep.js / ai_value.js / solver.js）、账号、大奖赛、残局
server/train/    价值网络的自对弈数据生成与训练脚本（numpy）
public/          前端界面与卡图
web/             浏览器单机版的转接层
tools/           单机版构建、卡组调优、残局生成、中文卡面渲染等工具
test/            规则测试、随机对局模糊测试、AI 对战、残局验证
```

## 测试

```bash
node test/rules.js             # 规则单元测试
node test/fuzz.js 1 200        # 200 局随机操作对局
AI=0 node test/puzzles.js      # 验证所有残局均有必胜解
node test/demo_bundle.js       # 单机版打包后的冒烟测试（需先 npm run build:demo）
```

## 版权声明

- 本项目是**粉丝自发制作的二次创作**，与 Pocketpair, Inc. 及《幻兽帕鲁卡牌游戏》官方没有任何关联，也未获得官方授权或认可。
- **完全非盈利**：不收费、不含广告、不接受任何形式的赞助或打赏，也不得被用于任何商业用途。
- 游戏名称、卡牌名称、卡面插画、规则与效果文本、标志等**全部版权归官方所有**。卡牌资料来自官方网站公开的卡牌列表，仅用于学习交流。
- 项目内置配乐是程序合成的原创仿作，**不包含**官方音乐。
- 如果权利方认为本项目有任何不妥，请提交 Issue 或联系维护者，我们会**立即配合删除**相关内容或下线项目。
- 本项目自行编写的程序代码可在非商业前提下自由学习、修改和分享，详见 [LICENSE](LICENSE.md)。

---

*Unofficial, non-commercial fan project. Palworld and the Palworld Trading Card Game, including all card names, artwork, rules text and logos, are © Pocketpair, Inc. and their respective rights holders. Not affiliated with or endorsed by them. Contact us and we will remove any content on request.*
