# Snooker Rating

> [English](README.md) | 简体中文

[打开 Snooker Rating 网站](https://junjiecharles.github.io/snooker-rating/)

Snooker Rating 独立评估职业斯诺克选手随时间变化的竞技实力，主要用于：

- 比较选手当前的相对实力；
- 查看选手职业生涯中的水平变化；
- 回顾部分世锦赛结束节点的历史排名；
- 对比两名选手的等级分历史与交手记录。

本站等级分是统计估计，不是世界斯诺克巡回赛官方排名，也不衡量奖金收入。它反映的是本站所收录比赛范围内的相对竞技实力。比赛数据较少或长期未参赛的选手，其估计自然更不确定；新增或更正比赛结果后，历史估计也可能发生变化。

## 评级方法

本站采用 Rémi Coulom 提出的 **Whole-History Rating（WHR）** 方法。WHR 适合利用完整的可用比赛历史，展示选手实力随时间的变化。实现会记录数据截止时间、参数、算法版本和纳入范围，使发布的排名可追溯、可复现。

本文只提供面向用户的简要说明，不展开算法细节。方法背景可查阅下列参考资料。

## 参考资料

- [Whole-History Rating 项目主页](https://www.remi-coulom.fr/WHR/)
- [Whole-History Rating 论文](https://www.remi-coulom.fr/WHR/WHR.pdf)

## 仓库范围与许可

本分支是线上网站的部署快照，只包含浏览器前端和生成后的静态数据，不包含私有的数据管道、评级实现、刷新流程和报告工具。

根目录 `*.html`、`package.json`、`assets/*.js` 和 `assets/*.css` 中的前端代码按 [`LICENSE-CODE`](LICENSE-CODE) 所载 MIT License 授权。目前不对 `data/**`、Snooker Rating Logo 或其他图片和矢量素材授予许可证；这些文件为网站运行而公开可读，但不属于 MIT License 的适用范围。
