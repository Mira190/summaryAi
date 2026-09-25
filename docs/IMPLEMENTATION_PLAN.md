# summaryAi — 优化实施计划

> 目标：把项目从"贴 URL 调 RapidAPI 摘要"的教程 demo，变成 README 所承诺的
> "输入 DOI 即可得到论文 AI 摘要" 的可用产品，同时清掉技术债、补上测试与 CI。

## 0. 现状分析（2026-09-25）

**项目形态**：Vite 4 + `@preact/preset-vite`（代码却全部按 React 写法 `import React from "react"`，靠 preset 的 compat alias 跑）+ Tailwind 3 + Redux Toolkit Query。单页，两个组件 `Hero` / `Demo`，一个 RTK Query endpoint 调 RapidAPI 的
`article-extractor-and-summarizer`。构建可通过（`npm run build` OK），无 lint、无测试、无 CI。

**核心功能缺口**
- README 说"输入 DOI"，但 UI 只接受 `type="url"`，没有任何 DOI 解析/元数据获取逻辑。这是最大的差距。
- 结果只有一段纯文本，没有论文标题/作者/期刊/年份等元数据。

**明确的 bug（`src/components/Demo.jsx`）**
1. `allArticles.reverse()` 在 render 里原地反转 state 数组，每次渲染顺序来回翻。
2. `handleKeyDown` 监听 keyCode 13 手动调 `handleSubmit`，而 `<form onSubmit>` 已处理回车 → 回车触发两次请求。
3. 复制按钮的 `onClick` 没有 `stopPropagation`，点复制会同时触发外层卡片的 `setArticle`。
4. `setCopied("")` 初始是字符串，`setTimeout(() => setCopied(false))` 复位成布尔，类型不一致。
5. `JSON.parse(localStorage.getItem("articles"))` 无 try/catch，本地数据损坏会白屏。
6. 错误分支只显示 `error?.data?.error`，网络错误/缺 key/429 时用户看到空白。
7. 请求中没有禁用提交按钮、没有取消上一次请求（AbortController）。
8. 历史记录无上限、无删除，去重只按 url 精确匹配。

**配置/资源问题**
- `tailwind.config.js` 字体名拼错：`'Santoshi'` → 应为 `'Satoshi'`（导致 `font-satoshi` 实际落到 sans-serif）。
- `index.html` 引用 `/favicon.ico`，但仓库里没有 `public/`，实际文件是 `src/assets/favicon.ico.ico`（双后缀）→ 404。
- `<title>` 是 "OpenAI Article Summarizer"，Hero 文案写 "AI-Powered GPT4"，与实际（RapidAPI 抽取+摘要）不符。
- `src/assets/grid.svg` 未使用；`App.css` 里 `.main:before/:after`、`.gradient` 是无效/未用样式。
- `dist/` 被提交进 git（`.gitignore` 里 `# dist` 被注释掉），每次构建都产生脏 diff。
- 没有 `.env.example`，新人不知道要配 `VITE_RAPID_API_ARTICLE_KEY`。
- `npm audit`：17 个漏洞（1 critical / 10 high），主要来自 vite 4 / postcss 8.4.23 等旧依赖。
- 依赖过重：只有一个 GET 请求却引入 `@reduxjs/toolkit` + `react-redux`（bundle 113 KB，gzip 38 KB）。

**架构层面的注意点（本轮不解决，只记录）**
- `VITE_RAPID_API_ARTICLE_KEY` 是客户端变量，任何真实构建都会把 key 打进 bundle，任何访客都能拿到。
  纯静态站无法根治，需要一个 serverless 代理（Vercel/Netlify function）。列为 Phase 3 可选项。

## 1. 目标架构

```
src/
  main.jsx                # preact render，无 Redux Provider
  App.jsx
  components/
    Hero.jsx
    Demo.jsx              # 编排：输入 → 解析 → 请求 → 展示；状态用 useSummary hook
    SearchForm.jsx        # 输入框 + 提交按钮（受控，支持 DOI / doi.org 链接 / 普通 URL）
    HistoryList.jsx       # 历史卡片：选中 / 复制 / 删除
    ResultCard.jsx        # 元数据（标题、作者、期刊、年份、DOI 链接）+ 摘要 + 摘要来源标签
    ErrorMessage.jsx
  hooks/
    useSummary.js         # {status, result, error, submit, cancel}，内部用 AbortController
    useHistory.js         # localStorage 读写、去重、上限 20、删除
  services/
    crossref.js           # fetchCrossrefWork(doi, {signal}) → 规范化元数据
    summarizer.js         # summarizeUrl(url, {signal}) → RapidAPI；统一错误类型
  utils/
    doi.js                # parseDoi(input) / isDoi / toDoiUrl
    jats.js               # stripJats(abstractHtml) 去掉 <jats:*> 标签
    storage.js            # safeGet/safeSet JSON 包装
```

**去掉** `@reduxjs/toolkit`、`react-redux`、`src/services/store.js`、`src/services/article.js`。
组件改为直接 `import { useState, useEffect } from "preact/hooks"`；`main.jsx` 用 `render` from `preact`。
（preset 的 compat alias 仍保留，避免第三方依赖出问题，但项目代码不再依赖 `react` 包名。）

## 2. 核心流程（DOI 支持）

```
submit(rawInput)
  ├─ doi = parseDoi(rawInput)          // 支持 "10.1038/...", "doi:10...", "https://doi.org/10...", 以及 URL 中内嵌的 DOI
  ├─ 命中历史（按 doi 或 url）→ 直接展示，不发请求
  ├─ 有 DOI:
  │    meta = fetchCrossrefWork(doi)   // GET https://api.crossref.org/works/{encodeURIComponent(doi)}
  │    // 404 → "DOI 不存在"；其他错误 → 记录但继续尝试摘要
  │    summary = summarizeUrl(`https://doi.org/${doi}`)
  │    // 失败（付费墙/抽取失败）且 meta.abstract 存在 → 用 abstract 作为摘要，source = "abstract"
  │    // 两者都没有 → 抛出可读错误
  └─ 无 DOI 但是合法 URL:
       summary = summarizeUrl(url), source = "summary"; meta 只有 url
result = { id, input, doi, url, title, authors[], journal, year, abstract, summary, source, createdAt }
```

Crossref 元数据规范化：`title[0]`、`author[].{given,family}` → "Given Family"、
`container-title[0]`、年份取 `published-print` / `published-online` / `issued` 的 `date-parts[0][0]`、
`abstract` 经 `stripJats`、`URL` 字段。Crossref 请求带 `User-Agent` 不可控（浏览器），
可在 query 加 `mailto=`（读 `VITE_CROSSREF_MAILTO`，可选）以进入 polite pool。

**错误信息要具体**：无效输入 / DOI 未找到 / 缺少 API key（`import.meta.env.VITE_RAPID_API_ARTICLE_KEY` 为空时在提交前就提示）/ 429 配额用尽 / 网络错误 / 抽取失败但已展示摘要来源。

## 3. 分阶段任务

### Phase 0 — 仓库卫生（单独一个 commit）
- [ ] `git rm -r --cached dist`，`.gitignore` 启用 `dist`。
- [ ] 新建 `public/favicon.ico`（把 `src/assets/favicon.ico.ico` 移过去并改名），`index.html` 改为 `type="image/x-icon"`。
- [ ] `index.html` `<title>` 改为 "SummaryAI — DOI Paper Summarizer"；`lang` 保持 en。
- [ ] `tailwind.config.js` 修正 `Satoshi`。
- [ ] 删除未用的 `grid.svg`、`App.css` 中无效的 `.main:before/:after` 与 `.gradient`。
- [ ] 添加 `.env.example`（`VITE_RAPID_API_ARTICLE_KEY=`、`VITE_CROSSREF_MAILTO=`）。

### Phase 1 — 依赖与工具链（单独一个 commit）
- [ ] 升级：`vite` → 最新 6.x（或 7.x，Node 22 可用）、`@preact/preset-vite` 最新、`preact` 最新 10.x、`tailwindcss` 保持 3.x 最新补丁、`postcss`/`autoprefixer` 最新。**不要**升到 Tailwind 4（配置模型变化大，超出本轮范围）。
- [ ] 移除 `@reduxjs/toolkit`、`react-redux`。
- [ ] 添加 devDeps：`vitest`、`@testing-library/preact`、`jsdom`、`eslint` (flat config) + `eslint-plugin-react-hooks`（或 preact 官方 config）。
- [ ] `package.json` scripts：`lint`、`test`、`test:watch`；`build` 前不必强制 lint。
- [ ] 重新生成 `package-lock.json`，`npm audit` 结果记入 commit message（剩余数量）。

### Phase 2 — 核心功能重写（可拆 2–3 个 commit：utils+services → hooks → 组件）
- [ ] `utils/doi.js`、`utils/jats.js`、`utils/storage.js` + 单测。
- [ ] `services/crossref.js`、`services/summarizer.js` + 用 `vi.stubGlobal('fetch')` 的单测（404、429、成功、abort）。
- [ ] `hooks/useHistory.js`（上限 20，按 doi/url 去重，删除，损坏数据自愈）+ 单测。
- [ ] `hooks/useSummary.js`（状态机 idle/loading/success/error，AbortController，重复提交取消前一个）。
- [ ] 组件拆分与重写，修复现状分析里的 8 个 bug；输入框 `type="text"`（DOI 不是 URL），placeholder 改为
      "Paste a DOI (10.xxxx/...) or article URL"；加 `<label>`（可视觉隐藏）、结果区 `aria-live="polite"`、按钮 `aria-label`。
- [ ] Hero 文案改为与功能一致（去掉 GPT4 字样），GitHub 按钮指向 `https://github.com/Mira190/summaryAi`。
- [ ] 一个组件级测试：输入 DOI → mock fetch → 展示标题与摘要；输入非法字符串 → 显示错误。

### Phase 3 — CI 与文档（单独一个 commit）
- [ ] `.github/workflows/ci.yml`：Node 22，`npm ci`、`npm run lint`、`npm test -- --run`、`npm run build`。
- [ ] README 重写：功能说明、DOI/URL 支持、本地运行（`.env` 配置）、脚本、已知限制（RapidAPI key 在客户端可见，付费墙论文回退到 Crossref abstract）。
- [ ] （可选，仅在前面全部完成后）`api/summarize.js` Vercel serverless 代理的草稿 + README 说明。不做也可以，但要在最终汇报里说明。

## 4. 验收标准
- `npm run lint`、`npm test -- --run`、`npm run build` 三者全绿。
- 构建产物 gzip 后 JS 明显小于当前 38 KB（去掉 Redux 后预计 < 20 KB）。
- 手动逻辑覆盖：`10.1038/nature12373`、`https://doi.org/10.1038/nature12373`、`doi:10.1038/nature12373`、
  普通文章 URL、`not-a-doi` 五种输入路径在单测中都有断言。
- git 里不再有 `dist/`；工作树在 build 后仍然 clean。
- 每个 commit 独立可构建。

## 5. 不做的事
- 不引入 TypeScript（改动面太大，另开一轮）。
- 不升 Tailwind 4。
- 不更换摘要供应商（RapidAPI 保留），不引入后端。
