/**
 * render_logic.js
 * 负责将网页内容转换为 Markdown 和 LaTeX
 */
// 动态创建一个 style 标签，修复字体路径问题
const style = document.createElement('style');
const cssPath = chrome.runtime.getURL('content/libs/katex/fonts/');

// 覆盖 KaTeX 的字体声明，强制指向扩展内部的绝对路径
style.textContent = `
  @font-face {
    font-family: 'KaTeX_Main';
    src: url('${cssPath}KaTeX_Main-Regular.woff2') format('woff2');
    font-weight: normal;
    font-style: normal;
  }
  @font-face {
    font-family: 'KaTeX_Math';
    src: url('${cssPath}KaTeX_Math-Italic.woff2') format('woff2');
    font-weight: normal;
    font-style: italic;
  }
  /* 根据需要可以继续添加其他字体文件... */
`;
document.head.appendChild(style);

// 同时确保加载原始 CSS
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = chrome.runtime.getURL('content/libs/katex/katex.min.css');
document.head.appendChild(link);
// 1. 定义执行函数
function doRender() {
  // 【关键】你需要根据 7fa4.cn 的实际网页结构修改这个 CSS 选择器
  // 比如内容是在 <div class="content"> 里，就写 '.content'
  const targetSelector = 'pre'; // 暂定范围大一点，之后可以精确化

  const elements = document.querySelectorAll(targetSelector);

  elements.forEach(el => {
    // 防止重复渲染（通过添加一个自定义 class 标记）
    if (el.classList.contains('rendered-by-me')) return;

    // 如果元素里包含 $ 或 Markdown 特征（如 #, **, [）
    const text = el.innerText.trim();
    if (text.includes('$') || text.includes('#') || text.includes('**')) {
      
      // --- 处理 Markdown ---
      // 注意：marked.parse 比较重，如果只有 LaTeX 需求可以去掉这步
      const htmlResult = marked.parse(text);
      el.innerHTML = htmlResult;

      // --- 处理 LaTeX ---
      // 使用 KaTeX 的 auto-render 插件直接渲染整个元素
      if (typeof renderMathInElement === 'function') {
        renderMathInElement(el, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
          ],
          throwOnError: false
        });
      }

      // 标记已处理
      el.classList.add('rendered-by-me');
    }
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