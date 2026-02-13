/**
 * render_logic.js
 * 负责将网页内容转换为 Markdown 和 LaTeX
 */
// 动态创建一个 style 标签，修复字体路径问题
const style = document.createElement('style');
const cssPath = chrome.runtime.getURL('content/libs/katex/fonts/');

// 覆盖 KaTeX 的字体声明，强制指向扩展内部的绝对路径。
// 需要包含 Size1~Size4，否则如 \binom 这类依赖可伸缩分隔符的公式可能退化成小括号。
const katexFontFaces = [
  ['KaTeX_AMS', 'KaTeX_AMS-Regular.woff2'],
  ['KaTeX_Caligraphic', 'KaTeX_Caligraphic-Regular.woff2'],
  ['KaTeX_Caligraphic', 'KaTeX_Caligraphic-Bold.woff2', 'bold'],
  ['KaTeX_Fraktur', 'KaTeX_Fraktur-Regular.woff2'],
  ['KaTeX_Fraktur', 'KaTeX_Fraktur-Bold.woff2', 'bold'],
  ['KaTeX_Main', 'KaTeX_Main-Regular.woff2'],
  ['KaTeX_Main', 'KaTeX_Main-Italic.woff2', 'normal', 'italic'],
  ['KaTeX_Main', 'KaTeX_Main-Bold.woff2', 'bold'],
  ['KaTeX_Main', 'KaTeX_Main-BoldItalic.woff2', 'bold', 'italic'],
  ['KaTeX_Math', 'KaTeX_Math-Italic.woff2', 'normal', 'italic'],
  ['KaTeX_Math', 'KaTeX_Math-BoldItalic.woff2', 'bold', 'italic'],
  ['KaTeX_SansSerif', 'KaTeX_SansSerif-Regular.woff2'],
  ['KaTeX_SansSerif', 'KaTeX_SansSerif-Italic.woff2', 'normal', 'italic'],
  ['KaTeX_SansSerif', 'KaTeX_SansSerif-Bold.woff2', 'bold'],
  ['KaTeX_Script', 'KaTeX_Script-Regular.woff2'],
  ['KaTeX_Size1', 'KaTeX_Size1-Regular.woff2'],
  ['KaTeX_Size2', 'KaTeX_Size2-Regular.woff2'],
  ['KaTeX_Size3', 'KaTeX_Size3-Regular.woff2'],
  ['KaTeX_Size4', 'KaTeX_Size4-Regular.woff2'],
  ['KaTeX_Typewriter', 'KaTeX_Typewriter-Regular.woff2'],
];

style.textContent = katexFontFaces.map(([family, file, weight = 'normal', styleType = 'normal']) => `
  @font-face {
    font-family: '${family}';
    src: url('${cssPath}${file}') format('woff2');
    font-weight: ${weight};
    font-style: ${styleType};
    font-display: swap;
  }
`).join('\n');
document.head.appendChild(style);

// 同时确保加载原始 CSS
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = chrome.runtime.getURL('content/libs/katex/katex.min.css');
document.head.appendChild(link);

const targetSelector = 'pre';

const MATH_DELIMITERS = [
  { left: '$$', right: '$$', display: true },
  { left: '$', right: '$', display: false },
  { left: '\\(', right: '\\)', display: false },
  { left: '\\[', right: '\\]', display: true },
  { left: '\\begin{equation}', right: '\\end{equation}', display: true },
  { left: '\\begin{equation*}', right: '\\end{equation*}', display: true },
  { left: '\\begin{align}', right: '\\end{align}', display: true },
  { left: '\\begin{align*}', right: '\\end{align*}', display: true },
  { left: '\\begin{alignat}', right: '\\end{alignat}', display: true },
  { left: '\\begin{alignat*}', right: '\\end{alignat*}', display: true },
  { left: '\\begin{gather}', right: '\\end{gather}', display: true },
  { left: '\\begin{gather*}', right: '\\end{gather*}', display: true },
  { left: '\\begin{multline}', right: '\\end{multline}', display: true },
  { left: '\\begin{multline*}', right: '\\end{multline*}', display: true },
];

const MATH_HINT_RE = /(\$\$[\s\S]*\$\$)|(\$[^$\n]+\$)|(\\\([\s\S]*?\\\))|(\\\[[\s\S]*?\\\])|(\\begin\{[a-zA-Z*]+\})/m;
const MARKDOWN_HINT_RE = /(^|\n)\s{0,3}(#{1,6}\s|>|[-*+]\s|\d+\.\s)|(\*\*)|(__)|(`{1,3})|(\[[^\]]+\]\([^)]+\))/m;
const MATH_SEGMENT_RE = /(\$\$[\s\S]*?\$\$)|(\$[^$\n]+\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))|(\\begin\{(?:equation\*?|align\*?|alignat\*?|gather\*?|multline\*?)\}[\s\S]*?\\end\{(?:equation\*?|align\*?|alignat\*?|gather\*?|multline\*?)\})/g;

function protectMathSegments(text) {
  const segments = [];
  const placeholderText = text.replace(MATH_SEGMENT_RE, (match) => {
    const token = `BN_MATH_PLACEHOLDER_${segments.length}_BN`;
    segments.push({ token, match });
    return token;
  });
  return { placeholderText, segments };
}

function restoreMathSegments(text, segments) {
  let output = text;
  segments.forEach(({ token, match }) => {
    output = output.split(token).join(match);
  });
  return output;
}

// 1. 定义执行函数
function doRender() {
  const elements = document.querySelectorAll(targetSelector);

  elements.forEach(el => {
    // 防止重复渲染（通过添加一个自定义 class 标记）
    if (el.classList.contains('rendered-by-me')) return;

    const text = (el.textContent || '').trim();
    if (!text) return;

    const hasMath = MATH_HINT_RE.test(text);
    const hasMarkdown = MARKDOWN_HINT_RE.test(text);
    if (!hasMath && !hasMarkdown) return;

    // --- 处理 Markdown ---
    if (hasMarkdown && typeof marked !== 'undefined' && typeof marked.parse === 'function') {
      const { placeholderText, segments } = hasMath
        ? protectMathSegments(text)
        : { placeholderText: text, segments: [] };
      const htmlResult = marked.parse(placeholderText);
      el.innerHTML = restoreMathSegments(htmlResult, segments);
    }

    // --- 处理 LaTeX ---
    // 注意：auto-render 默认会忽略 pre/code；这里移除 pre，保证题面里的公式可渲染。
    if (hasMath && typeof renderMathInElement === 'function') {
      renderMathInElement(el, {
        delimiters: MATH_DELIMITERS,
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'option', 'code'],
        throwOnError: false,
        strict: 'ignore'
      });
    }

    // 标记已处理
    el.classList.add('rendered-by-me');
  });
}

// 2. 页面加载完成后立即运行一次
console.log("7fa4 渲染脚本已激活");
doRender();

// 3. (可选) 监控页面动态变化
// 针对 7fa4.cn 这种后台系统，如果点击分页后内容是异步加载的，需要这一段
const observer = new MutationObserver((mutations) => {
  // 简单的防抖处理，避免频繁触发
  clearTimeout(window.renderTimer);
  window.renderTimer = setTimeout(doRender, 300);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
